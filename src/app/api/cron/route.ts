import type { NextRequest } from 'next/server';
import { getDB, getEnv, logError, logInfo } from '@/lib/util';
import { ScrapeOrchestrator, ScrapingRepository } from '@/lib/scraping';
import { buildSources } from '@/lib/sources';
import { buildEnricher } from '@/lib/tmdb';
import { browserTransport, proxyTransport } from '@/lib/transport';
import {
  ApibayProvider,
  TorrentioProvider,
  defaultProviders,
  runTorrentLookups,
} from '@/lib/torrents';
import type { TorrentProvider } from '@/lib/torrents';

export const dynamic = 'force-dynamic';

const HARDENED_KEYS = new Set([
  'backfill',
  'source',
  'enrichOnly',
  'skipEnrich',
  'skipTorrents',
  'torrentsOnly',
  'torrentProviders',
  'viaWorkflow',
]);

function resolveProviders(
  spec: string,
  transport: typeof fetch,
): TorrentProvider[] {
  return spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((name): TorrentProvider[] => {
      if (name === 'torrentio') {
        return [new TorrentioProvider(transport)];
      }
      if (name === 'apibay') {
        return [new ApibayProvider(transport)];
      }
      return [];
    });
}

/**
 * Enrich a small fixed batch synchronously. `/api/cron` is a manual nudge
 * (the real recurring enrichment is the scheduled EnrichWorkflow), so the
 * constant caps keep this one Worker invocation comfortably under the
 * per-invocation subrequest limit — no runtime budget bookkeeping needed.
 */
async function enrichBatch(
  db: D1Database,
  env: CloudflareEnv,
): Promise<{ movies: number; people: number; talentScored: number }> {
  const enricher = buildEnricher(db, env);
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

function authorized(request: NextRequest, env: CloudflareEnv): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return true;
  }
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

async function handle(request: NextRequest) {
  const env = getEnv();
  if (!authorized(request, env)) {
    logError({
      event: 'cron.unauthorized',
      url: request.nextUrl.pathname + request.nextUrl.search,
    });
    return new Response('Unauthorized', { status: 401 });
  }
  // Reject any unknown query params — surfaces typos and stops trivial
  // probing. Anything we genuinely use is in HARDENED_KEYS.
  for (const key of request.nextUrl.searchParams.keys()) {
    if (!HARDENED_KEYS.has(key)) {
      return Response.json(
        { ok: false, error: `unknown query param: ${key}` },
        { status: 400 },
      );
    }
  }

  const db = getDB();
  const sources = buildSources(
    browserTransport(env.SCRAPINGANT_API_KEY),
    'scrapingant-browser',
  );
  const url = request.nextUrl;
  const backfill = Number(url.searchParams.get('backfill') ?? '0');
  const sourceParam = url.searchParams.get('source');
  const enrichOnly = url.searchParams.get('enrichOnly') === '1';
  const skipEnrich = url.searchParams.get('skipEnrich') === '1';
  const skipTorrents = url.searchParams.get('skipTorrents') === '1';
  const torrentsOnly = url.searchParams.get('torrentsOnly') === '1';

  // ?source=foo runs just that source; otherwise iterate every registered
  // source so a failure on one (e.g. scnsrc CF block) doesn't lose the run.
  const slugs = sourceParam ? [sourceParam] : Object.keys(sources);
  const pages =
    backfill > 0 ? Array.from({ length: backfill }, (_, i) => i + 1) : [1];

  // Diagnostic: ?viaWorkflow=enrich|scrape|torrents creates a workflow
  // instance instead of running synchronously. Returns the instance id
  // and status so we can see whether local wrangler actually simulates
  // workflows.
  const viaWorkflow = url.searchParams.get('viaWorkflow');
  if (viaWorkflow) {
    const wf =
      viaWorkflow === 'enrich'
        ? env.ENRICH_WORKFLOW
        : viaWorkflow === 'scrape'
          ? env.SCRAPE_WORKFLOW
          : viaWorkflow === 'torrents'
            ? env.TORRENT_WORKFLOW
            : undefined;
    if (!wf) {
      return Response.json(
        {
          ok: false,
          error: `unknown or unbound workflow: ${viaWorkflow}`,
          envHasBinding: Boolean(wf),
        },
        { status: 400 },
      );
    }
    try {
      const instance = await wf.create({ params: { limit: 5 } });
      return Response.json({
        ok: true,
        viaWorkflow,
        instanceId: instance.id,
        status: await instance.status(),
      });
    } catch (err) {
      return Response.json(
        {
          ok: false,
          viaWorkflow,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        { status: 500 },
      );
    }
  }

  const startedAt = new Date().toISOString();
  // Sequential per-source scrapes (kept sequential on purpose so one
  // source's failure can't take down the rest), accumulated immutably
  // into an entries array that becomes the result map.
  const pageEntries: (readonly [string, unknown])[] =
    enrichOnly || torrentsOnly
      ? []
      : await slugs.reduce<Promise<(readonly [string, unknown])[]>>(
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
        );
  const pageResults: Record<string, unknown> = Object.fromEntries(pageEntries);

  const enrich = skipEnrich || torrentsOnly ? null : await enrichBatch(db, env);
  const providerParam = url.searchParams.get('torrentProviders');
  const torrentTransport = proxyTransport(env.SCRAPINGANT_API_KEY);
  const torrents = skipTorrents
    ? null
    : await runTorrentLookups(db, {
        providers: providerParam
          ? resolveProviders(providerParam, torrentTransport)
          : defaultProviders(torrentTransport),
      });
  const finishedAt = new Date().toISOString();
  logInfo({
    event: 'cron.completed',
    sources: slugs,
    enrichOnly,
    torrentsOnly,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
  });

  // Browser form submits get redirected back so the user sees updated
  // results instead of raw JSON. Programmatic callers (curl, cron,
  // fetch) get JSON as before.
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) {
    const referer = request.headers.get('referer');
    const back =
      referer && new URL(referer).origin === request.nextUrl.origin
        ? referer
        : '/';
    return Response.redirect(back, 303);
  }

  return Response.json({
    sources: slugs,
    startedAt,
    finishedAt,
    pages: pageResults,
    enrich,
    torrents,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
