import { describe, expect, it } from '@jest/globals';

import { languageLabel } from '../../../src/lib/catalog/language';

describe('languageLabel', () => {
  it('maps known ISO codes to names', () => {
    expect(languageLabel('en')).toBe('English');
    expect(languageLabel('ja')).toBe('Japanese');
  });
  it('maps the "all" sentinel to "All"', () => {
    expect(languageLabel('all')).toBe('All');
  });
  it('maps the unknown-language sentinel "?" to "Unknown"', () => {
    expect(languageLabel('?')).toBe('Unknown');
  });
  it('upper-cases codes it does not recognise', () => {
    expect(languageLabel('xx')).toBe('XX');
  });
});
