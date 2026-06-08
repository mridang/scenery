import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { NextRequest } from 'next/server';

import { resetTrackerCache } from '../../src/lib/torrents/magnet';

// The endpoint reaches the network via the transport layer; stub the
// whole transport module so bestTrackers() reads a controlled body
// instead of hitting cf.trackerslist.com.
const fakeFetch = (() =>
  Promise.resolve(
    new Response('udp://test-tracker:1337/announce\n'),
  )) as unknown as typeof fetch;

jest.unstable_mockModule('@/lib/transport', () => ({
  genericTransport: () => fakeFetch,
  scrapingAntTransport: () => fakeFetch,
  browserTransport: () => fakeFetch,
  proxyTransport: () => fakeFetch,
  withRetry: (f: typeof fetch) => f,
  isRetryableStatus: () => false,
}));

const { GET } = await import('@/app/magnet/[hash]/route');

const VALID = 'a'.repeat(40);

function req(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}
function ctx(hash: string): { params: Promise<{ hash: string }> } {
  return { params: Promise.resolve({ hash }) };
}

describe('GET /magnet/[hash]', () => {
  beforeEach(() => resetTrackerCache());

  it('rejects an invalid info hash with 400', async () => {
    const res = await GET(
      req('https://x/magnet/not-a-hash'),
      ctx('not-a-hash'),
    );
    expect(res.status).toBe(400);
  });

  it('302-redirects a valid hash to a magnet URI with live trackers', async () => {
    const res = await GET(req(`https://x/magnet/${VALID}`), ctx(VALID));
    expect(res.status).toBe(302);
    const loc = res.headers.get('location') ?? '';
    expect(loc.startsWith(`magnet:?xt=urn:btih:${VALID}`)).toBe(true);
    expect(loc).toContain('tr=udp%3A%2F%2Ftest-tracker%3A1337%2Fannounce');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('includes an encoded display name from ?dn', async () => {
    const res = await GET(
      req(`https://x/magnet/${VALID}?dn=My%20Movie`),
      ctx(VALID),
    );
    expect(res.headers.get('location')).toContain('dn=My%20Movie');
  });
});
