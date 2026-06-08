import type { ExtractedRelease } from '../sources/types';

/**
 * Row shape for a registered source in the `sources` table.
 *
 * @public
 */
export interface SourceRow {
  id: number;
  slug: string;
}

/**
 * Database access for the scraping pipeline. Every write the pipeline
 * makes — attempts, snapshots, releases, catalog-level movies — is
 * routed through this single class. Keeps the orchestrator unaware of
 * the underlying schema.
 *
 * @public
 */
export class ScrapingRepository {
  public constructor(private readonly db: D1Database) {}

  /**
   * Look up a registered source by its stable slug.
   *
   * @param slug - The source slug (e.g. `scnsrc`).
   * @returns The row, or null if the slug is unknown.
   */
  public async findSource(slug: string): Promise<SourceRow | null> {
    const row = await this.db
      .prepare(`SELECT id, slug FROM sources WHERE slug = ?`)
      .bind(slug)
      .first<SourceRow>();
    return row ?? null;
  }

  /**
   * Compute the next attempt number for a (source, page) pair.
   *
   * @param sourceId - PK of the source row.
   * @param pageNumber - One-based page index.
   * @returns The attempt number to use for the next write.
   */
  public async nextAttemptNumber(
    sourceId: number,
    pageNumber: number,
  ): Promise<number> {
    const row = await this.db
      .prepare(
        `SELECT COALESCE(MAX(attempt_number), 0) AS n
           FROM fetch_attempts
          WHERE source_id = ? AND page_number = ?`,
      )
      .bind(sourceId, pageNumber)
      .first<{ n: number }>();
    return (row?.n ?? 0) + 1;
  }

  /** Record a failed attempt, including any partial body we received. */
  public async insertFailedAttempt(opts: {
    sourceId: number;
    pageNumber: number;
    pageUrl: string;
    attemptNumber: number;
    startedAt: string;
    finishedAt: string;
    httpStatus?: number;
    error?: string;
    responseBody?: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO fetch_attempts
            (source_id, page_number, page_url, attempt_number, started_at,
             finished_at, status, http_status, error, response_body)
          VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?, ?)`,
      )
      .bind(
        opts.sourceId,
        opts.pageNumber,
        opts.pageUrl,
        opts.attemptNumber,
        opts.startedAt,
        opts.finishedAt,
        opts.httpStatus ?? null,
        opts.error ?? null,
        opts.responseBody ?? null,
      )
      .run();
  }

  /** Persist a successful page snapshot and return its PK. */
  public async insertSnapshot(opts: {
    sourceId: number;
    pageNumber: number;
    pageUrl: string;
    fetchedAt: string;
    fetcherLabel: string;
    httpStatus?: number;
    html: string;
    byteSize: number;
    responseHeaders?: Record<string, string>;
  }): Promise<number> {
    const result = await this.db
      .prepare(
        `INSERT INTO page_snapshots
            (source_id, page_number, page_url, fetched_at, fetcher,
             http_status, html, byte_size, response_headers)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        opts.sourceId,
        opts.pageNumber,
        opts.pageUrl,
        opts.fetchedAt,
        opts.fetcherLabel,
        opts.httpStatus ?? null,
        opts.html,
        opts.byteSize,
        opts.responseHeaders ? JSON.stringify(opts.responseHeaders) : null,
      )
      .run();
    return Number(result.meta.last_row_id);
  }

  /** Record a successful attempt linked to a snapshot row. */
  public async insertSuccessfulAttempt(opts: {
    sourceId: number;
    pageNumber: number;
    pageUrl: string;
    attemptNumber: number;
    startedAt: string;
    finishedAt: string;
    httpStatus?: number;
    snapshotId: number;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO fetch_attempts
            (source_id, page_number, page_url, attempt_number, started_at,
             finished_at, status, http_status, snapshot_id)
          VALUES (?, ?, ?, ?, ?, ?, 'success', ?, ?)`,
      )
      .bind(
        opts.sourceId,
        opts.pageNumber,
        opts.pageUrl,
        opts.attemptNumber,
        opts.startedAt,
        opts.finishedAt,
        opts.httpStatus ?? null,
        opts.snapshotId,
      )
      .run();
  }

  /** Upsert one extracted release together with its parent movie row. */
  public async upsertRelease(
    sourceId: number,
    release: ExtractedRelease,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO movies (imdb_id, first_seen_at, last_seen_at)
              VALUES (?, ?, ?)
            ON CONFLICT(imdb_id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
      )
      .bind(release.imdbId, now, now)
      .run();

    await this.db
      .prepare(
        `INSERT INTO releases
            (source_id, external_id, imdb_id, title, url,
             posted_at, posted_at_raw, categories, author, image_url,
             excerpt, post_html, first_seen_at, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_id, external_id) DO UPDATE SET
            imdb_id       = excluded.imdb_id,
            title         = excluded.title,
            url           = excluded.url,
            posted_at     = excluded.posted_at,
            posted_at_raw = excluded.posted_at_raw,
            categories    = excluded.categories,
            author        = excluded.author,
            image_url     = excluded.image_url,
            excerpt       = excluded.excerpt,
            post_html     = excluded.post_html,
            last_seen_at  = excluded.last_seen_at`,
      )
      .bind(
        sourceId,
        release.externalId,
        release.imdbId,
        release.title,
        release.url,
        release.postedAt ?? null,
        release.postedAtRaw ?? null,
        release.categories ? JSON.stringify(release.categories) : null,
        release.author ?? null,
        release.imageUrl ?? null,
        release.excerpt ?? null,
        release.postHtml,
        now,
        now,
      )
      .run();
  }
}
