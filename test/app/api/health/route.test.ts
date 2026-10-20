import { beforeAll, describe, expect, it, jest } from '@jest/globals';

import { APP_MIGRATIONS } from '../../../lib/db/migrations';
import { sqliteD1 } from '../../../lib/db/sqlite-d1';

let d1: D1Database;

beforeAll(() => {
  d1 = sqliteD1(...APP_MIGRATIONS).d1;
});

jest.unstable_mockModule('../../../../src/lib/util', () => ({
  getDB: () => d1,
  getEnv: () => ({}),
  logInfo: () => undefined,
  logWarn: () => undefined,
  logError: () => undefined,
  safeJsonParse: () => ({ ok: false, error: 'stub' }),
}));

const { GET } = await import('../../../../src/app/api/health/route');

interface HealthBody {
  readonly ok: boolean;
  readonly movies: number;
  readonly last_scrape_source: string | null;
  readonly last_scrape_at: string | null;
  readonly stale_threshold_ms: number;
}

describe('GET /api/health', () => {
  // Runs first, against the freshly-migrated (empty) database.
  it('returns 503 / ok:false when the catalog is empty and stale', async () => {
    const res = await GET();
    expect(res.status).toBe(503);
    const body = (await res.json()) as HealthBody;
    expect(body.ok).toBe(false);
    expect(body.movies).toBe(0);
    expect(body.last_scrape_at).toBeNull();
    expect(body.stale_threshold_ms).toBeGreaterThan(0);
  });

  it('returns 200 / ok:true after a recent scrape snapshot', async () => {
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

    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthBody;
    expect(body.ok).toBe(true);
    expect(body.last_scrape_source).toBe('scnsrc');
    expect(body.last_scrape_at).not.toBeNull();
  });
});
