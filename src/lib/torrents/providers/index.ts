import type { TorrentProvider } from '../types';
import { ApibayProvider } from './apibay';
import { TorrentioProvider } from './torrentio';

export { ApibayProvider } from './apibay';
export { TorrentioProvider } from './torrentio';
export type { ApibayOptions, ProviderOptions } from './types';

/**
 * The default provider chain: Torrentio first (deepest catalog), then
 * apibay (TPB) as a free fallback with no Cloudflare wall.
 *
 * @public
 */
export function defaultProviders(
  transport: typeof fetch,
): readonly TorrentProvider[] {
  return [new TorrentioProvider(transport), new ApibayProvider(transport)];
}
