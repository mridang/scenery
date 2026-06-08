import { ScrapeOrchestrator, ScrapingRepository } from './scraping';
import type { PageRunResult } from './scraping';
import { buildSources } from './sources';

export type { PageRunResult } from './scraping';

/**
 * Back-compat helper for callers that still use the functional API.
 * New code should construct {@link ScrapeOrchestrator} directly.
 *
 * @deprecated Use {@link ScrapeOrchestrator}.
 * @public
 */
export async function runSourcePages(
  db: D1Database,
  env: CloudflareEnv,
  sourceSlug: string,
  pageNumbers: number[],
): Promise<PageRunResult[]> {
  const orch = new ScrapeOrchestrator(
    new ScrapingRepository(db),
    buildSources(env),
  );
  return orch.run({ sourceSlug, pageNumbers });
}
