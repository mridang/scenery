import { databaseFrom, type Database } from '@/domain/db/client';
import { beforeEach, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

import { OmdbRepository } from '@/domain/omdb/repository';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  queryPlan,
  recordStatements,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

let d1: D1Database;
let raw: DatabaseSync;
let db: Database;

beforeEach(() => {
  const built = sqliteD1(...APP_MIGRATIONS);
  d1 = built.d1;
  raw = built.raw;
  db = databaseFrom(d1);
});

/** Seed a movie with a TMDB row in the given status and OMDB status. */
async function seed(
  imdb: string,
  status: string,
  omdbStatus: string | null,
): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO movies (imdb_id, first_seen_at, last_seen_at)
       VALUES (?, '2026-06-01', '2026-06-01')`,
    )
    .bind(imdb)
    .run();
  await d1
    .prepare(
      `INSERT INTO tmdb_movies (imdb_id, status, raw_response, fetched_at, omdb_status)
       VALUES (?, ?, '{}', '2026-06-01', ?)`,
    )
    .bind(imdb, status, omdbStatus)
    .run();
}

describe('OmdbRepository (SQLite-backed D1)', () => {
  it('pending lists found movies with no OMDB status or an errored one', async () => {
    await seed('tt3000001', 'found', null);
    await seed('tt3000002', 'found', 'error');
    await seed('tt3000003', 'found', 'ok');
    await seed('tt3000004', 'not_found', null);

    expect(await new OmdbRepository(db).pending(10)).toEqual([
      'tt3000001',
      'tt3000002',
    ]);
  });

  it('pending finds its movies through the partial OMDB index', async () => {
    const { d1: recorded, statements } = recordStatements(d1);
    await new OmdbRepository(databaseFrom(recorded)).pending(10);
    const plans = statements.flatMap((sql) => queryPlan(raw, sql));
    expect(
      plans.some((line) => line.includes('tmdb_movies_omdb_pending_idx')),
    ).toBe(true);
  });
});
