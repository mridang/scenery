import { describe, expect, it } from '@jest/globals';

import {
  BRAND_NAME,
  BRAND_URL,
  CRAWLABLE_PATHS,
  MANIFEST_EXTRAS,
  PRIVATE_PATHS,
  SITEMAP_PAGES,
} from '@/app/_brand';

describe('the brand', () => {
  it('is named and placed as the site says', () => {
    expect(BRAND_NAME).toBe('scenery');
    expect(BRAND_URL).toBe('https://scenery.apps.mrida.ng');
  });
});

describe('what crawlers may read', () => {
  it('lets them read the pages, so that they see each page’s noindex', () => {
    expect(CRAWLABLE_PATHS).toEqual(['/', '/privacy', '/terms']);
  });

  it('keeps them out of the API and the magnet redirect', () => {
    expect(PRIVATE_PATHS).toEqual([
      '/api/',
      '/csp/',
      '/health$',
      '/img?',
      '/magnet/',
    ]);
  });

  it('lists only the legal pages in the sitemap, as nothing else is meant to be indexed', () => {
    expect(SITEMAP_PAGES).toEqual([
      { path: '/privacy', lastModified: '2026-11-01' },
      { path: '/terms', lastModified: '2026-11-01' },
    ]);
  });
});

describe('what the installed app offers', () => {
  it('has no screenshots, share target or shortcuts', () => {
    expect(MANIFEST_EXTRAS).toEqual({});
  });
});
