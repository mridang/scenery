import { and, asc, count, eq, gt, lte, ne, notExists, sql } from 'drizzle-orm';

import {
  createDatabase,
  type Database,
  movies,
  releases,
  torrent_lookups,
  torrents,
} from '../db';
import type {
  LookupResult,
  ResolvedLookup,
  TorrentProviderName,
} from './types';

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
  private readonly db: Database;

  constructor(d1: D1Database) {
    this.db = createDatabase(d1);
  }

  // IDs to look up: movies whose newest release was POSTED at least 24h
  // ago (seeders accumulate from public-post time, not from when we
  // happened to scrape it) and that haven't been successfully looked up.
  // `force` bypasses the maturity gate entirely.
  //
  // We gate on MAX(posted_at) across the movie's releases, falling back
  // to the movie's first_seen_at when a source didn't expose a date.
  async candidates(limit: number, force = false): Promise<string[]> {
    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const newestRelease = sql`(SELECT MAX(COALESCE(${releases.posted_at}, ${releases.first_seen_at}))
               FROM ${releases} WHERE ${releases.imdb_id} = ${movies.imdb_id})`;
    const freshness = force ? undefined : lte(newestRelease, cutoff);
    const rows = await this.db
      .select({ imdb_id: movies.imdb_id })
      .from(movies)
      .where(
        and(
          notExists(
            this.db
              .select({ one: torrent_lookups.imdb_id })
              .from(torrent_lookups)
              .where(
                and(
                  eq(torrent_lookups.imdb_id, movies.imdb_id),
                  ne(torrent_lookups.status, 'error'),
                ),
              ),
          ),
          freshness,
        ),
      )
      .orderBy(asc(newestRelease))
      .limit(limit);
    return rows.map((row) => row.imdb_id);
  }

  async tooFreshCount(): Promise<number> {
    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const newestRelease = sql`(SELECT MAX(COALESCE(${releases.posted_at}, ${releases.first_seen_at}))
               FROM ${releases} WHERE ${releases.imdb_id} = ${movies.imdb_id})`;
    const rows = await this.db
      .select({ n: count() })
      .from(movies)
      .where(
        and(
          notExists(
            this.db
              .select({ one: torrent_lookups.imdb_id })
              .from(torrent_lookups)
              .where(eq(torrent_lookups.imdb_id, movies.imdb_id)),
          ),
          gt(newestRelease, cutoff),
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
      .insert(torrent_lookups)
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
        target: torrent_lookups.imdb_id,
        set: {
          status: result.status,
          searched_at: now,
          attempt_count: sql`${torrent_lookups.attempt_count} + 1`,
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
