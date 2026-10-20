import { beforeAll, describe, expect, it, jest } from '@jest/globals';

import type { NextRequest } from 'next/server';

import { APP_MIGRATIONS } from '../../lib/db/migrations';
import { sqliteD1 } from '../../lib/db/sqlite-d1';

let d1: D1Database;

beforeAll(() => {
  d1 = sqliteD1(...APP_MIGRATIONS).d1;
});

jest.unstable_mockModule('../../../src/lib/util', () => ({
  getDB: () => d1,
  getEnv: () => ({}),
  logInfo: () => undefined,
  logWarn: () => undefined,
  logError: () => undefined,
  safeJsonParse: () => ({ ok: false, error: 'stub' }),
}));

// Keep the feed hermetic: bestTrackers is handed a stub transport that
// never touches the network, so it falls back to the static tracker list.
jest.unstable_mockModule('../../../src/lib/transport', () => {
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

const { ScrapingRepository } =
  await import('../../../src/lib/scraping/repository');
const { GET } = await import('../../../src/app/feed.xml/route');

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
    const src = (await d1
      .prepare("SELECT id FROM sources WHERE slug = 'scnsrc'")
      .first()) as { id: number };

    const repo = new ScrapingRepository(d1);
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
