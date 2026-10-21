import { describe, expect, it } from '@jest/globals';

import { operatorRefusal } from '../../../src/lib/api/operator-auth';

const req = (authorization?: string): Request =>
  new Request('https://x/api/pipeline-runs', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });

describe('operatorRefusal', () => {
  it('lets everyone in when no secret is set', () => {
    expect(operatorRefusal(req(), undefined)).toBeUndefined();
  });

  it('lets in the right bearer token', () => {
    expect(operatorRefusal(req('Bearer shh'), 'shh')).toBeUndefined();
  });

  it.each([undefined, 'Bearer nope', 'shh'])(
    'answers a 401 problem for %s',
    async (header) => {
      const res = operatorRefusal(req(header), 'shh');
      expect(res?.status).toBe(401);
      expect(res?.headers.get('content-type')).toBe('application/problem+json');
      expect(res?.headers.get('www-authenticate')).toBe('Bearer');
      expect(await res?.json()).toMatchObject({
        type: '/problems/unauthorized',
        status: 401,
      });
    },
  );
});
