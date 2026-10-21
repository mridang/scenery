import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockEnv: Record<string, unknown> = {};
jest.unstable_mockModule('../../../../../../../src/lib/util', () => ({
  getEnv: () => mockEnv,
}));

const { GET } =
  await import('../../../../../../../src/app/api/workflows/[workflow]/instances/[id]/route');

let found = true;
const binding = {
  get: (id: string) =>
    found
      ? Promise.resolve({
          id,
          status: () => Promise.resolve({ status: 'complete' }),
        })
      : Promise.reject(new Error('instance.not_found')),
};

const ctx = (workflow: string, id: string) => ({
  params: Promise.resolve({ workflow, id }),
});
const get = (headers = {}): Request =>
  new Request('https://x/api/workflows/movie/instances/r1', { headers });

beforeEach(() => {
  found = true;
  mockEnv = { MOVIE_WORKFLOW: binding };
});

describe('GET /api/workflows/{workflow}/instances/{id}', () => {
  it('200s with the run and its status', async () => {
    const res = await GET(get(), ctx('movie', 'r1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'r1',
      status: { status: 'complete' },
    });
  });

  it('404s for a run that does not exist', async () => {
    found = false;
    const res = await GET(get(), ctx('movie', 'gone'));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
  });

  it('404s for a workflow that does not exist', async () => {
    expect((await GET(get(), ctx('cron', 'r1'))).status).toBe(404);
  });

  it('401s when a secret is set and not sent', async () => {
    mockEnv = { ...mockEnv, CRON_SECRET: 'shh' };
    expect((await GET(get(), ctx('movie', 'r1'))).status).toBe(401);
  });
});
