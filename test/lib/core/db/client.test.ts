import { is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/lib/core/db/client';
import {
  fetchAttempts,
  movies,
  operations,
  pageSnapshots,
  pushSubscriptions,
  releases,
  sources,
  tmdbGenres,
  tmdbMovies,
  tmdbPeople,
  torrentLookups,
  torrents,
} from '@/domain/db/schema';
import { APP_MIGRATIONS } from './migrations';
import { sqliteD1 } from './sqlite-d1';

/** Every table of the schema file, by its export name. */
const schema = {
  fetchAttempts,
  movies,
  operations,
  pageSnapshots,
  pushSubscriptions,
  releases,
  sources,
  tmdbGenres,
  tmdbMovies,
  tmdbPeople,
  torrentLookups,
  torrents,
};

describe('createDatabase', () => {
  it('wraps a D1 binding in a client that keeps the binding as $client', async () => {
    const { d1 } = await sqliteD1();
    expect(createDatabase(d1, schema).$client).toBe(d1);
  });

  it('runs typed queries against every table of the schema', async () => {
    const { d1 } = await sqliteD1(...APP_MIGRATIONS);
    const db = createDatabase(d1, schema);
    const tables = Object.values(schema).filter((value) =>
      is(value, SQLiteTable),
    );
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(Array.isArray(await db.select().from(table))).toBe(true);
    }
  });
});
