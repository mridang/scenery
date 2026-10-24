import { describe, expect, it } from '@jest/globals';

import { parseViewOptions } from '@/domain/catalog/options';

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
