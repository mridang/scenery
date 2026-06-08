/**
 * @packageDocumentation
 *
 * Cloudflare Workflows that drive scenery's background pipeline. Each
 * workflow wraps a class from `src/lib/` and exposes it via a
 * Workflows binding so cron triggers (or any other Worker) can kick
 * off durable, retried runs without holding open Worker invocations.
 *
 * Wire-up:
 *   - `wrangler.jsonc` → `workflows` array binds these classes
 *   - The custom Worker entry (`src/worker.ts`) re-exports them so the
 *     Workflows runtime can find them.
 */

export { EnrichWorkflow } from './enrich';
export type { EnrichWorkflowParams } from './enrich';
export { ScrapeWorkflow } from './scrape';
export type { ScrapeWorkflowParams } from './scrape';
export { TorrentWorkflow } from './torrents';
export type { TorrentWorkflowParams } from './torrents';
