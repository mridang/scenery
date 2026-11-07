import { describe, expect, it } from '@jest/globals';

import {
  parsePageViewOptions,
  parseViewOptions,
} from '@/domain/catalog/options';

describe('parseViewOptions', () => {
  it('applies the defaults when nothing is supplied', () => {
    expect(parseViewOptions({})).toEqual({
      lang: 'en',
      sort: 'date',
      view: 'catalog',
    });
  });
  it('lower-cases the language code', () => {
    expect(parseViewOptions({ lang: 'FR' }).lang).toBe('fr');
  });
  it('accepts the known sort / view values', () => {
    expect(parseViewOptions({ sort: 'score', view: 'plan' })).toEqual({
      lang: 'en',
      sort: 'score',
      view: 'plan',
    });
  });
  it('falls back to defaults for unknown sort / view', () => {
    expect(parseViewOptions({ sort: 'bogus', view: 'hack' })).toMatchObject({
      sort: 'date',
      view: 'catalog',
    });
  });
  it('treats null params as absent', () => {
    expect(parseViewOptions({ lang: null, sort: null, view: null })).toEqual({
      lang: 'en',
      sort: 'date',
      view: 'catalog',
    });
  });
});

describe('parsePageViewOptions page', () => {
  it('defaults to the first page', () => {
    expect(parsePageViewOptions({}).page).toBe(1);
  });
  it('reads a valid page number', () => {
    expect(parsePageViewOptions({ page: '3' }).page).toBe(3);
  });
  it('falls back to the first page for junk or out-of-range values', () => {
    expect(parsePageViewOptions({ page: 'x' }).page).toBe(1);
    expect(parsePageViewOptions({ page: '-4' }).page).toBe(1);
    expect(parsePageViewOptions({ page: '9999' }).page).toBe(50);
  });
});
