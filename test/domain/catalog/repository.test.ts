import { databaseFrom, type Database } from '@/domain/db/client';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { CatalogRepository } from '@/domain/catalog/repository';
import { ScrapingRepository } from '@/domain/scraping/repository';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

/**
 * Tests for the catalog read model: the language filter, the
 * counters, and the all-SQL scoring / tier / prestige / 1 TB-budget
 * query. Seeds via ScrapingRepository so the joins are realistic.
 */
let d1: D1Database;
let db: Database;

beforeEach(() => {
  d1 = sqliteD1(...APP_MIGRATIONS).d1;
  db = databaseFrom(d1);
});

/** Seed a release for the seeded `scnsrc` source. */
async function seedRelease(
  ext: string,
  imdb: string,
  postedAt: string,
): Promise<void> {
  const scraping = new ScrapingRepository(db);
  const sourceId = (await scraping.findSource('scnsrc'))!.id;
  await scraping.upsertRelease(
    sourceId,
    {
      externalId: ext,
      imdbId: imdb,
      title: `Release ${ext}`,
      url: `https://example.test/${ext}`,
      postHtml: '<p>body</p>',
      postedAt,
    },
    postedAt,
  );
}

describe('CatalogRepository (SQLite-backed D1)', () => {
  it('loadMovies filters by language and loadStats counts the catalog', async () => {
    await seedRelease('en-1', 'tt2000001', '2026-06-01T00:00:00Z');
    await seedRelease('hi-1', 'tt2000002', '2026-06-02T00:00:00Z');

    // Enrich only the English movie so the language filter has a target.
    await d1
      .prepare(
        `INSERT INTO tmdb_movies
            (imdb_id, status, original_language, raw_response, fetched_at)
          VALUES (?, 'found', 'en', '{}', '2026-06-03T00:00:00Z')`,
      )
      .bind('tt2000001')
      .run();

    const catalog = new CatalogRepository(db);

    const all = await catalog.loadMovies('all', 'date', 'catalog');
    expect(all.map((m) => m.imdb_id).sort()).toEqual([
      'tt2000001',
      'tt2000002',
    ]);

    const english = await catalog.loadMovies('en', 'date', 'catalog');
    expect(english).toHaveLength(1);
    expect(english[0]?.imdb_id).toBe('tt2000001');

    const stats = await catalog.loadStats();
    expect(stats.movies).toBe(2);
    expect(stats.releases).toBe(2);
    expect(stats.tmdb_found).toBe(1);
    expect(stats.tmdb_pending).toBe(1);
  });

  /**
   * Score, tier and prestige are computed entirely in SQL: a strong
   * prestige title must outscore a weak one and earn an 'A' tier.
   */
  it('scores and tiers movies in SQL (sort=score)', async () => {
    // Same posted date so recency is equal — score order is decided by
    // the rating / budget / prestige signals alone.
    await seedRelease('s-strong', 'tt3000001', '2026-06-01T00:00:00Z');
    await seedRelease('s-weak', 'tt3000002', '2026-06-01T00:00:00Z');

    await d1.batch([
      d1
        .prepare(
          `INSERT INTO tmdb_movies (imdb_id, status, original_language,
             vote_average, vote_count, budget, production_companies,
             raw_response, fetched_at)
           VALUES (?, 'found', 'en', 8.0, 5000, 200000000,
             '[{"id":210099,"name":"Amazon MGM"}]', '{}', '2026-06-03T00:00:00Z')`,
        )
        .bind('tt3000001'),
      d1
        .prepare(
          `INSERT INTO tmdb_movies (imdb_id, status, original_language,
             vote_average, vote_count, budget, raw_response, fetched_at)
           VALUES (?, 'found', 'en', 4.0, 5, 0, '{}', '2026-06-03T00:00:00Z')`,
        )
        .bind('tt3000002'),
    ]);

    const catalog = new CatalogRepository(db);
    const rows = await catalog.loadMovies('all', 'score', 'catalog');

    expect(rows.map((r) => r.imdb_id)).toEqual(['tt3000001', 'tt3000002']);
    expect(rows[0]!.score).toBeGreaterThan(rows[1]!.score);
    expect(rows[0]!.tier).toBe('A'); // prestige studio → A
    expect(rows[0]!.prestige_ids).toContain('210099');
    expect(rows[1]!.prestige_ids).toBeNull();
  });

  /**
   * Plan view budgets disk space with a SQL window function: the running
   * total and the fits flag are computed in the database.
   */
  it('computes the cumulative 1 TB budget in SQL (view=plan)', async () => {
    // Newer first in date order: tt-a (Jun 2) then tt-b (Jun 1).
    await seedRelease('p-a', 'tt4000001', '2026-06-02T00:00:00Z');
    await seedRelease('p-b', 'tt4000002', '2026-06-01T00:00:00Z');

    // Two 600 GB torrents — cumulative 1.2 TB overflows the 1 TB budget,
    // so the second (older) one must not fit.
    const big = 600_000_000_000;
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO torrents (imdb_id, info_hash, title, raw_title,
             size_bytes, seeders, fetched_at)
           VALUES (?, 'hasha', 'A', 'A', ?, 10, '2026-06-03T00:00:00Z')`,
        )
        .bind('tt4000001', big),
      d1
        .prepare(
          `INSERT INTO torrents (imdb_id, info_hash, title, raw_title,
             size_bytes, seeders, fetched_at)
           VALUES (?, 'hashb', 'B', 'B', ?, 10, '2026-06-03T00:00:00Z')`,
        )
        .bind('tt4000002', big),
    ]);

    const catalog = new CatalogRepository(db);
    const rows = await catalog.loadMovies('all', 'date', 'plan');

    expect(rows.map((r) => r.imdb_id)).toEqual(['tt4000001', 'tt4000002']);
    expect(rows.map((r) => r.cum_size_bytes)).toEqual([big, big * 2]);
    expect(rows.map((r) => r.fits)).toEqual([1, 0]);
  });
});
