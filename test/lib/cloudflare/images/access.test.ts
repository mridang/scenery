import { describe, expect, it } from '@jest/globals';

import {
  authenticate,
  mayFetch,
  signatureFor,
  signatureValid,
} from '@/lib/cloudflare/images/access';

describe('access to pictures', () => {
  it('turns nobody away before the address is looked at', async () => {
    expect(await authenticate()).toBeUndefined();
  });

  it('lets any picture on an allowed host be fetched', async () => {
    expect(await mayFetch()).toBe(true);
  });

  it('does not sign addresses: the host allow-list is the rule', async () => {
    expect(signatureFor()).toBeUndefined();
    expect(await signatureValid()).toBe(true);
  });
});
