import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { is } from 'drizzle-orm';
import { SQLiteTable, getTableConfig } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

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
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

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

/** The column names SQLite reports for a table, sorted. */
function columnsOf(raw: DatabaseSync, table: string): readonly string[] {
  return raw
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => String(row['name']))
    .toSorted((a, b) => a.localeCompare(b));
}

/** The names of the indexes SQLite reports for a table. */
function indexesOf(raw: DatabaseSync, table: string): readonly string[] {
  return raw
    .prepare(`PRAGMA index_list(${table})`)
    .all()
    .map((row) => String(row['name']));
}

/** The drizzle tables of the schema file, by their SQL name. */
const tables = new Map(
  Object.values(schema)
    .filter((value) => is(value, SQLiteTable))
    .map((table) => [getTableConfig(table).name, table] as const),
);

describe('the schema file and the migrations', () => {
  let raw: DatabaseSync;

  beforeAll(async () => {
    ({ raw } = await sqliteD1(...APP_MIGRATIONS));
  });

  it('finds the tables of the schema', () => {
    expect(tables.size).toBeGreaterThan(0);
  });

  it.each([...tables.keys()])(
    'declares the table %s with the columns and indexes the migrations create',
    (name) => {
      const table = tables.get(name);
      expect(table).toBeDefined();
      const config = getTableConfig(table!);
      expect(columnsOf(raw, name)).toEqual(
        config.columns
          .map((column) => column.name)
          .toSorted((a, b) => a.localeCompare(b)),
      );
      // Every index the schema names exists (the database may carry more, such
      // as the legacy unique constraint on recipes.drive_file_id).
      const present = indexesOf(raw, name);
      config.indexes.forEach((index) =>
        expect(present).toContain(index.config.name),
      );
    },
  );
});

describe('migration 0016_movie_newest_posted', () => {
  it('backfills the newest release time of every existing movie', async () => {
    const before = APP_MIGRATIONS.filter(
      (file) => file.localeCompare('0016') < 0,
    );
    const { raw: old } = await sqliteD1(...before);
    old.exec(`
      INSERT INTO movies (imdb_id, first_seen_at, last_seen_at) VALUES
        ('tt1', '2026-01-01', '2026-01-01'), ('tt2', '2026-01-01', '2026-01-01');
      INSERT INTO releases (source_id, external_id, imdb_id, title, url, posted_at, first_seen_at, last_seen_at) VALUES
        (1, 'a', 'tt1', 't', 'u', '2026-03-01', '2026-04-01', '2026-04-01'),
        (1, 'b', 'tt1', 't', 'u', NULL, '2026-05-01', '2026-05-01'),
        (1, 'c', 'tt1', 't', 'u', '2026-02-01', '2026-06-01', '2026-06-01');
    `);
    old.exec(
      await readFile(
        path.join(
          process.cwd(),
          'migrations',
          APP_MIGRATIONS.find((file) => file.startsWith('0016'))!,
        ),
        'utf8',
      ),
    );
    const rows = old
      .prepare('SELECT imdb_id, newest_posted_at FROM movies ORDER BY imdb_id')
      .all()
      .map((row) => [row['imdb_id'], row['newest_posted_at']]);
    expect(rows).toEqual([
      ['tt1', '2026-05-01'],
      ['tt2', null],
    ]);
  });
});
