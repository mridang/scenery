import { FetchBudget } from '../util/budget';
import type { TmdbClient } from './client';
import type { TmdbRepository } from './repository';
import type { EnrichSummary, TmdbPersonResponse } from './types';

/** Options for {@link TmdbEnricher.run}. @public */
export interface EnrichRunOptions {
  /** Max movies/people to scan per phase. Defaults to 200. */
  limit?: number;
  /**
   * Max external TMDB fetches in this run. Keep under the platform's
   * per-invocation subrequest cap (50 on Free). Defaults to unlimited.
   */
  fetchBudget?: number;
}

/** {@link EnrichSummary} plus whether the budget was exhausted mid-run. */
export type EnrichRunResult = EnrichSummary & {
  /** True when the fetch budget ran out — more work likely remains. */
  exhausted: boolean;
};

/**
 * Orchestrates one TMDB enrichment pass:
 *   1. ensure genre dictionary is populated,
 *   2. resolve any new movies via /find,
 *   3. fill in /movie credits for found rows that lack them,
 *   4. backfill columns derived from already-cached responses,
 *   5. fetch missing person rows,
 *   6. recompute every movie's talent_score.
 *
 * Plays nicely with retries: every step is idempotent and re-running
 * after a partial failure picks up where the previous run stopped.
 *
 * @public
 */
export class TmdbEnricher {
  public constructor(
    private readonly client: TmdbClient,
    private readonly repo: TmdbRepository,
  ) {}

  /**
   * Run one enrichment pass. Bounded by `limit` (rows per phase) and
   * `fetchBudget` (total external TMDB fetches). When the fetch budget
   * is exhausted, phases stop early and `exhausted` is returned true so
   * a surrounding Workflow can resume in a fresh step.
   *
   * @param opts - See {@link EnrichRunOptions}. A bare number is also
   *   accepted as a `limit` for back-compat.
   */
  public async run(
    opts: EnrichRunOptions | number = {},
  ): Promise<EnrichRunResult> {
    const { limit = 200, fetchBudget } =
      typeof opts === 'number' ? { limit: opts } : opts;
    const budget = new FetchBudget(fetchBudget ?? Number.MAX_SAFE_INTEGER);

    await this.ensureGenres();
    const summary: EnrichSummary = {
      found: 0,
      notFound: 0,
      errors: 0,
      scanned: 0,
      creditsFetched: 0,
      creditsErrors: 0,
      peopleFetched: 0,
      peopleErrors: 0,
      talentScored: 0,
    };
    await this.resolveNewMovies(limit, summary, budget);
    await this.fetchMissingCredits(limit, summary, budget);
    await this.repo.backfillFromRawCredits();
    await this.fetchMissingPeople(summary, budget);
    // Talent scoring is pure DB work (no subrequests); always run it so
    // any people fetched this pass are reflected immediately.
    summary.talentScored = await this.recomputeTalentScores();
    return { ...summary, exhausted: budget.exhausted };
  }

  /** Public hook so callers can refresh the genre table directly. */
  public async refreshGenres(): Promise<number> {
    const r = await this.client.getMovieGenres();
    if (!r.ok) throw new Error(`tmdb genres: ${r.error}`);
    for (const g of r.value) await this.repo.upsertGenre(g);
    return r.value.length;
  }

  /** Populate the genre dictionary if empty. Idempotent. @public */
  public async ensureGenres(): Promise<void> {
    if ((await this.repo.countGenres()) === 0) await this.refreshGenres();
  }

  // ---------------------------------------------------------------------
  // Granular API — one unit of work per call, so a Workflow can wrap each
  // in its own step.do() (fresh subrequest budget + durable checkpoint).
  // ---------------------------------------------------------------------

  /**
   * IMDb ids that still need a /find lookup (never fetched, or a prior
   * attempt errored). Each will become one workflow step.
   *
   * @public
   */
  public async listPendingMovieIds(limit: number): Promise<string[]> {
    return this.repo.pendingMovieIds(limit);
  }

  /**
   * Fully enrich ONE movie: /find then /movie credits. At most two TMDB
   * subrequests — safely under any per-invocation cap.
   *
   * @returns A short verdict for the step result.
   * @public
   */
  public async enrichMovie(
    imdbId: string,
  ): Promise<'found' | 'not_found' | 'error'> {
    const now = new Date().toISOString();
    const find = await this.client.findByImdb(imdbId);
    if (!find.ok) {
      await this.repo.recordMovieError(imdbId, find.raw, find.error, now);
      return 'error';
    }
    const movie = find.value.movie_results?.[0];
    if (!movie) {
      await this.repo.recordMovieNotFound(imdbId, find.raw, now);
      return 'not_found';
    }
    await this.repo.upsertFoundMovie(imdbId, movie, find.raw, now);

    const credits = await this.client.getMovieWithCredits(movie.id);
    if (credits.ok) {
      await this.repo.updateMovieCredits(
        imdbId,
        credits.value,
        credits.raw,
        new Date().toISOString(),
      );
    } else {
      await this.repo.recordCreditsError(
        imdbId,
        credits.raw,
        credits.error,
        new Date().toISOString(),
      );
    }
    return 'found';
  }

  /** Re-parse cached /movie responses into later-added columns. @public */
  public async backfillFromRawCredits(): Promise<number> {
    return this.repo.backfillFromRawCredits();
  }

  /**
   * Person ids referenced by the catalog that we haven't fetched yet (or
   * whose prestige score is missing). Each becomes one workflow step.
   *
   * @public
   */
  public async listPendingPeopleIds(limit: number): Promise<number[]> {
    const wanted = await this.repo.collectReferencedPeople();
    if (wanted.size === 0) return [];
    const have = await this.repo.knownPeopleIds();
    const stale = await this.repo.stalePeopleIds();
    const todo = new Set<number>([
      ...[...wanted].filter((id) => !have.has(id)),
      ...stale,
    ]);
    return [...todo].slice(0, limit);
  }

  /**
   * Fetch ONE person's filmography and store their prestige score. One
   * TMDB subrequest.
   *
   * @returns true on success, false on fetch error.
   * @public
   */
  public async enrichPerson(personId: number): Promise<boolean> {
    const r = await this.client.getPersonWithCredits(personId);
    if (!r.ok) return false;
    const { prestige, totalCredits } = this.computePrestige(r.value);
    await this.repo.upsertPerson(
      r.value,
      personId,
      prestige,
      totalCredits,
      r.raw,
      new Date().toISOString(),
    );
    return true;
  }

  /** Recompute talent_score for every movie. Pure DB, no subrequests. @public */
  public async recomputeTalentScoresPublic(): Promise<number> {
    return this.recomputeTalentScores();
  }

  private async resolveNewMovies(
    limit: number,
    summary: EnrichSummary,
    budget: FetchBudget,
  ): Promise<void> {
    const pending = await this.repo.pendingMovieIds(limit);
    summary.scanned = pending.length;
    for (const imdbId of pending) {
      // /find + /movie credits are two subrequests; need both available.
      if (budget.left < 2) {
        budget.exhausted = true;
        break;
      }
      const now = new Date().toISOString();
      budget.take();
      const find = await this.client.findByImdb(imdbId);
      if (!find.ok) {
        await this.repo.recordMovieError(imdbId, find.raw, find.error, now);
        summary.errors++;
        continue;
      }
      const movie = find.value.movie_results?.[0];
      if (!movie) {
        await this.repo.recordMovieNotFound(imdbId, find.raw, now);
        summary.notFound++;
        continue;
      }
      await this.repo.upsertFoundMovie(imdbId, movie, find.raw, now);
      summary.found++;

      try {
        budget.take();
        const credits = await this.client.getMovieWithCredits(movie.id);
        if (credits.ok) {
          await this.repo.updateMovieCredits(
            imdbId,
            credits.value,
            credits.raw,
            new Date().toISOString(),
          );
          summary.creditsFetched++;
        } else {
          await this.repo.recordCreditsError(
            imdbId,
            credits.raw,
            credits.error,
            new Date().toISOString(),
          );
          summary.creditsErrors++;
        }
      } catch {
        summary.creditsErrors++;
      }
    }
  }

  private async fetchMissingCredits(
    limit: number,
    summary: EnrichSummary,
    budget: FetchBudget,
  ): Promise<void> {
    const pending = await this.repo.pendingCreditIds(limit);
    for (const row of pending) {
      if (!budget.take()) break;
      try {
        const credits = await this.client.getMovieWithCredits(row.tmdb_id);
        if (credits.ok) {
          await this.repo.updateMovieCredits(
            row.imdb_id,
            credits.value,
            credits.raw,
            new Date().toISOString(),
          );
          summary.creditsFetched++;
        } else {
          await this.repo.recordCreditsError(
            row.imdb_id,
            credits.raw,
            credits.error,
            new Date().toISOString(),
          );
          summary.creditsErrors++;
        }
      } catch {
        summary.creditsErrors++;
      }
    }
  }

  private async fetchMissingPeople(
    summary: EnrichSummary,
    budget: FetchBudget,
  ): Promise<void> {
    const wanted = await this.repo.collectReferencedPeople();
    if (wanted.size === 0) return;
    const have = await this.repo.knownPeopleIds();
    const stale = await this.repo.stalePeopleIds();
    const newIds = [...wanted].filter((id) => !have.has(id));
    const todo = new Set<number>([...newIds, ...stale]);

    for (const personId of todo) {
      if (!budget.take()) break;
      try {
        const r = await this.client.getPersonWithCredits(personId);
        if (!r.ok) {
          summary.peopleErrors++;
          continue;
        }
        const { prestige, totalCredits } = this.computePrestige(r.value);
        await this.repo.upsertPerson(
          r.value,
          personId,
          prestige,
          totalCredits,
          r.raw,
          new Date().toISOString(),
        );
        summary.peopleFetched++;
      } catch {
        summary.peopleErrors++;
      }
    }
  }

  private computePrestige(person: TmdbPersonResponse): {
    prestige: number;
    totalCredits: number;
  } {
    const cast = person.movie_credits?.cast ?? [];
    const crew = (person.movie_credits?.crew ?? []).filter(
      (c) => c.job === 'Director',
    );
    let totalVotes = 0;
    for (const c of cast) totalVotes += c.vote_count ?? 0;
    for (const c of crew) totalVotes += c.vote_count ?? 0;
    return {
      prestige: Math.log10(totalVotes + 1),
      totalCredits: cast.length + crew.length,
    };
  }

  private async recomputeTalentScores(): Promise<number> {
    const inputs = await this.repo.movieTalentInputs();
    const prestige = await this.repo.peoplePrestigeMap();
    let updated = 0;
    for (const row of inputs) {
      const ids: number[] = [];
      for (const raw of [row.cast_ids, row.director_ids]) {
        if (raw === null) continue;
        try {
          ids.push(...(JSON.parse(raw) as number[]));
        } catch {
          /* skip */
        }
      }
      let max = 0;
      for (const id of ids) {
        const p = prestige.get(id);
        if (p !== undefined && p > max) max = p;
      }
      await this.repo.updateTalentScore(row.imdb_id, max);
      updated++;
    }
    return updated;
  }
}
