import { and, asc, count, eq, gt, lte, ne, notExists, sql } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { movies, torrentLookups, torrents } from '../db/schema';
import type {
  LookupResult,
  ResolvedLookup,
  TorrentProviderName,
} from '@/lib/torrents/types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface TorrentRunSummary {
  readonly scanned: number;
  readonly success: number;
  readonly empty: number;
  readonly errors: number;
  readonly totalStored: number;
  readonly skippedTooFresh: number;
  readonly byProvider: Record<string, number>;
}

// All DB writes for torrent lookups + per-torrent rows.
export class TorrentRepository {
  public constructor(private readonly db: Database) {}

  // IDs to look up: movies whose newest release was POSTED at least 24h
  // ago (seeders accumulate from public-post time, not from when we
  // happened to scrape it) and that haven't been successfully looked up.
  // `force` bypasses the maturity gate entirely.
  //
  // We gate on movies.newest_posted_at, the MAX(posted_at) across the
  // movie's releases (first_seen_at when a source didn't expose a date),
  // kept on the movie by ScrapingRepository.upsertRelease. Index
  // movies_newest_posted_idx gives the movies past the cutoff in order, so a
  // run reads those movies and their lookup probes, not every release.
  async candidates(limit: number, force = false): Promise<string[]> {
    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const freshness = force ? undefined : lte(movies.newest_posted_at, cutoff);
    const rows = await this.db
      .select({ imdb_id: movies.imdb_id })
      .from(movies)
      .where(
        and(
          notExists(
            this.db
              .select({ one: torrentLookups.imdb_id })
              .from(torrentLookups)
              .where(
                and(
                  eq(torrentLookups.imdb_id, movies.imdb_id),
                  ne(torrentLookups.status, 'error'),
                ),
              ),
          ),
          freshness,
        ),
      )
      .orderBy(asc(movies.newest_posted_at))
      .limit(limit);
    return rows.map((row) => row.imdb_id);
  }

  async tooFreshCount(): Promise<number> {
    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const rows = await this.db
      .select({ n: count() })
      .from(movies)
      .where(
        and(
          notExists(
            this.db
              .select({ one: torrentLookups.imdb_id })
              .from(torrentLookups)
              .where(eq(torrentLookups.imdb_id, movies.imdb_id)),
          ),
          gt(movies.newest_posted_at, cutoff),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  }

  async persist(imdbId: string, resolved: ResolvedLookup): Promise<void> {
    const now = new Date().toISOString();
    const { provider, result } = resolved;
    if (result.status === 'success') {
      for (const torrent of result.torrents) {
        await this.db
          .insert(torrents)
          .values({
            imdb_id: imdbId,
            info_hash: torrent.infoHash,
            title: torrent.title,
            raw_title: torrent.rawTitle,
            source: torrent.source,
            seeders: torrent.seeders,
            size_bytes: torrent.sizeBytes,
            quality: torrent.quality,
            is_hdr: torrent.isHdr ? 1 : 0,
            is_remux: torrent.isRemux ? 1 : 0,
            fetched_at: now,
          })
          .onConflictDoUpdate({
            target: [torrents.imdb_id, torrents.info_hash],
            set: {
              title: torrent.title,
              raw_title: torrent.rawTitle,
              source: torrent.source,
              seeders: torrent.seeders,
              size_bytes: torrent.sizeBytes,
              quality: torrent.quality,
              is_hdr: torrent.isHdr ? 1 : 0,
              is_remux: torrent.isRemux ? 1 : 0,
              fetched_at: now,
            },
          });
      }
    }
    await this.upsertLookup(imdbId, provider, result, now);
  }

  private async upsertLookup(
    imdbId: string,
    provider: TorrentProviderName,
    result: LookupResult,
    now: string,
  ): Promise<void> {
    await this.db
      .insert(torrentLookups)
      .values({
        imdb_id: imdbId,
        status: result.status,
        searched_at: now,
        attempt_count: 1,
        result_count: result.torrents.length,
        last_error: result.error ?? null,
        raw_response: result.rawResponse,
        provider,
      })
      .onConflictDoUpdate({
        target: torrentLookups.imdb_id,
        set: {
          status: result.status,
          searched_at: now,
          attempt_count: sql`${torrentLookups.attempt_count} + 1`,
          result_count: result.torrents.length,
          last_error: result.error ?? null,
          raw_response: result.rawResponse,
          provider,
        },
      });
  }

  async totalStored(): Promise<number> {
    const rows = await this.db.select({ n: count() }).from(torrents);
    return Number(rows[0]?.n ?? 0);
  }
}
