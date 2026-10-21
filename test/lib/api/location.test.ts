import { describe, expect, it } from '@jest/globals';

import { absoluteLocation } from '../../../src/lib/api/location';

describe('absoluteLocation', () => {
  it('puts the path on the origin the request came to', () => {
    expect(
      absoluteLocation(new Request('https://app.test/api/a?x=1'), '/api/a/7'),
    ).toBe('https://app.test/api/a/7');
  });
});
