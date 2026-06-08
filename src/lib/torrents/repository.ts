import { sql } from 'drizzle-orm';

import {
  createDatabase,
  type Database,
  torrent_lookups,
  torrents,
} from '@/lib/db';
import type { LookupResult, ResolvedLookup } from './types';

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
    const gate = force
      ? sql``
      : sql`AND (SELECT MAX(COALESCE(r.posted_at, r.first_seen_at))
               FROM releases r WHERE r.imdb_id = m.imdb_id) <= ${cutoff}`;
    const rows = await this.db.all<{ imdb_id: string }>(
      sql`SELECT m.imdb_id
         FROM movies m
         LEFT JOIN torrent_lookups tl ON tl.imdb_id = m.imdb_id
        WHERE (tl.imdb_id IS NULL OR tl.status = 'error')
          ${gate}
        ORDER BY (SELECT MAX(COALESCE(r.posted_at, r.first_seen_at))
                    FROM releases r WHERE r.imdb_id = m.imdb_id) ASC
        LIMIT ${limit}`,
    );
    return rows.map((r) => r.imdb_id);
  }

  async tooFreshCount(): Promise<number> {
    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const row = await this.db.get<{ n: number }>(
      sql`SELECT COUNT(*) AS n FROM movies m
            LEFT JOIN torrent_lookups tl ON tl.imdb_id = m.imdb_id
           WHERE tl.imdb_id IS NULL
             AND (SELECT MAX(COALESCE(r.posted_at, r.first_seen_at))
                    FROM releases r WHERE r.imdb_id = m.imdb_id) > ${cutoff}`,
    );
    return row?.n ?? 0;
  }

  async persist(imdbId: string, resolved: ResolvedLookup): Promise<void> {
    const now = new Date().toISOString();
    const { provider, result } = resolved;
    if (result.status === 'success') {
      for (const t of result.torrents) {
        await this.db
          .insert(torrents)
          .values({
            imdb_id: imdbId,
            info_hash: t.infoHash,
            title: t.title,
            raw_title: t.rawTitle,
            source: t.source,
            seeders: t.seeders,
            size_bytes: t.sizeBytes,
            quality: t.quality,
            is_hdr: t.isHdr ? 1 : 0,
            is_remux: t.isRemux ? 1 : 0,
            fetched_at: now,
          })
          .onConflictDoUpdate({
            target: [torrents.imdb_id, torrents.info_hash],
            set: {
              title: t.title,
              raw_title: t.rawTitle,
              source: t.source,
              seeders: t.seeders,
              size_bytes: t.sizeBytes,
              quality: t.quality,
              is_hdr: t.isHdr ? 1 : 0,
              is_remux: t.isRemux ? 1 : 0,
              fetched_at: now,
            },
          });
      }
    }
    await this.upsertLookup(imdbId, provider, result, now);
  }

  private async upsertLookup(
    imdbId: string,
    provider: string,
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
    const row = await this.db.get<{ n: number }>(
      sql`SELECT COUNT(*) AS n FROM torrents`,
    );
    return row?.n ?? 0;
  }
}
