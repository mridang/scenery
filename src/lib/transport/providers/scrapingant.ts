/**
 * @packageDocumentation
 *
 * A transport that routes every request through ScrapingAnt. Direct
 * requests from a Cloudflare Worker all share one egress IP, so a
 * rate-limited or bot-walled upstream can block that single address.
 * ScrapingAnt fans requests out across a rotating proxy pool (and, in
 * browser mode, renders the page through a real headless browser).
 */

/** Options for {@link scrapingAntTransport}. @public */
export interface ScrapingAntOptions {
  /**
   * `true` runs the full headless-browser tier (executes JS, defeats
   * Cloudflare challenges) — needed for HTML scraping. `false` (default)
   * is the cheap rotating-proxy tier, enough for plain JSON endpoints
   * whose only problem is per-IP rate limits.
   */
  readonly browser?: boolean;
  /** Per-request timeout in ms. Defaults to 60 000 (browser) / 15 000. */
  readonly timeoutMs?: number;
  /** Override the ScrapingAnt endpoint. */
  readonly endpoint?: string;
  /** Extra ScrapingAnt query params (e.g. `proxy_type=residential`). */
  readonly extraParams?: Readonly<Record<string, string>>;
}

const DEFAULT_ENDPOINT = 'https://api.scrapingant.com/v2/general';

/**
 * Build a {@link fetch}-compatible transport that proxies through
 * ScrapingAnt. The returned function rewrites the request's target URL
 * into a ScrapingAnt call and returns the upstream {@link Response}.
 *
 * @throws When `apiKey` is empty.
 * @public
 */
export function scrapingAntTransport(
  apiKey: string,
  opts: ScrapingAntOptions = {},
): typeof fetch {
  if (!apiKey) {
    throw new Error('scrapingAntTransport requires an API key');
  }
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;
  const browser = opts.browser ?? false;
  const timeoutMs = opts.timeoutMs ?? (browser ? 60_000 : 15_000);
  const extraParams = opts.extraParams ?? {};

  return (input, init) => {
    const target =
      typeof input === 'string' || input instanceof URL
        ? input.toString()
        : input.url;
    const url = new URL(endpoint);
    url.searchParams.set('url', target);
    url.searchParams.set('browser', String(browser));
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }

    const headers = new Headers(init?.headers);
    headers.set('x-api-key', apiKey);

    return globalThis.fetch(url, {
      method: 'GET',
      headers,
      signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
    });
  };
}
