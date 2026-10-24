import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '@/core/db/client';
import { type SourceSlug } from '@/utils/enums';
import {
  fetchAttempts,
  movies,
  pageSnapshots,
  releases,
  sources,
} from '../db/schema';

import type { ExtractedRelease } from '@/lib/sources/types';

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
  public constructor(private readonly db: Database) {}

  /**
   * Look up a registered source by its stable slug.
   *
   * @param slug - The source slug (e.g. `scnsrc`).
   * @returns The row, or null if the slug is unknown.
   */
  public async findSource(slug: string): Promise<SourceRow | null> {
    // `slug` is arbitrary input (e.g. a ?source= query param); the cast
    // only satisfies the enum-typed column — an unknown slug simply
    // matches no rows and returns null.
    const row = await this.db
      .select({ id: sources.id, slug: sources.slug })
      .from(sources)
      .where(eq(sources.slug, slug as SourceSlug))
      .get();
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
      .select({
        n: sql<number>`COALESCE(MAX(${fetchAttempts.attempt_number}), 0)`,
      })
      .from(fetchAttempts)
      .where(
        and(
          eq(fetchAttempts.source_id, sourceId),
          eq(fetchAttempts.page_number, pageNumber),
        ),
      )
      .get();
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
    await this.db.insert(fetchAttempts).values({
      source_id: opts.sourceId,
      page_number: opts.pageNumber,
      page_url: opts.pageUrl,
      attempt_number: opts.attemptNumber,
      started_at: opts.startedAt,
      finished_at: opts.finishedAt,
      status: 'failed',
      http_status: opts.httpStatus ?? null,
      error: opts.error ?? null,
      response_body: opts.responseBody ?? null,
    });
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
    const row = await this.db
      .insert(pageSnapshots)
      .values({
        source_id: opts.sourceId,
        page_number: opts.pageNumber,
        page_url: opts.pageUrl,
        fetched_at: opts.fetchedAt,
        fetcher: opts.fetcherLabel,
        http_status: opts.httpStatus ?? null,
        html: opts.html,
        byte_size: opts.byteSize,
        response_headers: opts.responseHeaders
          ? JSON.stringify(opts.responseHeaders)
          : null,
      })
      .returning({ id: pageSnapshots.id })
      .get();
    return Number(row.id);
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
    await this.db.insert(fetchAttempts).values({
      source_id: opts.sourceId,
      page_number: opts.pageNumber,
      page_url: opts.pageUrl,
      attempt_number: opts.attemptNumber,
      started_at: opts.startedAt,
      finished_at: opts.finishedAt,
      status: 'success',
      http_status: opts.httpStatus ?? null,
      snapshot_id: opts.snapshotId,
    });
  }

  /** Upsert one extracted release together with its parent movie row. */
  public async upsertRelease(
    sourceId: number,
    release: ExtractedRelease,
    now: string,
  ): Promise<void> {
    await this.db
      .insert(movies)
      .values({
        imdb_id: release.imdbId,
        first_seen_at: now,
        last_seen_at: now,
      })
      .onConflictDoUpdate({
        target: movies.imdb_id,
        set: { last_seen_at: now },
      });

    await this.db
      .insert(releases)
      .values({
        source_id: sourceId,
        external_id: release.externalId,
        imdb_id: release.imdbId,
        title: release.title,
        url: release.url,
        posted_at: release.postedAt ?? null,
        posted_at_raw: release.postedAtRaw ?? null,
        categories: release.categories
          ? JSON.stringify(release.categories)
          : null,
        author: release.author ?? null,
        image_url: release.imageUrl ?? null,
        excerpt: release.excerpt ?? null,
        post_html: release.postHtml,
        first_seen_at: now,
        last_seen_at: now,
      })
      .onConflictDoUpdate({
        target: [releases.source_id, releases.external_id],
        set: {
          imdb_id: release.imdbId,
          title: release.title,
          url: release.url,
          posted_at: release.postedAt ?? null,
          posted_at_raw: release.postedAtRaw ?? null,
          categories: release.categories
            ? JSON.stringify(release.categories)
            : null,
          author: release.author ?? null,
          image_url: release.imageUrl ?? null,
          excerpt: release.excerpt ?? null,
          post_html: release.postHtml,
          last_seen_at: now,
        },
      });
  }
}
