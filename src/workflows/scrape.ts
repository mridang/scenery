import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';

import { ScrapeOrchestrator, ScrapingRepository } from '../lib/scraping';
import { buildSources } from '../lib/sources';

/**
 * Parameters accepted by {@link ScrapeWorkflow}.
 *
 * @public
 */
export interface ScrapeWorkflowParams {
  /** Source slug; when omitted, every registered source runs. */
  sourceSlug?: string;
  /** Page numbers to scrape. Defaults to `[1]`. */
  pageNumbers?: number[];
}

/**
 * Granular scrape: one `step.do()` per (source, page). Each page is a
 * single ScrapingAnt fetch + its DB writes, independently retried and
 * checkpointed — a failure on page 7 doesn't re-scrape pages 1–6.
 *
 * @public
 */
export class ScrapeWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  ScrapeWorkflowParams
> {
  public override async run(
    event: WorkflowEvent<ScrapeWorkflowParams>,
    step: WorkflowStep,
  ) {
    const sources = buildSources(this.env);
    const pageNumbers = event.payload.pageNumbers ?? [1];
    const slugs = event.payload.sourceSlug
      ? [event.payload.sourceSlug]
      : Object.keys(sources);
    const retry = { retries: { limit: 3, delay: '30 seconds' } } as const;

    const results: Record<string, unknown> = {};
    for (const slug of slugs) {
      for (const page of pageNumbers) {
        results[`${slug}:${page}`] = await step.do(
          `scrape:${slug}:${page}`,
          retry,
          async () => {
            const orchestrator = new ScrapeOrchestrator(
              new ScrapingRepository(this.env.DB),
              sources,
            );
            const [result] = await orchestrator.run({
              sourceSlug: slug,
              pageNumbers: [page],
            });
            return result;
          },
        );
      }
    }
    return results;
  }
}
