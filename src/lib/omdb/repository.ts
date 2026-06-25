/**
 * @packageDocumentation
 *
 * D1-backed reads + writes for OMDB ratings. The columns live on
 * `tmdb_movies` so the catalog view picks them up without a join.
 */

import { drizzle } from 'drizzle-orm/d1';
import { and, eq, isNull, or } from 'drizzle-orm';

import { tmdb_movies } from '../db/schema';
import type { OmdbEnrichResult } from './types';

/** Read + write OMDB columns on tmdb_movies. @public */
export class OmdbRepository {
  private readonly db: ReturnType<typeof drizzle>;

  public constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * IMDb ids that still need an OMDB lookup. We pick movies whose TMDB
   * status is `found` (so we know the imdb_id is real and resolvable)
   * and whose `omdb_status` is NULL or `error` (a previously-errored row
   * can be retried).
   */
  public async pending(limit: number): Promise<readonly string[]> {
    const rows = await this.db
      .select({ imdb_id: tmdb_movies.imdb_id })
      .from(tmdb_movies)
      .where(
        and(
          eq(tmdb_movies.status, 'found'),
          or(
            isNull(tmdb_movies.omdb_status),
            eq(tmdb_movies.omdb_status, 'error'),
          ),
        ),
      )
      .limit(limit);
    return rows.map((row) => row.imdb_id);
  }

  /** Persist one enrichment result. */
  public async persist(
    imdbId: string,
    result: OmdbEnrichResult,
    nowIso: string,
  ): Promise<void> {
    await this.db
      .update(tmdb_movies)
      .set({
        omdb_status: result.status,
        omdb_fetched_at: nowIso,
        omdb_raw: result.raw,
        imdb_rating: result.ratings?.imdb_rating ?? null,
        imdb_votes: result.ratings?.imdb_votes ?? null,
        metacritic_score: result.ratings?.metacritic_score ?? null,
        rt_score: result.ratings?.rt_score ?? null,
      })
      .where(eq(tmdb_movies.imdb_id, imdbId));
  }
}
