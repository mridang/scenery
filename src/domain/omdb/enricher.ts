/**
 * @packageDocumentation
 *
 * Glue between the OMDb client and the D1 repository. Fetches ratings for one
 * (or many) imdb_ids and persists them. The client returns a transport-level
 * {@link Result}; this derives the found/not-found/error outcome OMDb's
 * `Response: "False"` convention implies, and persists it.
 */

import type { Result } from '@/lib/http';
import { OmdbClient, type OmdbResponse } from '@/lib/omdb';

import type { Database } from '@/domain/db/client';
import { OmdbRepository } from './repository';
import type { OmdbEnrichResult } from './types';

/** How to reach OMDb: the key, an optional base URL and transport. @public */
export interface OmdbEnricherOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly transport?: typeof fetch;
}

/** Outcome of a sweep: how many we hit, how many succeeded. @public */
export interface OmdbSweepResult {
  readonly scanned: number;
  readonly found: number;
  readonly notFound: number;
  readonly errored: number;
}

/** Derive the persisted outcome from a client result (OMDb's `Response: "False"` = not found). */
function toEnrichResult(result: Result<OmdbResponse>): OmdbEnrichResult {
  if (!result.ok) {
    return {
      status: 'error',
      ratings: null,
      raw: result.raw,
      error: result.error,
    };
  }
  if (result.value.response === 'False') {
    return {
      status: 'not_found',
      ratings: null,
      raw: result.raw,
      error: result.value.error,
    };
  }
  return {
    status: 'found',
    ratings: result.value.ratings,
    raw: result.raw,
    error: null,
  };
}

/**
 * Sweep `tmdb_movies` rows missing OMDB data and fill them in. Runs
 * sequentially — OMDB's free tier is 1000 requests/day, far above the scrape
 * rate, but the upstream is also slow enough that parallelism gives little
 * real benefit and costs us subrequest budget.
 *
 * @public
 */
export class OmdbEnricher {
  private readonly client: OmdbClient;
  private readonly repo: OmdbRepository;

  public constructor(db: Database, opts: OmdbEnricherOptions) {
    this.client = new OmdbClient(
      { apiKey: opts.apiKey, baseUrl: opts.baseUrl },
      opts.transport,
    );
    this.repo = new OmdbRepository(db);
  }

  /** Enrich a single imdb id. Returns the status it ended up with. */
  public async enrichOne(
    imdbId: string,
  ): Promise<'found' | 'not_found' | 'error'> {
    const result = toEnrichResult(await this.client.fetchByImdb(imdbId));
    await this.repo.persist(imdbId, result, new Date().toISOString());
    return result.status;
  }

  /**
   * Enrich up to `limit` pending movies. Used by the one-shot backfill
   * endpoint and reused inside MovieWorkflow for the per-movie path (called
   * with `limit: 1`, just for the imdb id we already have).
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
