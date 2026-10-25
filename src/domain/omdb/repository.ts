/**
 * @packageDocumentation
 *
 * D1-backed reads + writes for OMDB ratings. The columns live on
 * `tmdb_movies` so the catalog view picks them up without a join.
 */

import { and, eq, isNull, or } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { tmdbMovies } from '../db/schema';
import type { OmdbEnrichResult } from '@/lib/omdb';

/** Read + write OMDB columns on tmdb_movies. @public */
export class OmdbRepository {
  public constructor(private readonly db: Database) {}

  /**
   * IMDb ids that still need an OMDB lookup. We pick movies whose TMDB
   * status is `found` (so we know the imdb_id is real and resolvable)
   * and whose `omdb_status` is NULL or `error` (a previously-errored row
   * can be retried).
   */
  public async pending(limit: number): Promise<readonly string[]> {
    const rows = await this.db
      .select({ imdb_id: tmdbMovies.imdb_id })
      .from(tmdbMovies)
      .where(
        and(
          eq(tmdbMovies.status, 'found'),
          or(
            isNull(tmdbMovies.omdb_status),
            eq(tmdbMovies.omdb_status, 'error'),
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
      .update(tmdbMovies)
      .set({
        omdb_status: result.status,
        omdb_fetched_at: nowIso,
        omdb_raw: result.raw,
        imdb_rating: result.ratings?.imdb_rating ?? null,
        imdb_votes: result.ratings?.imdb_votes ?? null,
        metacritic_score: result.ratings?.metacritic_score ?? null,
        rt_score: result.ratings?.rt_score ?? null,
      })
      .where(eq(tmdbMovies.imdb_id, imdbId));
  }
}
