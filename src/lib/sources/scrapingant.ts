import type { FetchResult } from './types';

/**
 * Minimal HTTP fetcher abstraction. Every source receives an instance via
 * its constructor — Pi this is what makes the orchestrator testable
 * (swap a real ScrapingAnt for a stub returning a recorded HTML page).
 *
 * @public
 */
export interface PageFetcher {
  /**
   * Fetch an arbitrary URL via whatever proxy/anti-bot tier this fetcher
   * implements.
   *
   * @param url - The target URL.
   * @returns A {@link FetchResult}.
   */
  fetch(url: string): Promise<FetchResult>;
  /** Stable identifier persisted on snapshot rows. */
  readonly label: string;
}

/**
 * Options accepted by {@link ScrapingAntFetcher}.
 *
 * @public
 */
export interface ScrapingAntOptions {
  /** API key (required). Throws on construction if missing. */
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 60 000. */
  timeoutMs?: number;
  /** Override the ScrapingAnt endpoint. Defaults to v2/general. */
  endpoint?: string;
  /** Pass-through query params (e.g. proxy_type=residential). */
  extraParams?: Record<string, string>;
}

/**
 * Fetches a URL through ScrapingAnt's browser-rendering tier. Handles
 * timeouts, captures response headers, and never throws for transport
 * failures — they're converted into a {@link FetchResult} with
 * `ok: false`.
 *
 * @public
 */
export class ScrapingAntFetcher implements PageFetcher {
  public readonly label = 'scrapingant-browser';
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly extraParams: Record<string, string>;

  /** @throws When no API key is provided. */
  public constructor(opts: ScrapingAntOptions) {
    if (!opts.apiKey) {
      throw new Error('ScrapingAntFetcher requires apiKey');
    }
    this.apiKey = opts.apiKey;
    this.endpoint = opts.endpoint ?? 'https://api.scrapingant.com/v2/general';
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.extraParams = opts.extraParams ?? {};
  }

  public async fetch(url: string): Promise<FetchResult> {
    const params = new URL(this.endpoint);
    params.searchParams.set('url', url);
    params.searchParams.set('browser', 'true');
    for (const [k, v] of Object.entries(this.extraParams)) {
      params.searchParams.set(k, v);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resp = await globalThis.fetch(params, {
        method: 'GET',
        headers: { 'x-api-key': this.apiKey },
        signal: controller.signal,
      });
      const html = await resp.text();
      const responseHeaders: Record<string, string> = {};
      resp.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      if (!resp.ok) {
        return {
          ok: false,
          httpStatus: resp.status,
          error: `non-2xx from scrapingant: ${resp.status}`,
          html,
          byteSize: html.length,
          responseHeaders,
        };
      }
      return {
        ok: true,
        httpStatus: resp.status,
        html,
        byteSize: html.length,
        responseHeaders,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        byteSize: 0,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
