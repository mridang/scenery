import {
  buildOptimizedUrl,
  DEFAULT_WIDTH,
} from '../../../lib/img';

export const dynamic = 'force-dynamic';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Generic, abuse-preventable image-proxy redirect.
 *
 * Accepts:
 *   - `src` — fully-qualified HTTPS URL whose host must be in
 *     `ALLOWED_HOSTS` (currently `image.tmdb.org`).
 *   - `w`   — render width; must be one of `ALLOWED_WIDTHS`. Restricting
 *     to a small set prevents cache-pollution by enumerating widths.
 *
 * Returns:
 *   - `301 Moved Permanently` to `/cdn-cgi/image/.../{src}` so the
 *     browser caches the redirect and subsequent loads skip the route
 *     entirely. Cloudflare's image resizer then serves the actual bytes
 *     with its own caching.
 *
 * The page never embeds external image URLs directly — every poster
 * (and future media) goes via this route — which is what lets the CSP
 * lock `img-src` down to `'self'`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const src = url.searchParams.get('src');
  const widthParam = url.searchParams.get('w');
  if (src === null) {
    return Response.json({ ok: false, error: 'missing src' }, { status: 400 });
  }
  const requestedWidth = widthParam ? Number.parseInt(widthParam, 10) : DEFAULT_WIDTH;
  const target = buildOptimizedUrl({ src, width: requestedWidth });
  if (target === null) {
    return Response.json(
      { ok: false, error: 'rejected: host or width not allowed' },
      { status: 400 },
    );
  }
  // Permanent redirect with a long immutable cache. The combination of
  // (src, width) fully determines the response, so the browser and CDN
  // can re-use the redirect freely.
  return new Response(null, {
    status: 301,
    headers: {
      Location: target,
      'Cache-Control': `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
    },
  });
}
