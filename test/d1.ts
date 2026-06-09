import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Miniflare } from 'miniflare';

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);

/**
 * A throwaway D1 database backed by a real `workerd` instance (Miniflare 4
 * embeds the same runtime Cloudflare runs in production). Unlike the
 * Vitest pool, this works from any test runner — the repository code runs
 * in Node and talks to the in-process `workerd` D1 over Miniflare's
 * socket, which is exactly what the repository tests need: real D1 SQL,
 * real bindings, no mock.
 */
export interface TestD1 {
  /** The live D1 binding, schema already migrated. */
  readonly db: D1Database;
  /** Tear down the underlying `workerd` instance. */
  dispose(): Promise<void>;
}

/**
 * Boot a Miniflare instance with a single in-memory D1 binding (`DB`),
 * replay every migration in `migrations/` against it, and hand back the
 * live {@link D1Database}.
 */
export async function createTestD1(): Promise<TestD1> {
  const mf = new Miniflare({
    modules: true,
    // A no-op Worker — tests never invoke it; they only use the binding.
    script: 'export default { fetch() { return new Response(null); } };',
    d1Databases: ['DB'],
  });

  const db = (await mf.getD1Database('DB')) as unknown as D1Database;
  await applyMigrations(db);

  return { db, dispose: () => mf.dispose() };
}

/**
 * Wipe every mutable table (keeping the migration seed, e.g. the `sources`
 * rows) so each test starts from a clean catalog. Call in `beforeEach`.
 */
export async function wipe(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM fetch_attempts'),
    db.prepare('DELETE FROM page_snapshots'),
    db.prepare('DELETE FROM releases'),
    db.prepare('DELETE FROM tmdb_movies'),
    db.prepare('DELETE FROM tmdb_people'),
    db.prepare('DELETE FROM tmdb_genres'),
    db.prepare('DELETE FROM torrents'),
    db.prepare('DELETE FROM torrent_lookups'),
    db.prepare('DELETE FROM movies'),
  ]);
}

/** Read and execute every `*.sql` migration in filename order. */
async function applyMigrations(db: D1Database): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const statement of splitStatements(sql)) {
      await db.prepare(statement).run();
    }
  }
}

/**
 * Split a migration file into individual statements. Strips block and line
 * comments first — none of these migrations embed comment markers inside a
 * string literal, so this is safe — then splits on semicolons.
 */
function splitStatements(sql: string): string[] {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\n]*/g, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}
