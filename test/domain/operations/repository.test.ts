import { beforeEach, describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/core/db/client';
import { OperationRepository } from '@/domain/operations/repository';
import { APP_MIGRATIONS } from '../../lib/db/migrations';
import { sqliteD1 } from '../../lib/db/sqlite-d1';

let repository: OperationRepository;

beforeEach(() => {
  repository = new OperationRepository(
    createDatabase(sqliteD1(...APP_MIGRATIONS).d1),
  );
});

const ID = '0b8a3f1e-5a53-4a5c-8a1c-0a6c8d8f6a11';

describe('OperationRepository', () => {
  it('records a start as a running operation with its parameters', async () => {
    await repository.start({
      id: ID,
      type: 'omdb_backfill',
      parameters: { limit: 5 },
      createdAt: '2026-10-21T00:00:00.000Z',
    });
    expect(await repository.get(ID)).toEqual({
      id: ID,
      type: 'omdb_backfill',
      status: 'running',
      parameters: '{"limit":5}',
      result: null,
      created_at: '2026-10-21T00:00:00.000Z',
      finished_at: null,
    });
  });

  it('records how it ended', async () => {
    await repository.start({
      id: ID,
      type: 'push_trigger',
      parameters: {},
      createdAt: '2026-10-21T00:00:00.000Z',
    });
    await repository.finish(
      ID,
      'failed',
      { error: 'boom' },
      '2026-10-21T00:00:05.000Z',
    );
    expect(await repository.get(ID)).toMatchObject({
      status: 'failed',
      result: '{"error":"boom"}',
      finished_at: '2026-10-21T00:00:05.000Z',
    });
  });

  it('finds nothing for an id it never saw', async () => {
    expect(await repository.get(ID)).toBeUndefined();
  });
});
