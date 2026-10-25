import { describe, expect, it } from '@jest/globals';

import {
  ALLOWED_HOSTS,
  ALLOWED_WIDTHS,
  DEFAULT_WIDTH,
} from '@/lib/cloudflare/images/site';

describe('image settings', () => {
  it('takes pictures from TMDB only', () => {
    expect(ALLOWED_HOSTS).toEqual(['image.tmdb.org']);
  });

  it('offers the widths the pages use, from a thumbnail to a retina hero', () => {
    expect(ALLOWED_WIDTHS).toEqual([
      92, 154, 185, 342, 500, 780, 1280, 1920, 2560, 3840,
    ]);
  });

  it('uses one of the offered widths when none is asked for', () => {
    expect(DEFAULT_WIDTH).toBe(185);
    expect(ALLOWED_WIDTHS).toContain(DEFAULT_WIDTH);
  });
});
