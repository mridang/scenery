import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';

import {
  defaultProviders,
  listTorrentCandidates,
  lookupOneTorrent,
} from '../lib/torrents';
import { proxyTransport } from '../lib/transport';

/**
 * Parameters accepted by {@link TorrentWorkflow}.
 *
 * @public
 */
export interface TorrentWorkflowParams {
  /** Max movies to look up this run. Defaults to 500 (drain the queue). */
  limit?: number;
  /** Bypass the 24h maturity gate (look up everything now). */
  force?: boolean;
  /** Seconds to wait before each lookup, to pace the upstream. Default 3. */
  paceSeconds?: number;
}

/**
 * Granular torrent lookups: one `step.do()` per movie. Each step runs
 * the provider chain (Torrentio → apibay) for a single IMDb id and
 * persists the result — independently retried and checkpointed.
 *
 * @public
 */
export class TorrentWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  TorrentWorkflowParams
> {
  public override async run(
    event: WorkflowEvent<TorrentWorkflowParams>,
    step: WorkflowStep,
  ) {
    // Small batch per instance so the whole run stays well under the
    // per-invocation subrequest cap (8 movies × ≤2 fetches = ≤16 ≪ 50),
    // regardless of how the engine packs steps into invocations. Drain a
    // backlog by triggering the workflow repeatedly — each run picks up
    // the next batch (error + unsearched rows).
    const limit = event.payload.limit ?? 8;
    const force = event.payload.force ?? false;
    const paceSeconds = event.payload.paceSeconds ?? 4;
    const retry = { retries: { limit: 3, delay: '30 seconds' } } as const;

    const imdbIds = await step.do('list-candidates', async () =>
      listTorrentCandidates(this.env.DB, limit, force),
    );

    // One provider chain for the whole run — Torrentio + apibay, routed
    // through ScrapingAnt's rotating proxy when a key is configured.
    const providerChain = defaultProviders(
      proxyTransport(this.env.SCRAPINGANT_API_KEY),
    );

    // Sequential per-movie steps (each preceded by a checkpointing sleep
    // to reset the subrequest budget). Collect the provider used by each
    // lookup, then tally them immutably into the per-provider counts.
    const providers = await imdbIds.reduce<Promise<readonly string[]>>(
      async (accP, imdbId, i) => {
        const acc = await accP;
        // Sleep BEFORE every lookup. Each sleep checkpoints the workflow
        // and resumes it in a fresh Worker invocation — so every lookup
        // runs with a clean per-invocation subrequest budget (can't trip
        // the cap), and the spacing keeps the upstream from rate-limiting.
        if (i > 0) {
          await step.sleep(`pace-${i}`, `${paceSeconds} seconds`);
        }
        const result = await step.do(`torrent:${imdbId}`, retry, async () =>
          lookupOneTorrent(this.env.DB, imdbId, providerChain),
        );
        return [...acc, result.provider];
      },
      Promise.resolve([]),
    );
    const byProvider = providers.reduce<Record<string, number>>(
      (acc, provider) => ({ ...acc, [provider]: (acc[provider] ?? 0) + 1 }),
      {},
    );
    return { candidates: imdbIds.length, byProvider };
  }
}
