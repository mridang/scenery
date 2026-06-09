import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';

import { defaultProviders, lookupOneTorrent } from '../lib/torrents';
import { buildEnricher } from '../lib/tmdb';
import { genericTransport, proxyTransport, withRetry } from '../lib/transport';

/**
 * Parameters accepted by {@link MovieWorkflow}.
 *
 * @public
 */
export interface MovieWorkflowParams {
  /** IMDb id of the single movie this instance is responsible for. */
  imdbId: string;
}

/**
 * The whole lifecycle of ONE movie, as a single durable instance.
 *
 * The scrape spawns one of these per new movie (instance id = the imdb
 * id, so it's idempotent). Because each movie is its own instance, the
 * work is tiny — ~8 TMDB calls to enrich, ~2 to look up a torrent — so
 * it never approaches the per-invocation subrequest cap, no matter how
 * many movies arrive. The 24h torrent-maturity gate is just a
 * `step.sleep` between the two halves: free, durable, and resumed in a
 * fresh invocation with a clean budget.
 *
 * @public
 */
export class MovieWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  MovieWorkflowParams
> {
  public override async run(
    event: WorkflowEvent<MovieWorkflowParams>,
    step: WorkflowStep,
  ) {
    const { imdbId } = event.payload;
    const retry = { retries: { limit: 3, delay: '10 seconds' } } as const;
    const enricher = () =>
      buildEnricher(this.env.DB, this.env, withRetry(genericTransport()));

    // 1. Enrich the movie itself (/find + /movie credits — ~2 calls).
    const verdict = await step.do('enrich-movie', retry, async () =>
      enricher().enrichMovie(imdbId),
    );

    if (verdict === 'found') {
      // 2. Enrich its cast + director (deduped — ~0–6 calls).
      await step.do('enrich-people', retry, async () => ({
        fetched: await enricher().enrichPeopleForMovie(imdbId),
      }));
      // 3. Recompute talent scores now those people have prestige data.
      //    Pure DB, no subrequests.
      await step.do('talent-scores', async () => ({
        updated: await enricher().recomputeTalentScoresPublic(),
      }));
    }

    // 4. Wait out the 24h torrent-maturity window — free and durable.
    await step.sleep('await-torrent-window', '24 hours');

    // 5. Look up the torrent for just this movie (~1–2 calls, fresh budget).
    const torrent = await step.do('torrent', retry, async () =>
      lookupOneTorrent(
        this.env.DB,
        imdbId,
        defaultProviders(proxyTransport(this.env.SCRAPINGANT_API_KEY)),
      ),
    );

    return { imdbId, verdict, torrent: torrent.status };
  }
}
