import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { subscriptionId } from '@/lib/push/subscription-id';

const store = new Map<string, { p256dh: string; auth: string }>();
jest.unstable_mockModule('@/core/runtime', () => ({
  getDatabase: () => ({}),
}));
jest.unstable_mockModule('@/domain/push/repository', () => ({
  PushSubscriptionRepository: class {
    public listAll() {
      return Promise.resolve(
        [...store.keys()].map((endpoint) => ({ endpoint })),
      );
    }
    public upsert(r: { endpoint: string; p256dh: string; auth: string }) {
      store.set(r.endpoint, { p256dh: r.p256dh, auth: r.auth });
      return Promise.resolve();
    }
  },
}));

const { POST } = await import('@/app/api/push/subscriptions/route');

const ENDPOINT = 'https://push.test/abc';
const GOOD = { endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } };

const post = (body: unknown, type = 'application/json'): Request =>
  new Request('https://x/api/push/subscriptions', {
    method: 'POST',
    headers: { 'content-type': type },
    body: JSON.stringify(body),
  });

beforeEach(() => store.clear());

describe('POST /api/push/subscriptions', () => {
  it('201s a new subscription with its Location and id', async () => {
    const res = await POST(post(GOOD));
    const id = await subscriptionId(ENDPOINT);
    expect(res.status).toBe(201);
    expect(res.headers.get('location')).toBe(
      `https://x/api/push/subscriptions/${id}`,
    );
    expect(await res.json()).toEqual({ id });
    expect(store.get(ENDPOINT)).toEqual({ p256dh: 'p', auth: 'a' });
  });

  it('200s a subscription that was already registered, with the new keys', async () => {
    await POST(post(GOOD));
    const res = await POST(
      post({ endpoint: ENDPOINT, keys: { p256dh: 'p2', auth: 'a2' } }),
    );
    expect(res.status).toBe(200);
    expect(store.get(ENDPOINT)).toEqual({ p256dh: 'p2', auth: 'a2' });
  });

  it.each([
    [{ keys: GOOD.keys }, 'endpoint: must be an https URL.'],
    [
      { endpoint: 'http://push.test/x', keys: GOOD.keys },
      'endpoint: must be an https URL.',
    ],
    [{ endpoint: ENDPOINT }, 'keys.p256dh: required.'],
    [{ endpoint: ENDPOINT, keys: { p256dh: 'p' } }, 'keys.auth: required.'],
  ])('400s %j with %s', async (body, error) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(((await res.json()) as { errors: string[] }).errors).toContain(
      error,
    );
    expect(store.size).toBe(0);
  });

  it('415s for a body that is not JSON', async () => {
    expect((await POST(post(GOOD, 'text/plain'))).status).toBe(415);
  });
});
