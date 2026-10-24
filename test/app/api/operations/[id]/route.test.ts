import { createDatabase } from '@/core/db/client';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { GET } from '@/app/api/operations/[id]/route';
import { OperationRepository } from '@/domain/operations/repository';
import { APP_MIGRATIONS } from '@test/lib/db/migrations';
import { installCloudflareContext, sqliteD1 } from '@test/lib/db/sqlite-d1';

const ID = '0b8a3f1e-5a53-4a5c-8a1c-0a6c8d8f6a11';

let restore: () => void;

const install = async (env: Record<string, unknown> = {}) => {
  restore?.();
  const { d1 } = sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(d1, env);
  const repository = new OperationRepository(createDatabase(d1));
  await repository.start({
    id: ID,
    type: 'push_trigger',
    parameters: {},
    createdAt: '2026-10-21T00:00:00.000Z',
  });
  await repository.finish(
    ID,
    'succeeded',
    { instance_id: 'i1' },
    '2026-10-21T00:00:01.000Z',
  );
};

beforeEach(() => install());
afterEach(() => restore());

const get = (id: string, headers: Record<string, string> = {}) =>
  GET(new Request(`https://app.test/api/operations/${id}`, { headers }), {
    params: Promise.resolve({ id }),
  });

describe('GET /api/operations/:id', () => {
  it('answers 200 with the operation, not to be cached', async () => {
    const res = await get(ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: ID,
      type: 'push_trigger',
      status: 'succeeded',
      parameters: {},
      result: { instance_id: 'i1' },
      created_at: '2026-10-21T00:00:00.000Z',
      finished_at: '2026-10-21T00:00:01.000Z',
    });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers 404 as a problem for an operation that is not there or an id that cannot be one', async () => {
    for (const id of [crypto.randomUUID(), 'abc', "x' OR '1'='1"]) {
      const res = await get(id);
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
    }
  });

  it('answers 401 without the operator token where a secret is set', async () => {
    await install({ CRON_SECRET: 'shh' });
    expect((await get(ID)).status).toBe(401);
    expect((await get(ID, { authorization: 'Bearer shh' })).status).toBe(200);
  });
});
