import type { NextRequest } from 'next/server';
import { bestTrackers, buildMagnet, isValidInfoHash } from '@/lib/torrents';
import { genericTransport, withRetry } from '@/lib/transport';

export const dynamic = 'force-dynamic';

/**
 * Magnet resolver. The home page links each download here rather than
 * embedding a full magnet URI: on click we fetch the current best
 * tracker list and 302-redirect to a freshly-built `magnet:` link, which
 * the browser hands to the OS torrent handler.
 *
 * `Response.redirect` rejects non-HTTP targets, so the redirect is built
 * by hand with a `Location: magnet:` header.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await ctx.params;
  if (!isValidInfoHash(hash)) {
    return new Response('Invalid info hash.', { status: 400 });
  }
  const name = request.nextUrl.searchParams.get('dn');
  const trackers = await bestTrackers(withRetry(genericTransport()));
  return new Response(null, {
    status: 302,
    headers: {
      Location: buildMagnet(hash, name, trackers),
      'Cache-Control': 'no-store',
    },
  });
}
