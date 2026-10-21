import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { subscriptionId } from '../../../../../src/lib/push/subscription-id';

const store = new Set<string>();
jest.unstable_mockModule('../../../../../src/lib/util', () => ({
  getDB: () => ({}),
}));
jest.unstable_mockModule('../../../../../src/lib/push', () => ({
  PushSubscriptionRepository: class {
    public listAll() {
      return Promise.resolve([...store].map((endpoint) => ({ endpoint })));
    }
    public remove(endpoint: string) {
      store.delete(endpoint);
      return Promise.resolve();
    }
  },
}));

const { DELETE } =
  await import('../../../../../src/app/api/push-subscriptions/[id]/route');

const del = (id: string) =>
  DELETE(
    new Request(`https://x/api/push-subscriptions/${id}`, { method: 'DELETE' }),
    {
      params: Promise.resolve({ id }),
    },
  );

beforeEach(() => store.clear());

describe('DELETE /api/push-subscriptions/{id}', () => {
  it('204s and forgets the subscription', async () => {
    store.add('https://push.test/abc');
    const res = await del(await subscriptionId('https://push.test/abc'));
    expect(res.status).toBe(204);
    expect(store.size).toBe(0);
  });

  it('404s as a problem for a subscription that is not there', async () => {
    store.add('https://push.test/abc');
    const res = await del('f'.repeat(64));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(store.size).toBe(1);
  });
});
