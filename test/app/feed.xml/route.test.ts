import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

import type { NextRequest } from 'next/server';

import { createTestD1, type TestD1 } from '../../d1';

let harness: TestD1;

beforeAll(async () => {
  harness = await createTestD1();
});
afterAll(async () => {
  await harness.dispose();
});

jest.unstable_mockModule('@/lib/util', () => ({
  getDB: () => harness.db,
  getEnv: () => ({}),
  logInfo: () => undefined,
  logWarn: () => undefined,
  logError: () => undefined,
  safeJsonParse: () => ({ ok: false, error: 'stub' }),
}));

// Keep the feed hermetic: bestTrackers is handed a stub transport that
// never touches the network, so it falls back to the static tracker list.
jest.unstable_mockModule('@/lib/transport', () => {
  const stubFetch = (async () =>
    new Response('', { status: 500 })) as unknown as typeof fetch;
  return {
    genericTransport: () => stubFetch,
    scrapingAntTransport: () => stubFetch,
    browserTransport: () => stubFetch,
    proxyTransport: () => stubFetch,
    withRetry: (t: typeof fetch) => t,
    isRetryableStatus: () => false,
  };
});

const { ScrapingRepository } = await import('@/lib/scraping/repository');
const { GET } = await import('@/app/feed.xml/route');

function req(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

describe('GET /feed.xml', () => {
  // Runs first against the freshly-migrated, empty database.
  it('returns a valid (item-less) RSS document when the catalog is empty', async () => {
    const res = await GET(req('https://x/feed.xml?sort=date'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/rss+xml; charset=utf-8',
    );
    const body = await res.text();
    expect(body).toContain('<rss');
    expect(body).toContain('<channel>');
    expect(body).not.toContain('<item>');
  });

  it('emits at least one <item> once a movie + release are seeded', async () => {
    const src = (await harness.db
      .prepare("SELECT id FROM sources WHERE slug = 'scnsrc'")
      .first()) as { id: number };

    const repo = new ScrapingRepository(harness.db);
    await repo.upsertRelease(
      src.id,
      {
        externalId: '1001',
        imdbId: 'tt1375666',
        title: 'Inception 2010 1080p',
        url: 'https://example.test/inception',
        postedAt: '2026-06-01T00:00:00.000Z',
        postHtml: '<div>Inception</div>',
      },
      new Date().toISOString(),
    );

    // lang=all skips the original_language filter so a release without a
    // TMDB row (NULL language) still surfaces in the feed.
    const res = await GET(req('https://x/feed.xml?sort=date&lang=all'));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('<rss');
    expect(body).toContain('<channel>');
    expect(body).toContain('<item>');
    // With no TMDB row the item title falls back to the release title.
    expect(body).toContain('Inception 2010 1080p');
    expect(body).toContain('tt1375666');
  });
});
