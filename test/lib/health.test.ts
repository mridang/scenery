import { beforeAll, describe, expect, it, jest } from '@jest/globals';

import { APP_MIGRATIONS } from './db/migrations';
import { sqliteD1 } from './db/sqlite-d1';

let d1: D1Database;
const world = { bound: true };

beforeAll(() => {
  d1 = sqliteD1(...APP_MIGRATIONS).d1;
});

jest.unstable_mockModule('../../src/lib/util', () => ({
  getDB: () => d1,
  getEnv: () => ({}),
  logInfo: () => undefined,
  logWarn: () => undefined,
  logError: () => undefined,
  safeJsonParse: () => ({ ok: false, error: 'stub' }),
  isDatabaseBound: () => world.bound,
}));

const { appHealth } = await import('../../src/lib/health');

describe('appHealth', () => {
  // Runs first, against the freshly-migrated (empty) database.
  it('is not healthy when the catalog is empty and stale', async () => {
    const health = await appHealth();
    expect(health.ok).toBe(false);
    expect(health.details).toMatchObject({
      movies: 0,
      last_scrape_at: null,
      last_scrape_age_ms: null,
    });
    expect(health.details['stale_threshold_ms']).toBeGreaterThan(0);
  });

  it('is healthy after a recent scrape snapshot', async () => {
    const src = (await d1
      .prepare("SELECT id FROM sources WHERE slug = 'scnsrc'")
      .first()) as { id: number };
    await d1
      .prepare(
        `INSERT INTO page_snapshots
           (source_id, page_number, page_url, fetched_at, fetcher, html, byte_size)
         VALUES (?, 1, 'https://example.test/1', ?, 'test', '<html></html>', 13)`,
      )
      .bind(src.id, new Date().toISOString())
      .run();
    const health = await appHealth();
    expect(health.ok).toBe(true);
    expect(health.details['last_scrape_source']).toBe('scnsrc');
    expect(health.details['last_scrape_at']).not.toBeNull();
  });

  it('is not healthy when there is no database to ask', async () => {
    world.bound = false;
    expect(await appHealth()).toEqual({ ok: false, details: {} });
    world.bound = true;
  });
});
