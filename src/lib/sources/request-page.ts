import type { FetchResult } from './types';

/**
 * Fetch a page through an injected transport and normalise the response
 * into a {@link FetchResult}. Transport-agnostic: timeouts, proxying, and
 * retries are the transport's concern — this only reads the body and
 * captures headers. Never throws; transport failures become
 * `{ ok: false }`.
 *
 * @param transport - A `fetch`-compatible transport.
 * @param url - The target URL.
 * @returns A {@link FetchResult}.
 * @public
 */
export async function requestPage(
  transport: typeof fetch,
  url: string,
): Promise<FetchResult> {
  try {
    const resp = await transport(url);
    const html = await resp.text();
    const responseHeaders: Record<string, string> = Object.fromEntries(
      resp.headers.entries(),
    );
    if (!resp.ok) {
      return {
        ok: false,
        httpStatus: resp.status,
        error: `non-2xx from transport: ${resp.status}`,
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
  }
}
