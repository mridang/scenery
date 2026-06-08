/**
 * @packageDocumentation
 *
 * The transport layer. Every lib that makes HTTP requests accepts a
 * `typeof fetch` (the platform's own Fetch interface) and stays ignorant
 * of how bytes move. The concrete providers below — and the `withRetry`
 * decorator — are composed at the edge and injected in.
 */

import { genericTransport } from './providers/generic';
import { scrapingAntTransport } from './providers/scrapingant';

export { genericTransport } from './providers/generic';
export type { GenericTransportOptions } from './providers/generic';
export { scrapingAntTransport } from './providers/scrapingant';
export type { ScrapingAntOptions } from './providers/scrapingant';
export { withRetry, isRetryableStatus } from './retry';
export type { RetryOptions } from './retry';

/**
 * Transport for JSON endpoints that ban a Worker's single egress IP: route
 * through ScrapingAnt's rotating proxy when a key is available, otherwise
 * fall back to a direct request.
 *
 * @public
 */
export function proxyTransport(apiKey: string | undefined): typeof fetch {
  return apiKey
    ? scrapingAntTransport(apiKey, { browser: false })
    : genericTransport();
}

/**
 * Transport for HTML pages behind an anti-bot wall (e.g. Cloudflare): the
 * full ScrapingAnt headless-browser tier, which renders JS and solves
 * challenges. Requires a key — there's no useful direct fallback.
 *
 * @public
 */
export function browserTransport(apiKey: string): typeof fetch {
  return scrapingAntTransport(apiKey, { browser: true });
}
