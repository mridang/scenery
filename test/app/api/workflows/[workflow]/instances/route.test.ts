import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockEnv: Record<string, unknown> = {};
jest.unstable_mockModule('../../../../../../src/lib/util', () => ({
  getEnv: () => mockEnv,
}));

const { POST } =
  await import('../../../../../../src/app/api/workflows/[workflow]/instances/route');

const created: unknown[] = [];
let failWith: Error | undefined;
const binding = {
  create: (opts: unknown) => {
    if (failWith) return Promise.reject(failWith);
    created.push(opts);
    return Promise.resolve({
      id: 'run-1',
      status: () => Promise.resolve({ status: 'queued' }),
    });
  },
};

const ctx = (workflow: string) => ({ params: Promise.resolve({ workflow }) });
const post = (workflow: string, body?: unknown, headers = {}): Request =>
  new Request(`https://x/api/workflows/${workflow}/instances`, {
    method: 'POST',
    headers:
      body === undefined
        ? headers
        : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  created.length = 0;
  failWith = undefined;
  mockEnv = {
    SCRAPE_WORKFLOW: binding,
    MOVIE_WORKFLOW: binding,
    NOTIFY_WORKFLOW: binding,
  };
});

describe('POST /api/workflows/{workflow}/instances', () => {
  it('201s with the run, its status and where to follow it', async () => {
    const res = await POST(post('notify'), ctx('notify'));
    expect(res.status).toBe(201);
    expect(res.headers.get('location')).toBe(
      'https://x/api/workflows/notify/instances/run-1',
    );
    expect(await res.json()).toEqual({
      id: 'run-1',
      status: { status: 'queued' },
    });
    expect(created).toEqual([{ params: {} }]);
  });

  it('hands the body params to the workflow', async () => {
    await POST(post('movie', { params: { imdbId: 'tt1' } }), ctx('movie'));
    expect(created).toEqual([{ params: { imdbId: 'tt1' } }]);
  });

  it('404s for a workflow that does not exist', async () => {
    const res = await POST(post('cron'), ctx('cron'));
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
  });

  it('401s when a secret is set and not sent', async () => {
    mockEnv = { ...mockEnv, CRON_SECRET: 'shh' };
    expect((await POST(post('notify'), ctx('notify'))).status).toBe(401);
    expect(created).toEqual([]);
  });

  it('accepts the right bearer token', async () => {
    mockEnv = { ...mockEnv, CRON_SECRET: 'shh' };
    const res = await POST(
      post('notify', undefined, { authorization: 'Bearer shh' }),
      ctx('notify'),
    );
    expect(res.status).toBe(201);
  });

  it('400s when the body is not a JSON object', async () => {
    const res = await POST(
      new Request('https://x/api/workflows/movie/instances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '[]',
      }),
      ctx('movie'),
    );
    expect(res.status).toBe(400);
  });

  it('502s without leaking the failure when the workflow will not start', async () => {
    failWith = new Error('secret internals');
    const res = await POST(post('scrape'), ctx('scrape'));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('secret internals');
  });
});
