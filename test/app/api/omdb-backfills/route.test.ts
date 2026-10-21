import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const sweeps: number[] = [];
jest.unstable_mockModule('../../../../src/lib/util', () => ({
  getDB: () => ({}),
  getEnv: () => ({ OMDB_API_KEY: 'k' }),
}));
jest.unstable_mockModule('../../../../src/lib/transport', () => ({
  withRetry: (f: typeof fetch) => f,
}));
jest.unstable_mockModule('../../../../src/lib/omdb', () => ({
  OmdbEnricher: class {
    public sweepPending(limit: number) {
      sweeps.push(limit);
      return Promise.resolve({ processed: 2 });
    }
  },
}));

const { POST } = await import('../../../../src/app/api/omdb-backfills/route');

const post = (body?: string, type = 'application/json'): Request =>
  new Request('https://x/api/omdb-backfills', {
    method: 'POST',
    headers: body === undefined ? {} : { 'content-type': type },
    body,
  });

beforeEach(() => {
  sweeps.length = 0;
});

describe('POST /api/omdb-backfills', () => {
  it('sweeps 25 movies with no body, and reports the summary without an ok flag', async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ limit: 25, processed: 2 });
    expect(sweeps).toEqual([25]);
  });

  it('sweeps the limit in the JSON body', async () => {
    await POST(post('{"limit":200}'));
    expect(sweeps).toEqual([200]);
  });

  it.each(['0', '201', '1.5', '"9"'])('400s for limit %s', async (limit) => {
    const res = await POST(post(`{"limit":${limit}}`));
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(sweeps).toEqual([]);
  });

  it('415s for a body that is not JSON', async () => {
    expect((await POST(post('limit=5', 'text/plain'))).status).toBe(415);
  });
});
