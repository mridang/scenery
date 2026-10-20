import { describe, expect, it } from '@jest/globals';

import {
  EXTRA_DIRECTIVES,
  EXTRA_IMG_SOURCES,
  OPEN_FILES,
  PUBLIC_PAGES,
  RARELY_CHANGING,
} from '../../../src/lib/http/site';

describe('site settings', () => {
  it('lets search engines index nothing: the whole site is private', () => {
    expect([...PUBLIC_PAGES]).toEqual([]);
  });

  it.each([
    '/favicon.ico',
    '/favicon-32x32.png',
    '/android-chrome-192x192.png',
    '/apple-touch-icon.png',
    '/icon.png',
    '/icon.svg',
    '/site.webmanifest',
    '/feed.xml',
    '/icons/icon-192.png',
  ])('opens %s to other sites', (path) => {
    expect(OPEN_FILES.test(path)).toBe(true);
  });

  it.each(['/', '/movies', '/api/img', '/api/things'])(
    'keeps %s to this site',
    (path) => {
      expect(OPEN_FILES.test(path)).toBe(false);
    },
  );

  it('lets every icon and the manifest be cached for a day', () => {
    expect([...RARELY_CHANGING].sort()).toEqual([
      '/android-chrome-192x192.png',
      '/android-chrome-512x512.png',
      '/apple-touch-icon.png',
      '/favicon-16x16.png',
      '/favicon-32x32.png',
      '/favicon.ico',
      '/icon.png',
      '/icon.svg',
      '/site.webmanifest',
    ]);
  });

  it('adds no outside picture sources: every picture comes through this site', () => {
    expect(EXTRA_IMG_SOURCES).toEqual([]);
  });

  it('lets style attributes, and only attributes, be inline', () => {
    expect(EXTRA_DIRECTIVES).toEqual(["style-src-attr 'unsafe-inline'"]);
  });
});
