import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';

import { databaseFrom } from '@/domain/db/client';
import { setErrorContext } from '@/lib/core/observability/context';

import { ScrapeOrchestrator, ScrapingRepository } from '@/domain/scraping';
import { buildSources } from '@/lib/sources';
import { buildEnricher } from '@/domain/tmdb';
import { browserTransport, genericTransport, withRetry } from '@/lib/transport';

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
    await setErrorContext({
      'job.name': 'scrape',
      'workflow.instance_id': event.instanceId,
    });
    const sources = buildSources(
      browserTransport(this.env.SCRAPINGANT_API_KEY),
      'scrapingant-browser',
    );
    const pageNumbers = event.payload.pageNumbers ?? [1];
    const slugs = event.payload.sourceSlug
      ? [event.payload.sourceSlug]
      : Object.keys(sources);
    const retry = { retries: { limit: 3, delay: '30 seconds' } } as const;

    // Every (source, page) is its own checkpointed `step.do`, run
    // sequentially. Collect the outcomes into entries and fold them into
    // the result map immutably.
    const pairs = slugs.flatMap((slug) =>
      pageNumbers.map((page) => ({ slug, page })),
    );
    const entries = await pairs.reduce<
      Promise<readonly (readonly [string, unknown])[]>
    >(async (accP, { slug, page }) => {
      const acc = await accP;
      const result = await step.do(
        `scrape:${slug}:${page}`,
        retry,
        async () => {
          const orchestrator = new ScrapeOrchestrator(
            new ScrapingRepository(databaseFrom(this.env.DB)),
            sources,
          );
          const [pageResult] = await orchestrator.run({
            sourceSlug: slug,
            pageNumbers: [page],
          });
          return pageResult;
        },
      );
      return [...acc, [`${slug}:${page}`, result] as const];
    }, Promise.resolve([]));
    const scraped = Object.fromEntries(entries);

    // Seed the genre dictionary once (idempotent, one TMDB call at most).
    await step.do('ensure-genres', retry, async () => {
      await buildEnricher(
        databaseFrom(this.env.DB),
        this.env,
        withRetry(genericTransport()),
      ).ensureGenres();
      return { ok: true };
    });

    // Find the movies that still need enrichment and hand each off to its
    // own MovieWorkflow instance. The instance id is the imdb id, so a
    // second dispatch for a movie already in flight is a harmless no-op.
    const pending = await step.do('list-pending', retry, async () =>
      buildEnricher(
        databaseFrom(this.env.DB),
        this.env,
        withRetry(genericTransport()),
      ).listPendingMovieIds(40),
    );

    const dispatched = await pending.reduce<Promise<number>>(
      async (accP, imdbId, slot) => {
        const acc = await accP;
        const created = await step.do(`dispatch:${imdbId}`, async () => {
          try {
            await this.env.MOVIE_WORKFLOW.create({
              id: imdbId,
              // `slot` paces sibling instances by 5min/each after the
              // 24h sleep so they don't stampede ScrapingAnt's one-
              // concurrent free-tier limit.
              params: { imdbId, slot },
            });
            return true;
          } catch (error) {
            // An instance for this movie already exists — idempotent.
            if (
              error instanceof Error &&
              error.message.includes('already exists')
            ) {
              return false;
            }
            throw error;
          }
        });
        return acc + (created ? 1 : 0);
      },
      Promise.resolve(0),
    );

    return { scraped, pending: pending.length, dispatched };
  }
}
