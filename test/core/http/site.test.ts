import { describe, expect, it } from '@jest/globals';

import {
  CACHED_QUERY_PARAMS,
  EDGE_CACHED_PAGES,
  EDGE_TTL_SECONDS,
  EXTRA_DIRECTIVES,
  EXTRA_IMG_SOURCES,
  OPEN_FILES,
  PUBLIC_PAGES,
  RARELY_CHANGING,
} from '@/core/http/site';

describe('site settings', () => {
  it('lets the edge keep the catalog page and its feed, though nothing is indexed', () => {
    expect([...EDGE_CACHED_PAGES].sort()).toEqual(['/', '/feed.xml']);
  });

  it('lets a kept page carry only the names the catalog page reads', () => {
    expect([...CACHED_QUERY_PARAMS].sort()).toEqual([
      'lang',
      'layout',
      'q',
      'sort',
      'status',
      'view',
    ]);
  });

  it('keeps a copy for half an hour, as the catalog changes once a day', () => {
    expect(EDGE_TTL_SECONDS).toBe(1800);
  });

  it('lets search engines index nothing: the whole site is private', () => {
    expect([...PUBLIC_PAGES]).toEqual([]);
  });

  it.each([
    '/opengraph-image.png',
    '/twitter-image.png',
    '/icon.svg',
    '/apple-icon.png',
    '/favicon.ico',
    '/manifest.webmanifest',
    '/robots.txt',
    '/sitemap.xml',
    '/feed.xml',
    '/llms.txt',
    '/security-policy.txt',
    '/icons/icon-192.png',
    '/.well-known/security.txt',
  ])('opens %s to other sites', (path) => {
    expect(OPEN_FILES.test(path)).toBe(true);
  });

  it.each(['/', '/movies', '/img', '/api/things'])(
    'keeps %s to this site',
    (path) => {
      expect(OPEN_FILES.test(path)).toBe(false);
    },
  );

  it('lets the social cards, the icons and the manifest be cached for a day', () => {
    expect([...RARELY_CHANGING].sort()).toEqual([
      '/apple-icon.png',
      '/favicon.ico',
      '/icon.svg',
      '/manifest.webmanifest',
      '/opengraph-image.png',
      '/twitter-image.png',
    ]);
  });

  it('adds no outside picture sources: every picture comes through this site', () => {
    expect(EXTRA_IMG_SOURCES).toEqual([]);
  });

  it('lets style attributes, and only attributes, be inline', () => {
    expect(EXTRA_DIRECTIVES).toEqual(["style-src-attr 'unsafe-inline'"]);
  });
});
