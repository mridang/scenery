import type { TorrentProvider } from '../types';
import { ApibayProvider } from './apibay';
import { TorrentioProvider } from './torrentio';

export { ApibayProvider } from './apibay';
export { TorrentioProvider } from './torrentio';
export type { ApibayOptions, ProviderOptions } from './types';

/**
 * The default provider chain: Torrentio first (deepest catalog), then
 * apibay (TPB) as a free fallback.
 *
 * Torrentio answers fine from a Cloudflare-Worker egress IP, so it gets
 * the direct transport. apibay blocks Worker IPs and needs the proxied
 * one. Splitting the transports means we only spend our ScrapingAnt
 * 1-concurrent free-tier budget on the cases where the primary provider
 * misses — Torrentio successes (the common case) cost zero ScrapingAnt
 * calls.
 *
 * @param proxied  Wrapped transport routing via ScrapingAnt (geoblocked
 *                 endpoints).
 * @param direct   Transport that hits the upstream directly. Defaults to
 *                 the proxied one so existing callers keep working.
 * @public
 */
export function defaultProviders(
  proxied: typeof fetch,
  direct: typeof fetch = proxied,
): readonly TorrentProvider[] {
  return [new TorrentioProvider(direct), new ApibayProvider(proxied)];
}
