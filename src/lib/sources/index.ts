import { DdlvalleySource } from './ddlvalley';
import { ScnsrcSource } from './scnsrc';
import { ScrapingAntFetcher } from './scrapingant';
import type { PageFetcher } from './scrapingant';
import type { Source } from './types';

export type { PageFetcher } from './scrapingant';
export { ScrapingAntFetcher } from './scrapingant';
export { DdlvalleySource } from './ddlvalley';
export { ScnsrcSource } from './scnsrc';
export type { ExtractedRelease, FetchResult, Source } from './types';

/**
 * Build a {@link PageFetcher} from environment variables. Single place
 * to swap proxy strategy across every source.
 *
 * @param env - Cloudflare bindings + secrets.
 * @returns A fetcher implementing the {@link PageFetcher} contract.
 * @public
 */
export function buildDefaultFetcher(env: CloudflareEnv): PageFetcher {
  return new ScrapingAntFetcher({ apiKey: env.SCRAPINGANT_API_KEY });
}

/**
 * Build the registered set of sources. Order matters only for status
 * reporting — independent failures don't affect one another.
 *
 * @param env - Cloudflare bindings + secrets.
 * @returns Map of slug → {@link Source}.
 * @public
 */
export function buildSources(env: CloudflareEnv): Record<string, Source> {
  const fetcher = buildDefaultFetcher(env);
  return {
    scnsrc: new ScnsrcSource(fetcher),
    ddlvalley: new DdlvalleySource(fetcher),
  };
}
