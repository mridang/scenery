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
  constructor(private readonly db: D1Database) {}

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
      ? ''
      : `AND (SELECT MAX(COALESCE(r.posted_at, r.first_seen_at))
               FROM releases r WHERE r.imdb_id = m.imdb_id) <= ?`;
    const stmt = this.db.prepare(
      `SELECT m.imdb_id
         FROM movies m
         LEFT JOIN torrent_lookups tl ON tl.imdb_id = m.imdb_id
        WHERE (tl.imdb_id IS NULL OR tl.status = 'error')
          ${gate}
        ORDER BY (SELECT MAX(COALESCE(r.posted_at, r.first_seen_at))
                    FROM releases r WHERE r.imdb_id = m.imdb_id) ASC
        LIMIT ?`,
    );
    const { results } = force
      ? await stmt.bind(limit).all<{ imdb_id: string }>()
      : await stmt.bind(cutoff, limit).all<{ imdb_id: string }>();
    return (results ?? []).map((r) => r.imdb_id);
  }

  async tooFreshCount(): Promise<number> {
    const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString();
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM movies m
            LEFT JOIN torrent_lookups tl ON tl.imdb_id = m.imdb_id
           WHERE tl.imdb_id IS NULL
             AND (SELECT MAX(COALESCE(r.posted_at, r.first_seen_at))
                    FROM releases r WHERE r.imdb_id = m.imdb_id) > ?`,
      )
      .bind(cutoff)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async persist(imdbId: string, resolved: ResolvedLookup): Promise<void> {
    const now = new Date().toISOString();
    const { provider, result } = resolved;
    if (result.status === 'success') {
      for (const t of result.torrents) {
        await this.db
          .prepare(
            `INSERT INTO torrents
                (imdb_id, info_hash, title, raw_title, source, seeders,
                 size_bytes, quality, is_hdr, is_remux, fetched_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(imdb_id, info_hash) DO UPDATE SET
                  title       = excluded.title,
                  raw_title   = excluded.raw_title,
                  source      = excluded.source,
                  seeders     = excluded.seeders,
                  size_bytes  = excluded.size_bytes,
                  quality     = excluded.quality,
                  is_hdr      = excluded.is_hdr,
                  is_remux    = excluded.is_remux,
                  fetched_at  = excluded.fetched_at`,
          )
          .bind(
            imdbId,
            t.infoHash,
            t.title,
            t.rawTitle,
            t.source,
            t.seeders,
            t.sizeBytes,
            t.quality,
            t.isHdr ? 1 : 0,
            t.isRemux ? 1 : 0,
            now,
          )
          .run();
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
      .prepare(
        `INSERT INTO torrent_lookups
            (imdb_id, status, searched_at, attempt_count, result_count,
             last_error, raw_response, provider)
              VALUES (?, ?, ?, 1, ?, ?, ?, ?)
            ON CONFLICT(imdb_id) DO UPDATE SET
              status        = excluded.status,
              searched_at   = excluded.searched_at,
              attempt_count = torrent_lookups.attempt_count + 1,
              result_count  = excluded.result_count,
              last_error    = excluded.last_error,
              raw_response  = excluded.raw_response,
              provider      = excluded.provider`,
      )
      .bind(
        imdbId,
        result.status,
        now,
        result.torrents.length,
        result.error ?? null,
        result.rawResponse,
        provider,
      )
      .run();
  }

  async totalStored(): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM torrents`)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }
}
