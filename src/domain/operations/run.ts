/**
 * @packageDocumentation
 *
 * Doing what an operation asks for. Each operation is the work the manual
 * triggers used to do: a pipeline run (scrape, enrich, look up torrents), an
 * OMDB backfill, a start of the daily notification. They run to the end inside
 * the request, and what they return is stored as the operation's result
 * (snake_case, as the API shows it).
 */

import type { Database } from '@/domain/db/client';
import { OmdbEnricher } from '../omdb';
import { ScrapeOrchestrator, ScrapingRepository } from '../scraping';
import { buildSources } from '@/lib/sources';
import { buildEnricher } from '../tmdb';
import { runTorrentLookups } from '../torrents';
import {
  ApibayProvider,
  TorrentioProvider,
  defaultProviders,
} from '@/lib/torrents';
import type { TorrentProvider } from '@/lib/torrents';
import {
  browserTransport,
  genericTransport,
  proxyTransport,
  withRetry,
} from '@/lib/transport';
import { errorMessage, logInfo } from '@/utils/logging';
import type { TorrentProviderName } from '@/lib/torrents/types';
import type { OperationRequest, PipelineRunParameters } from './types';

/** What an operation needs from the Worker. */
export interface OperationDeps {
  readonly db: Database;
  readonly env: CloudflareEnv;
}

/** The providers named, each reaching the world through `transport`. */
function providersFor(
  names: readonly TorrentProviderName[],
  transport: typeof fetch,
): TorrentProvider[] {
  return names.map((name) =>
    name === 'torrentio'
      ? new TorrentioProvider({}, transport)
      : new ApibayProvider({}, transport),
  );
}

/**
 * Enrich a small fixed batch. The caps keep one Worker invocation comfortably
 * under the per-invocation subrequest limit, with no runtime budget
 * bookkeeping; the real recurring enrichment is the scheduled EnrichWorkflow.
 */
async function enrichBatch(
  db: Database,
  env: CloudflareEnv,
): Promise<{ movies: number; people: number; talent_scored: number }> {
  const enricher = buildEnricher(db, env, withRetry(genericTransport()));
  await enricher.ensureGenres();
  const movieIds = await enricher.listPendingMovieIds(12);
  for (const imdbId of movieIds) {
    await enricher.enrichMovie(imdbId);
  }
  await enricher.backfillFromRawCredits();
  const peopleIds = await enricher.listPendingPeopleIds(12);
  for (const personId of peopleIds) {
    await enricher.enrichPerson(personId);
  }
  return {
    movies: movieIds.length,
    people: peopleIds.length,
    talent_scored: await enricher.recomputeTalentScoresPublic(),
  };
}

/** Scrape the sources, one after another so one failing cannot lose the rest. */
async function scrape(
  db: Database,
  env: CloudflareEnv,
  parameters: PipelineRunParameters,
  slugs: readonly string[],
): Promise<Record<string, unknown>> {
  const sources = buildSources(
    browserTransport(env.SCRAPINGANT_API_KEY),
    'scrapingant-browser',
  );
  const pages =
    parameters.backfill_pages > 0
      ? Array.from({ length: parameters.backfill_pages }, (_, i) => i + 1)
      : [1];
  const entries = await slugs.reduce<Promise<(readonly [string, unknown])[]>>(
    async (accP, slug) => {
      const acc = await accP;
      const orchestrator = new ScrapeOrchestrator(
        new ScrapingRepository(db),
        sources,
      );
      try {
        const result = await orchestrator.run({
          sourceSlug: slug,
          pageNumbers: pages,
        });
        return [...acc, [slug, result] as const];
      } catch (err) {
        return [...acc, [slug, { error: errorMessage(err) }] as const];
      }
    },
    Promise.resolve([]),
  );
  return Object.fromEntries(entries);
}

/** A pipeline run: the steps asked for, in order. */
async function pipelineRun(
  { db, env }: OperationDeps,
  parameters: PipelineRunParameters,
): Promise<Record<string, unknown>> {
  const startedAt = new Date().toISOString();
  const sourceSlugs = Object.keys(
    buildSources(
      browserTransport(env.SCRAPINGANT_API_KEY),
      'scrapingant-browser',
    ),
  );
  const slugs = parameters.source ? [parameters.source] : sourceSlugs;
  const pages = parameters.steps.includes('scrape')
    ? await scrape(db, env, parameters, slugs)
    : {};
  const enrich = parameters.steps.includes('enrich')
    ? await enrichBatch(db, env)
    : undefined;
  let torrents: unknown;
  if (parameters.steps.includes('torrents')) {
    // apibay needs the ScrapingAnt proxy (it blocks Worker egress IPs).
    // Torrentio is happy with a direct fetch from the Worker, which keeps the
    // common-case torrent lookup off the ScrapingAnt 1-concurrent free-tier
    // budget entirely. The retry wrap absorbs a transient 409 ("Free user
    // concurrency limit reached").
    const proxied = withRetry(proxyTransport(env.SCRAPINGANT_API_KEY), {
      attempts: 6,
      baseDelayMs: 2_000,
      jitterMs: 3_000,
    });
    const direct = withRetry(genericTransport());
    torrents = await runTorrentLookups(db, {
      providers: parameters.torrent_providers
        ? providersFor(parameters.torrent_providers, proxied)
        : defaultProviders(proxied, direct),
    });
  }
  const finishedAt = new Date().toISOString();
  logInfo({
    event: 'operations.pipeline_run.completed',
    sources: slugs,
    steps: [...parameters.steps],
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
  });
  return {
    sources: slugs,
    started_at: startedAt,
    finished_at: finishedAt,
    pages,
    enrich,
    torrents,
  };
}

/** Run the operation asked for and return its result. Throws when it fails. */
export async function runOperation(
  request: OperationRequest,
  deps: OperationDeps,
): Promise<unknown> {
  switch (request.type) {
    case 'pipeline_run':
      return pipelineRun(deps, request.parameters);
    case 'omdb_backfill': {
      const enricher = new OmdbEnricher(deps.db, {
        apiKey: deps.env.OMDB_API_KEY,
        transport: withRetry(globalThis.fetch),
      });
      const swept = await enricher.sweepPending(request.parameters.limit);
      return {
        limit: request.parameters.limit,
        scanned: swept.scanned,
        found: swept.found,
        not_found: swept.notFound,
        errored: swept.errored,
      };
    }
    case 'push_trigger': {
      const instance = await deps.env.NOTIFY_WORKFLOW.create({ params: {} });
      return { instance_id: instance.id, status: await instance.status() };
    }
  }
}
