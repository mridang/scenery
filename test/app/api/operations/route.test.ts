import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { DatabaseSync } from 'node:sqlite';

import type { OperationRequest } from '@/domain/operations/types';
import { APP_MIGRATIONS } from '../../../lib/db/migrations';
import { installCloudflareContext, sqliteD1 } from '../../../lib/db/sqlite-d1';

const runOperation = jest.fn<(request: OperationRequest) => Promise<unknown>>(
  async () => ({ done: true }),
);
jest.unstable_mockModule('@/domain/operations/run', () => ({
  runOperation,
}));

const { POST } = await import('@/app/api/operations/route');

let raw: DatabaseSync;
let restore: () => void;

const install = (env: Record<string, unknown> = {}) => {
  restore?.();
  const made = sqliteD1(...APP_MIGRATIONS);
  raw = made.raw;
  restore = installCloudflareContext(made.d1, env);
};

beforeEach(() => {
  runOperation.mockClear();
  runOperation.mockResolvedValue({ done: true });
  install();
});

afterEach(() => restore());

const post = (
  body: string,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) =>
  POST(
    new Request('https://app.test/api/operations', {
      method: 'POST',
      headers,
      body,
    }),
  );

const start = (body: unknown, headers?: Record<string, string>) =>
  post(JSON.stringify(body), {
    'content-type': 'application/json',
    ...headers,
  });

const stored = () => raw.prepare('SELECT * FROM operations').all();

describe('POST /api/operations', () => {
  it('runs the operation and answers 201 with its resource and Location', async () => {
    const res = await start({
      type: 'omdb_backfill',
      parameters: { limit: 5 },
    });
    expect(res.status).toBe(201);
    const operation = (await res.json()) as Record<string, unknown>;
    expect(operation).toMatchObject({
      type: 'omdb_backfill',
      status: 'succeeded',
      parameters: { limit: 5 },
      result: { done: true },
    });
    expect(res.headers.get('location')).toBe(
      `https://app.test/api/operations/${operation['id']}`,
    );
    expect(Date.parse(String(operation['created_at']))).not.toBeNaN();
    expect(Date.parse(String(operation['finished_at']))).not.toBeNaN();
    expect(runOperation.mock.calls[0]?.[0]).toEqual({
      type: 'omdb_backfill',
      parameters: { limit: 5 },
    });
    expect(stored()).toHaveLength(1);
  });

  it('answers 201 with a failed operation, and only the error message, when the run throws', async () => {
    runOperation.mockRejectedValue(new Error('OMDB is down'));
    const res = await start({ type: 'push_trigger' });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      status: 'failed',
      result: { error: 'OMDB is down' },
    });
  });

  it('answers 400 naming what is wrong, without running anything', async () => {
    const res = await start({
      type: 'omdb_backfill',
      parameters: { limit: 0 },
    });
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(((await res.json()) as { errors: string[] }).errors).toEqual([
      'parameters.limit: a whole number from 1 to 200.',
    ]);
    expect(runOperation).not.toHaveBeenCalled();
    expect(stored()).toHaveLength(0);
  });

  it('answers 415 to a body that is not JSON and 400 to JSON that is not an object', async () => {
    expect(
      (await post('type=push_trigger', { 'content-type': 'text/plain' }))
        .status,
    ).toBe(415);
    expect((await post('[]')).status).toBe(400);
    expect(runOperation).not.toHaveBeenCalled();
  });

  describe('where a secret is set', () => {
    beforeEach(() => install({ CRON_SECRET: 'shh' }));

    it('answers 401 asking for a bearer token, without running anything', async () => {
      const res = await start({ type: 'push_trigger' });
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
      expect(runOperation).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(0);
    });

    it('runs it for the bearer of the secret', async () => {
      const res = await start(
        { type: 'push_trigger' },
        { authorization: 'Bearer shh' },
      );
      expect(res.status).toBe(201);
    });
  });
});
