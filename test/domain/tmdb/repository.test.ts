import { databaseFrom } from '@/domain/db/client';
import { beforeEach, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

import { TmdbRepository } from '@/domain/tmdb/repository';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  queryPlan,
  recordStatements,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

let d1: D1Database;
let raw: DatabaseSync;

beforeEach(async () => {
  const built = await sqliteD1(...APP_MIGRATIONS);
  d1 = built.d1;
  raw = built.raw;
});

describe('TmdbRepository people queries (SQLite-backed D1)', () => {
  it('every query on tmdb_people ignores popularity as an access path; there is no index on it', async () => {
    const { d1: recorded, statements } = recordStatements(d1);
    const repo = new TmdbRepository(databaseFrom(recorded));
    await repo.peoplePrestigeMap();
    await repo.knownPeopleIds();
    await repo.stalePeopleIds();
    const plans = statements.flatMap((sql) => queryPlan(raw, sql));
    expect(
      plans.filter((line) => line.includes('tmdb_people_pop_idx')),
    ).toEqual([]);
    const indexes = raw
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index'`)
      .all()
      .map((row) => row['name']);
    expect(indexes).not.toContain('tmdb_people_pop_idx');
  });

  it('stalePeopleIds reads only the people without a prestige score, through its index', async () => {
    const { d1: recorded, statements } = recordStatements(d1);
    await new TmdbRepository(databaseFrom(recorded)).stalePeopleIds();
    const plans = statements.flatMap((sql) => queryPlan(raw, sql));
    expect(
      plans.some((line) => line.includes('tmdb_people_prestige_idx')),
    ).toBe(true);
    expect(plans.filter((line) => line.includes('TEMP B-TREE'))).toEqual([]);
  });
});
