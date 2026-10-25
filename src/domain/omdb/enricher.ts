/**
 * @packageDocumentation
 *
 * Glue between the OMDB client and the D1 repository. Fetches ratings
 * for one (or many) imdb_ids and persists them.
 */

import type { Database } from '@/domain/db/client';
import { OmdbClient, type OmdbClientOptions } from '@/lib/omdb';
import { OmdbRepository } from './repository';

/** Outcome of a sweep: how many we hit, how many succeeded. @public */
export interface OmdbSweepResult {
  readonly scanned: number;
  readonly found: number;
  readonly notFound: number;
  readonly errored: number;
}

/**
 * Sweep `tmdb_movies` rows missing OMDB data and fill them in. Runs
 * sequentially — OMDB's free tier is 1000 requests/day, far above the
 * scrape rate, but the upstream is also slow enough that parallelism
 * gives little real benefit and costs us subrequest budget.
 *
 * @public
 */
export class OmdbEnricher {
  private readonly client: OmdbClient;
  private readonly repo: OmdbRepository;

  public constructor(db: Database, opts: OmdbClientOptions) {
    this.client = new OmdbClient(opts);
    this.repo = new OmdbRepository(db);
  }

  /** Enrich a single imdb id. Returns the status it ended up with. */
  public async enrichOne(
    imdbId: string,
  ): Promise<'found' | 'not_found' | 'error'> {
    const result = await this.client.fetchByImdb(imdbId);
    await this.repo.persist(imdbId, result, new Date().toISOString());
    return result.status;
  }

  /**
   * Enrich up to `limit` pending movies. Used by the one-shot backfill
   * endpoint and reused inside MovieWorkflow for the per-movie path
   * (called with `limit: 1`, just for the imdb id we already have).
   */
  public async sweepPending(limit: number): Promise<OmdbSweepResult> {
    const pending = await this.repo.pending(limit);
    let found = 0;
    let notFound = 0;
    let errored = 0;
    for (const imdbId of pending) {
      const status = await this.enrichOne(imdbId);
      if (status === 'found') {
        found += 1;
      } else if (status === 'not_found') {
        notFound += 1;
      } else {
        errored += 1;
      }
    }
    return { scanned: pending.length, found, notFound, errored };
  }
}
