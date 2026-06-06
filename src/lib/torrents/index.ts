import { TorrentLookupManager } from "./manager";
import { ApibayProvider } from "./providers/apibay";
import { TorrentioProvider } from "./providers/torrentio";
import { TorrentRepository } from "./repository";
import type { TorrentRunSummary } from "./repository";
import type { TorrentProvider } from "./types";

export type { TorrentRunSummary } from "./repository";
export type {
  LookupResult,
  ParsedTorrent,
  ResolvedLookup,
  TorrentProvider,
} from "./types";
export { TorrentLookupManager } from "./manager";
export { TorrentRepository } from "./repository";
export { ApibayProvider } from "./providers/apibay";
export { TorrentioProvider } from "./providers/torrentio";

/** Options shared by the torrent entry points. @public */
export interface TorrentLookupOptions {
  /**
   * ScrapingAnt API key. When set, providers route through ScrapingAnt's
   * rotating proxy so the Worker's egress IP can't get banned by a
   * rate-limited upstream (Torrentio).
   */
  scrapingAntKey?: string;
}

// Default provider chain — Torrentio first (deepest catalog), then
// apibay (TPB) as a free fallback with no Cloudflare wall. When a
// ScrapingAnt key is supplied, both go through its rotating proxy.
export function defaultProviders(
  opts: TorrentLookupOptions = {},
): TorrentProvider[] {
  return [
    new TorrentioProvider({ scrapingAntKey: opts.scrapingAntKey }),
    new ApibayProvider({ scrapingAntKey: opts.scrapingAntKey }),
  ];
}

/** {@link TorrentRunSummary} plus whether more candidates remain. @public */
export type TorrentRunResult = TorrentRunSummary & {
  /** True if the per-run candidate cap was hit — more may remain. */
  exhausted: boolean;
};

/**
 * IMDb ids past the 24h gate that still need a torrent lookup. Each
 * becomes one granular workflow step.
 *
 * @public
 */
export async function listTorrentCandidates(
  db: D1Database,
  limit = 50,
  force = false,
): Promise<string[]> {
  return new TorrentRepository(db).candidates(limit, force);
}

/**
 * Look up + persist torrents for ONE movie via the provider chain. One
 * step's worth of work (a handful of subrequests at most).
 *
 * @returns The provider that answered and the lookup status.
 * @public
 */
export async function lookupOneTorrent(
  db: D1Database,
  imdbId: string,
  opts: TorrentLookupOptions = {},
): Promise<{ provider: string; status: string }> {
  const manager = new TorrentLookupManager(defaultProviders(opts));
  const repo = new TorrentRepository(db);
  const resolved = await manager.lookup(imdbId);
  await repo.persist(imdbId, resolved);
  return { provider: resolved.provider, status: resolved.result.status };
}

// Top-level entry point. Walks up to `limit` candidates (each lookup is
// one or more provider subrequests), runs them through the manager,
// persists results, summarises. `limit` doubles as the per-invocation
// subrequest guard: keep it under the platform cap (50 on Free).
export async function runTorrentLookups(
  db: D1Database,
  opts: { limit?: number; providers?: TorrentProvider[] } = {},
): Promise<TorrentRunResult> {
  const providers = opts.providers ?? defaultProviders();
  const manager = new TorrentLookupManager(providers);
  const repo = new TorrentRepository(db);
  const limit = opts.limit ?? 200;

  const candidates = await repo.candidates(limit);
  const summary: TorrentRunSummary = {
    scanned: candidates.length,
    success: 0,
    empty: 0,
    errors: 0,
    totalStored: 0,
    skippedTooFresh: await repo.tooFreshCount(),
    byProvider: {},
  };

  for (const imdbId of candidates) {
    const resolved = await manager.lookup(imdbId);
    await repo.persist(imdbId, resolved);

    summary.byProvider[resolved.provider] =
      (summary.byProvider[resolved.provider] ?? 0) + 1;
    if (resolved.result.status === "success") summary.success++;
    else if (resolved.result.status === "empty") summary.empty++;
    else summary.errors++;
  }

  summary.totalStored = await repo.totalStored();
  // If we filled the candidate page, assume more remain for the next step.
  return { ...summary, exhausted: candidates.length >= limit };
}
