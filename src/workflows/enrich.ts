import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';

import { buildEnricher } from '../lib/tmdb/index';

/**
 * Parameters accepted by {@link EnrichWorkflow}.
 *
 * @public
 */
export interface EnrichWorkflowParams {
  /** Max movies to enrich this run. Defaults to 80. */
  movieLimit?: number;
  /** Max people to enrich this run. Defaults to 250. */
  peopleLimit?: number;
}

/**
 * Granular TMDB enrichment.
 *
 * Each movie and each person is its own `step.do()` — so every step makes
 * at most two subrequests (well under the 50-per-invocation Free-plan cap),
 * and Workflows persists each step's result. A failure on movie #40
 * never re-runs movies #1–39; the instance resumes at the failed step.
 *
 * The list steps are bounded (movieLimit / peopleLimit) so a single
 * instance never exceeds the per-instance step ceiling; the twice-daily
 * cron re-triggers to mop up whatever's left.
 *
 * @public
 */
export class EnrichWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  EnrichWorkflowParams
> {
  public override async run(
    event: WorkflowEvent<EnrichWorkflowParams>,
    step: WorkflowStep,
  ) {
    const movieLimit = event.payload.movieLimit ?? 80;
    const peopleLimit = event.payload.peopleLimit ?? 250;
    const enricher = () => buildEnricher(this.env.DB, this.env);
    const retry = { retries: { limit: 3, delay: '10 seconds' } } as const;
    // Yield to a fresh Worker invocation every PACE items so the shared
    // per-invocation subrequest budget resets and TMDB isn't throttled.
    // Movie steps cost 2 subrequests, people cost 1 — so different paces.
    const MOVIE_PACE = 12;
    const PEOPLE_PACE = 25;

    await step.do('ensure-genres', retry, async () => {
      await enricher().ensureGenres();
      return { ok: true };
    });

    // --- Movies: one step each ---
    const movieIds = await step.do('list-movies', async () =>
      enricher().listPendingMovieIds(movieLimit),
    );
    // Keep the per-movie steps sequential (each is a checkpointed
    // `step.do`), but accumulate verdicts into an immutable array and
    // derive the counts from it afterwards.
    const movieVerdicts = await movieIds.reduce<
      Promise<readonly ('found' | 'not_found' | 'error')[]>
    >(async (accP, imdbId, i) => {
      const acc = await accP;
      if (i > 0 && i % MOVIE_PACE === 0) {
        await step.sleep(`movie-pace-${i}`, '3 seconds');
      }
      const verdict = await step.do(`movie:${imdbId}`, retry, async () =>
        enricher().enrichMovie(imdbId),
      );
      return [...acc, verdict];
    }, Promise.resolve([]));
    const found = movieVerdicts.filter((v) => v === 'found').length;
    const notFound = movieVerdicts.filter((v) => v === 'not_found').length;
    const movieErrors = movieVerdicts.length - found - notFound;

    // Cheap pass to fill columns derived from cached responses.
    await step.do('backfill-credits', async () =>
      enricher().backfillFromRawCredits(),
    );

    // --- People: one step each ---
    const peopleIds = await step.do('list-people', async () =>
      enricher().listPendingPeopleIds(peopleLimit),
    );
    // Sequential per-person steps; collect the boolean outcomes and count
    // the successes immutably.
    const peopleOutcomes = await peopleIds.reduce<Promise<readonly boolean[]>>(
      async (accP, personId, i) => {
        const acc = await accP;
        if (i > 0 && i % PEOPLE_PACE === 0) {
          await step.sleep(`people-pace-${i}`, '3 seconds');
        }
        const ok = await step.do(`person:${personId}`, retry, async () =>
          enricher().enrichPerson(personId),
        );
        return [...acc, ok];
      },
      Promise.resolve([]),
    );
    const peopleFetched = peopleOutcomes.filter(Boolean).length;

    // --- Final scoring (pure DB) ---
    const talentScored = await step.do('talent-scores', async () =>
      enricher().recomputeTalentScoresPublic(),
    );

    return {
      movies: movieIds.length,
      found,
      notFound,
      movieErrors,
      people: peopleIds.length,
      peopleFetched,
      talentScored,
    };
  }
}
