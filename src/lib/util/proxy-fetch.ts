/**
 * @packageDocumentation
 *
 * A `fetch` wrapper that can optionally route a request through
 * ScrapingAnt's proxy. Direct requests from a Cloudflare Worker all
 * share one egress IP, so a rate-limited upstream (Torrentio) can ban
 * that single IP. Routing through ScrapingAnt's rotating proxy pool
 * means every request comes from a different IP — no single address
 * ever looks abusive.
 *
 * We use ScrapingAnt's `browser=false` (proxy-only) mode: cheap, no
 * headless rendering, fine for plain JSON endpoints.
 */

/** Normalised response from {@link proxyFetch}. */
export interface ProxyFetchResult {
  /** True when the underlying request returned a 2xx status. */
  readonly ok: boolean;
  /** HTTP status, or undefined on a transport-level failure. */
  readonly status?: number;
  /** Response body as text (the upstream's body when proxied). */
  readonly text: string;
  /** Transport/proxy error message, when {@link ok} is false. */
  readonly error?: string;
}

/** Options for {@link proxyFetch}. */
export interface ProxyFetchOptions {
  /** When set, route via ScrapingAnt proxy instead of a direct fetch. */
  readonly scrapingAntKey?: string;
  /** Request timeout in ms. Defaults to 15 000. */
  readonly timeoutMs?: number;
  /** Value for the Accept header. Defaults to application/json. */
  readonly accept?: string;
}

const ANT_ENDPOINT = 'https://api.scrapingant.com/v2/general';

/** Build the ScrapingAnt proxy URL + headers for `targetUrl`. */
function buildAntRequest(
  targetUrl: string,
  scrapingAntKey: string,
  accept: string,
): { readonly url: URL; readonly headers: Record<string, string> } {
  const url = new URL(ANT_ENDPOINT);
  url.searchParams.set('url', targetUrl);
  url.searchParams.set('browser', 'false'); // proxy-only, cheap
  return {
    url,
    headers: { 'x-api-key': scrapingAntKey, Accept: accept },
  };
}

/**
 * Fetch `targetUrl`, optionally through ScrapingAnt's rotating proxy.
 * Never throws — transport failures come back as `{ ok: false, error }`.
 *
 * @public
 */
export async function proxyFetch(
  targetUrl: string,
  opts: ProxyFetchOptions = {},
): Promise<ProxyFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const accept = opts.accept ?? 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const request = opts.scrapingAntKey
      ? buildAntRequest(targetUrl, opts.scrapingAntKey, accept)
      : ({
          url: targetUrl,
          headers: { Accept: accept },
        } as const);
    const resp = await fetch(request.url, {
      headers: request.headers,
      signal: controller.signal,
    });
    const text = await resp.text();
    return { ok: resp.ok, status: resp.status, text };
  } catch (err) {
    return {
      ok: false,
      text: '',
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
