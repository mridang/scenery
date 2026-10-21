import { describe, expect, it } from '@jest/globals';

import { operatorRefusal } from '../../../src/lib/api/operator-auth';

const request = (authorization?: string) =>
  new Request('https://app.test/api/operations', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });

describe('operatorRefusal', () => {
  it('lets anyone in where no secret is set', () => {
    expect(operatorRefusal(request(), {})).toBeUndefined();
    expect(operatorRefusal(request(), { CRON_SECRET: '' })).toBeUndefined();
  });

  it('lets the bearer of the secret in', () => {
    expect(
      operatorRefusal(request('Bearer shh'), { CRON_SECRET: 'shh' }),
    ).toBeUndefined();
  });

  it.each([undefined, 'Bearer nope', 'shh', 'Basic shh'])(
    'answers 401 as a problem, asking for a bearer token, to %j',
    async (authorization) => {
      const res = operatorRefusal(request(authorization), {
        CRON_SECRET: 'shh',
      });
      expect(res?.status).toBe(401);
      expect(res?.headers.get('content-type')).toBe('application/problem+json');
      expect(res?.headers.get('www-authenticate')).toBe('Bearer');
    },
  );
});
