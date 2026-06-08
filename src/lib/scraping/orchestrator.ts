import type { Source } from '../sources/types';
import { ScrapingRepository } from './repository';
import type { PageRunResult } from './types';

/**
 * Options for {@link ScrapeOrchestrator#run}.
 *
 * @public
 */
export interface RunOptions {
  /** Source slug to scrape. */
  sourceSlug: string;
  /** Page numbers to scrape. Each is attempted independently. */
  pageNumbers: number[];
}

/**
 * Drives a {@link Source} adapter and writes its output into D1. One
 * instance handles many runs — there is no per-call state.
 *
 * @public
 */
export class ScrapeOrchestrator {
  public constructor(
    private readonly repo: ScrapingRepository,
    private readonly sources: Record<string, Source>,
  ) {}

  /**
   * Scrape a list of pages from one source.
   *
   * @throws When the requested source slug isn't registered or isn't seeded.
   */
  public async run(opts: RunOptions): Promise<PageRunResult[]> {
    const src = this.sources[opts.sourceSlug];
    if (!src) throw new Error(`unknown source: ${opts.sourceSlug}`);
    const srcRow = await this.repo.findSource(src.slug);
    if (!srcRow) {
      throw new Error(`source ${src.slug} not in db; run migrations`);
    }

    const results: PageRunResult[] = [];
    for (const pageNumber of opts.pageNumbers) {
      results.push(await this.runOnePage(src, srcRow.id, pageNumber));
    }
    return results;
  }

  private async runOnePage(
    src: Source,
    sourceId: number,
    pageNumber: number,
  ): Promise<PageRunResult> {
    const pageUrl = src.pageUrl(pageNumber);
    const attemptNumber = await this.repo.nextAttemptNumber(
      sourceId,
      pageNumber,
    );
    const startedAt = new Date().toISOString();
    const result = await src.fetchPage(pageNumber);
    const finishedAt = new Date().toISOString();

    if (!result.ok) {
      await this.repo.insertFailedAttempt({
        sourceId,
        pageNumber,
        pageUrl,
        attemptNumber,
        startedAt,
        finishedAt,
        httpStatus: result.httpStatus,
        error: result.error,
        responseBody: result.html,
      });
      return {
        pageNumber,
        attemptNumber,
        status: 'failed',
        httpStatus: result.httpStatus,
        error: result.error,
      };
    }

    const html = result.html ?? '';
    const snapshotId = await this.repo.insertSnapshot({
      sourceId,
      pageNumber,
      pageUrl,
      fetchedAt: finishedAt,
      fetcherLabel: src.fetcherLabel,
      httpStatus: result.httpStatus,
      html,
      byteSize: result.byteSize,
      responseHeaders: result.responseHeaders,
    });
    await this.repo.insertSuccessfulAttempt({
      sourceId,
      pageNumber,
      pageUrl,
      attemptNumber,
      startedAt,
      finishedAt,
      httpStatus: result.httpStatus,
      snapshotId,
    });

    const releases = src.extract(html);
    const now = new Date().toISOString();
    for (const release of releases) {
      await this.repo.upsertRelease(sourceId, release, now);
    }

    return {
      pageNumber,
      attemptNumber,
      status: 'success',
      httpStatus: result.httpStatus,
      releasesUpserted: releases.length,
      snapshotId,
    };
  }
}
