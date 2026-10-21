import { getDB, getEnv, logError, logInfo } from '../../../lib/util';
import { operatorRefusal } from '../../../lib/api/operator-auth';
import { readJsonObject } from '../../../lib/api/json';
import { problems } from '../../../lib/api/problem';
import { parsePipelineRunInput } from '../../../lib/api/pipeline-run-input';
import { ScrapeOrchestrator, ScrapingRepository } from '../../../lib/scraping';
import { buildSources } from '../../../lib/sources';
import { buildEnricher } from '../../../lib/tmdb';
import {
  browserTransport,
  genericTransport,
  proxyTransport,
  withRetry,
} from '../../../lib/transport';
import {
  ApibayProvider,
  TorrentioProvider,
  defaultProviders,
  runTorrentLookups,
} from '../../../lib/torrents';
import type { TorrentProvider } from '../../../lib/torrents';
import type { TorrentProviderName } from '../../../lib/api/pipeline-run-input';

export const dynamic = 'force-dynamic';

function buildProviders(
  names: readonly TorrentProviderName[],
  transport: typeof fetch,
): TorrentProvider[] {
  return names.map((name) =>
    name === 'torrentio'
      ? new TorrentioProvider(transport)
      : new ApibayProvider(transport),
  );
}

/**
 * Enrich a small fixed batch synchronously. A pipeline run is a manual nudge
 * (the real recurring enrichment is the scheduled EnrichWorkflow), so the
 * constant caps keep this one Worker invocation comfortably under the
 * per-invocation subrequest limit — no runtime budget bookkeeping needed.
 */
async function enrichBatch(
  db: D1Database,
  env: CloudflareEnv,
): Promise<{ movies: number; people: number; talentScored: number }> {
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
    talentScored: await enricher.recomputeTalentScoresPublic(),
  };
}

/**
 * `POST /api/pipeline-runs`: run the scrape, TMDB enrich and torrent lookup
 * steps now, in one request, and answer with what each did.
 *
 * The body (JSON, all optional) is `{ source, backfillPages, steps,
 * torrentProviders }`; see `pipeline-run-input.ts`. Answers 200 with the result,
 * 400 for a body that does not check out, 401 when `CRON_SECRET` is set and the
 * bearer token is missing or wrong, and 415/413 for a body that is not JSON or
 * is too large. Nothing is stored, so the run cannot be fetched afterwards.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getEnv();
  const refused = operatorRefusal(request, env.CRON_SECRET);
  if (refused) {
    logError({ event: 'pipeline_runs.unauthorized' });
    return refused;
  }
  const body = await readJsonObject(request, 'The body must be a JSON object.');
  if (!body.ok) {
    return body.response;
  }
  const parsed = parsePipelineRunInput(body.value);
  if (!parsed.ok) {
    return problems.badRequest('The pipeline run is not valid.', parsed.errors);
  }
  const { source, backfillPages, steps, torrentProviders } = parsed.input;

  const db = getDB();
  const sources = buildSources(
    browserTransport(env.SCRAPINGANT_API_KEY),
    'scrapingant-browser',
  );
  // One named source runs alone; otherwise iterate every registered source so
  // a failure on one (e.g. a Cloudflare block) doesn't lose the run.
  const slugs = source ? [source] : Object.keys(sources);
  const pages =
    backfillPages > 0
      ? Array.from({ length: backfillPages }, (_, i) => i + 1)
      : [1];

  const startedAt = new Date().toISOString();
  // Sequential per-source scrapes (kept sequential on purpose so one
  // source's failure can't take down the rest), accumulated immutably
  // into an entries array that becomes the result map.
  const pageEntries: (readonly [string, unknown])[] = steps.has('scrape')
    ? await slugs.reduce<Promise<(readonly [string, unknown])[]>>(
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
            return [
              ...acc,
              [
                slug,
                { error: err instanceof Error ? err.message : String(err) },
              ] as const,
            ];
          }
        },
        Promise.resolve([]),
      )
    : [];
  const pageResults: Record<string, unknown> = Object.fromEntries(pageEntries);

  const enrich = steps.has('enrich') ? await enrichBatch(db, env) : null;
  // apibay needs the ScrapingAnt proxy (it blocks Worker egress IPs).
  // Torrentio is happy with a direct fetch from the Worker, which keeps
  // the common-case torrent lookup off the ScrapingAnt 1-concurrent
  // free-tier budget entirely. The retry wrap absorbs a transient 409
  // ("Free user concurrency limit reached").
  const proxiedTransport = withRetry(proxyTransport(env.SCRAPINGANT_API_KEY), {
    attempts: 6,
    baseDelayMs: 2_000,
    jitterMs: 3_000,
  });
  const directTransport = withRetry(genericTransport());
  const torrents = steps.has('torrents')
    ? await runTorrentLookups(db, {
        providers: torrentProviders
          ? buildProviders(torrentProviders, proxiedTransport)
          : defaultProviders(proxiedTransport, directTransport),
      })
    : null;
  const finishedAt = new Date().toISOString();
  logInfo({
    event: 'pipeline_runs.completed',
    sources: slugs,
    steps: [...steps],
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
  });

  return Response.json(
    {
      sources: slugs,
      startedAt,
      finishedAt,
      pages: pageResults,
      enrich,
      torrents,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
