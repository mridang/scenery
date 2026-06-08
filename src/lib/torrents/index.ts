import { TorrentLookupManager } from './manager';
import { defaultProviders } from './providers';
import { TorrentRepository } from './repository';
import type { TorrentRunSummary } from './repository';
import type { LookupStatus, ResolvedLookup, TorrentProvider } from './types';

export {
  ApibayProvider,
  TorrentioProvider,
  defaultProviders,
} from './providers';
export type {
  ApibayOptions,
  ProviderChainOptions,
  ProviderOptions,
} from './providers';
export { TorrentLookupManager } from './manager';
export { TorrentRepository } from './repository';
export type { TorrentRunSummary } from './repository';
export type {
  LookupResult,
  LookupStatus,
  ParsedTorrent,
  ResolvedLookup,
  TorrentProvider,
} from './types';

/** Options shared by the torrent entry points. @public */
export interface TorrentLookupOptions {
  /**
   * ScrapingAnt API key. When set, providers route through ScrapingAnt's
   * rotating proxy so the Worker's egress IP can't get banned by a
   * rate-limited upstream (Torrentio).
   */
  readonly scrapingAntKey?: string;
}

/** {@link TorrentRunSummary} plus whether more candidates remain. @public */
export type TorrentRunResult = TorrentRunSummary & {
  /** True if the per-run candidate cap was hit — more may remain. */
  readonly exhausted: boolean;
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
  const manager = new TorrentLookupManager(
    defaultProviders({ scrapingAntKey: opts.scrapingAntKey }),
  );
  const repo = new TorrentRepository(db);
  const resolved = await manager.lookup(imdbId);
  await repo.persist(imdbId, resolved);
  return { provider: resolved.provider, status: resolved.result.status };
}

/**
 * Top-level entry point. Walks up to `limit` candidates (each lookup is
 * one or more provider subrequests), runs them through the manager,
 * persists results, summarises. `limit` doubles as the per-invocation
 * subrequest guard: keep it under the platform cap (50 on Free).
 *
 * @public
 */
export async function runTorrentLookups(
  db: D1Database,
  opts: {
    readonly limit?: number;
    readonly providers?: readonly TorrentProvider[];
  } = {},
): Promise<TorrentRunResult> {
  const providers = opts.providers ?? defaultProviders();
  const manager = new TorrentLookupManager(providers);
  const repo = new TorrentRepository(db);
  const limit = opts.limit ?? 200;

  const candidates = await repo.candidates(limit);
  const skippedTooFresh = await repo.tooFreshCount();

  // Sequential awaited IO: each lookup + persist runs in order (subrequest
  // budget), accumulating the resolved outcomes immutably.
  const resolvedList = await candidates.reduce<
    Promise<readonly ResolvedLookup[]>
  >(async (accP, imdbId) => {
    const acc = await accP;
    const resolved = await manager.lookup(imdbId);
    await repo.persist(imdbId, resolved);
    return [...acc, resolved];
  }, Promise.resolve([]));

  const countOf = (status: LookupStatus): number =>
    resolvedList.filter((r) => r.result.status === status).length;
  const byProvider = Object.fromEntries(
    Object.entries(Object.groupBy(resolvedList, (r) => r.provider)).map(
      ([provider, group]) => [provider, group?.length ?? 0],
    ),
  );

  return {
    scanned: candidates.length,
    success: countOf('success'),
    empty: countOf('empty'),
    errors: countOf('error'),
    totalStored: await repo.totalStored(),
    skippedTooFresh,
    byProvider,
    // If we filled the candidate page, assume more remain for the next step.
    exhausted: candidates.length >= limit,
  };
}
