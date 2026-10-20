import { describe, expect, it } from '@jest/globals';

import {
  backdropUrl,
  posterUrl,
} from '../../../../src/app/(site)/_lib/tmdb-image';
import { ALLOWED_WIDTHS } from '../../../../src/lib/images/site';

const ORIGINAL = 'https://image.tmdb.org/t/p/original';

/** The `w` of one of our picture addresses. */
const widthOf = (src: string | null): number =>
  Number(new URL(src ?? '', 'https://app.test').searchParams.get('w'));

describe('posterUrl', () => {
  it('is null without a poster', () => {
    expect(posterUrl(null, 'w185')).toBeNull();
  });

  it('routes the original through our own image proxy', () => {
    expect(posterUrl('/abc.jpg', 'w185')).toBe(
      `/api/img?url=${encodeURIComponent(`${ORIGINAL}/abc.jpg`)}&w=185`,
    );
  });

  it.each([
    ['w92', 92],
    ['w185', 185],
    ['w342', 342],
    ['w500', 500],
    ['w780', 780],
  ] as const)('asks for %s at %i pixels', (size, width) => {
    expect(widthOf(posterUrl('/abc.jpg', size))).toBe(width);
  });
});

describe('backdropUrl', () => {
  it('is null without a backdrop or a poster', () => {
    expect(backdropUrl(null, null, 'w1280')).toBeNull();
  });

  it('falls back to the poster so the hero is never blank', () => {
    expect(backdropUrl(null, '/poster.jpg', 'w780')).toBe(
      `/api/img?url=${encodeURIComponent(`${ORIGINAL}/poster.jpg`)}&w=780`,
    );
  });

  it('prefers the backdrop', () => {
    expect(backdropUrl('/back.jpg', '/poster.jpg', 'w1280')).toContain(
      encodeURIComponent('/back.jpg'),
    );
  });

  it.each([
    ['w300', 342],
    ['w780', 780],
    ['w1280', 1280],
    ['w1920', 1920],
    ['w2560', 2560],
    ['w3840', 3840],
  ] as const)('asks for %s at a width the proxy offers', (size, width) => {
    const asked = widthOf(backdropUrl('/back.jpg', null, size));
    expect(asked).toBe(width);
    expect(ALLOWED_WIDTHS).toContain(asked);
  });
});
