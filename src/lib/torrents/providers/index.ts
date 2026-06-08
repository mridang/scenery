import type { TorrentProvider } from '../types';
import { ApibayProvider } from './apibay';
import { TorrentioProvider } from './torrentio';

export { ApibayProvider } from './apibay';
export { TorrentioProvider } from './torrentio';
export type { ApibayOptions, ProviderOptions } from './types';

/** Options for {@link defaultProviders}. @public */
export interface ProviderChainOptions {
  /**
   * ScrapingAnt API key. When set, every provider routes through
   * ScrapingAnt's rotating proxy so the Worker's egress IP can't get
   * banned by a rate-limited upstream (Torrentio).
   */
  readonly scrapingAntKey?: string;
}

/**
 * The default provider chain: Torrentio first (deepest catalog), then
 * apibay (TPB) as a free fallback with no Cloudflare wall.
 *
 * @public
 */
export function defaultProviders(
  opts: ProviderChainOptions = {},
): readonly TorrentProvider[] {
  return [
    new TorrentioProvider({ scrapingAntKey: opts.scrapingAntKey }),
    new ApibayProvider({ scrapingAntKey: opts.scrapingAntKey }),
  ];
}
