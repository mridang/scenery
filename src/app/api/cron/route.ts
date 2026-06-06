import type { NextRequest } from "next/server";
import { getDB, getEnv } from "@/lib/db";
import { logError, logInfo } from "@/lib/logging";
import { runSourcePages } from "@/lib/orchestrator";
import { buildSources } from "@/lib/sources";
import { enrichMovies } from "@/lib/tmdb";
import {
  ApibayProvider,
  TorrentioProvider,
  runTorrentLookups,
} from "@/lib/torrents";
import type { TorrentProvider } from "@/lib/torrents";

export const dynamic = "force-dynamic";

const HARDENED_KEYS = new Set([
  "backfill",
  "source",
  "enrichOnly",
  "skipEnrich",
  "skipTorrents",
  "torrentsOnly",
  "torrentProviders",
  "viaWorkflow",
]);

function resolveProviders(spec: string): TorrentProvider[] {
  const out: TorrentProvider[] = [];
  for (const name of spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (name === "torrentio") out.push(new TorrentioProvider());
    else if (name === "apibay") out.push(new ApibayProvider());
  }
  return out;
}

function authorized(request: NextRequest, env: CloudflareEnv): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(request: NextRequest) {
  const env = getEnv();
  if (!authorized(request, env)) {
    logError({
      event: "cron.unauthorized",
      url: request.nextUrl.pathname + request.nextUrl.search,
    });
    return new Response("Unauthorized", { status: 401 });
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
  const url = request.nextUrl;
  const backfill = Number(url.searchParams.get("backfill") ?? "0");
  const sourceParam = url.searchParams.get("source");
  const enrichOnly = url.searchParams.get("enrichOnly") === "1";
  const skipEnrich = url.searchParams.get("skipEnrich") === "1";
  const skipTorrents = url.searchParams.get("skipTorrents") === "1";
  const torrentsOnly = url.searchParams.get("torrentsOnly") === "1";

  // ?source=foo runs just that source; otherwise iterate every registered
  // source so a failure on one (e.g. scnsrc CF block) doesn't lose the run.
  const slugs = sourceParam ? [sourceParam] : Object.keys(buildSources(env));
  const pages =
    backfill > 0 ? Array.from({ length: backfill }, (_, i) => i + 1) : [1];

  // Diagnostic: ?viaWorkflow=enrich|scrape|torrents creates a workflow
  // instance instead of running synchronously. Returns the instance id
  // and status so we can see whether local wrangler actually simulates
  // workflows.
  const viaWorkflow = url.searchParams.get("viaWorkflow");
  if (viaWorkflow) {
    const wf =
      viaWorkflow === "enrich"
        ? env.ENRICH_WORKFLOW
        : viaWorkflow === "scrape"
          ? env.SCRAPE_WORKFLOW
          : viaWorkflow === "torrents"
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
  const pageResults: Record<string, unknown> = {};
  if (!enrichOnly && !torrentsOnly) {
    for (const slug of slugs) {
      try {
        pageResults[slug] = await runSourcePages(db, env, slug, pages);
      } catch (err) {
        pageResults[slug] = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  const enrich =
    skipEnrich || torrentsOnly ? null : await enrichMovies(db, env);
  const providerParam = url.searchParams.get("torrentProviders");
  const torrents = skipTorrents
    ? null
    : await runTorrentLookups(db, {
        providers: providerParam ? resolveProviders(providerParam) : undefined,
      });
  const finishedAt = new Date().toISOString();
  logInfo({
    event: "cron.completed",
    sources: slugs,
    enrichOnly,
    torrentsOnly,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
  });

  // Browser form submits get redirected back so the user sees updated
  // results instead of raw JSON. Programmatic callers (curl, cron,
  // fetch) get JSON as before.
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    const referer = request.headers.get("referer");
    const back =
      referer && new URL(referer).origin === request.nextUrl.origin
        ? referer
        : "/";
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
