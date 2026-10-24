import { describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('@/core/runtime', () => ({
  getEnv: () => ({ VAPID_PUBLIC_KEY: 'pub-key' }),
}));

const { GET } = await import('@/app/api/push/configuration/route');

describe('GET /api/push/configuration', () => {
  it('answers the VAPID public key, cacheable', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ vapid_public_key: 'pub-key' });
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
  });
});
