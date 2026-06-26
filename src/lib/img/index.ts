/**
 * @packageDocumentation
 *
 * Tiny helpers shared between the {@link buildProxyUrl | client-side
 * builder} (used to render `<img>` tags) and the route handler
 * (`/api/img`) that validates incoming queries and constructs the
 * Cloudflare Image Resizing target URL.
 *
 * Why an allowlist? `/cdn-cgi/image/.../<src>` will happily resize any
 * URL — leaving the route open would turn scenery into a free image
 * proxy. Locking it to a small set of hosts keeps the egress predictable.
 */

/** Hosts the proxy is willing to optimise. Anything else returns 400. @public */
export const ALLOWED_HOSTS: ReadonlySet<string> = new Set(['image.tmdb.org']);

/**
 * Valid render widths. Each is a real device-pixel size used by the
 * page; arbitrary widths are rejected so a caller can't iterate every
 * integer to inflate Cloudflare's variant cache.
 * @public
 */
export const ALLOWED_WIDTHS: readonly number[] = [
  92, 154, 185, 342, 500, 780, 1280, 1920, 2560, 3840,
];

/** Default width when a caller omits it. @public */
export const DEFAULT_WIDTH = 185;

/**
 * Validate one query and turn it into the `/cdn-cgi/image/...` target.
 * Returns `null` if the input is rejected.
 * @public
 */
export function buildOptimizedUrl(opts: {
  readonly src: string;
  readonly width: number;
}): string | null {
  const url = parseStrict(opts.src);
  if (url === null) {
    return null;
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return null;
  }
  if (!ALLOWED_WIDTHS.includes(opts.width)) {
    return null;
  }
  // `format=auto` lets Cloudflare pick WebP/AVIF based on Accept; `fit=cover`
  // keeps the aspect ratio of the original poster. We don't pin a quality
  // value — the default is sane and a query-controlled quality would just
  // be another knob to abuse for cache busting.
  return `/cdn-cgi/image/width=${opts.width},format=auto,fit=cover/${url.toString()}`;
}

/**
 * Build the same-origin URL the page should use in an `<img src>`. The
 * query is the bare minimum the route needs; the route does the
 * validation again before redirecting.
 * @public
 */
export function buildProxyUrl(src: string, width = DEFAULT_WIDTH): string {
  return `/api/img?src=${encodeURIComponent(src)}&w=${width}`;
}

function parseStrict(input: string): URL | null {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
