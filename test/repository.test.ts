import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';

import { CatalogRepository } from '../src/lib/catalog/repository';
import { ScrapingRepository } from '../src/lib/scraping/repository';
import type { ExtractedRelease } from '../src/lib/sources/types';
import { createTestD1, type TestD1 } from './d1';

/**
 * These run against a real workerd-backed D1 (via Miniflare), not a SQL
 * mock, so they exercise the actual ON CONFLICT upsert semantics, the
 * seeded `scnsrc` source, and the multi-table joins the catalog page
 * relies on. One database is booted per file; `beforeEach` wipes the
 * mutable tables (keeping the seed) so each test starts clean.
 */
let harness: TestD1;

beforeAll(async () => {
  harness = await createTestD1();
});

afterAll(async () => {
  await harness.dispose();
});

beforeEach(async () => {
  const db = harness.db;
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
});

describe('ScrapingRepository (real D1)', () => {
  it('upserts movie + release and dedupes on re-scrape', async () => {
    const repo = new ScrapingRepository(harness.db);

    const source = await repo.findSource('scnsrc');
    expect(source).not.toBeNull();
    const sourceId = source!.id;

    const release: ExtractedRelease = {
      externalId: 'post-1',
      imdbId: 'tt1234567',
      title: 'Test Movie 2026 1080p',
      url: 'https://example.test/post-1',
      postHtml: '<article>first</article>',
    };

    await repo.upsertRelease(sourceId, release, '2026-06-08T00:00:00Z');
    // Re-scrape: same (source_id, external_id) and same imdb_id must
    // update both rows in place rather than insert duplicates.
    await repo.upsertRelease(
      sourceId,
      { ...release, title: 'Test Movie 2026 2160p' },
      '2026-06-09T00:00:00Z',
    );

    const movies = await harness.db
      .prepare('SELECT imdb_id, first_seen_at, last_seen_at FROM movies')
      .all();
    expect(movies.results).toHaveLength(1);
    expect(movies.results[0]).toMatchObject({
      imdb_id: 'tt1234567',
      first_seen_at: '2026-06-08T00:00:00Z',
      last_seen_at: '2026-06-09T00:00:00Z',
    });

    const releases = await harness.db
      .prepare('SELECT title, first_seen_at, last_seen_at FROM releases')
      .all();
    expect(releases.results).toHaveLength(1);
    expect(releases.results[0]).toMatchObject({
      title: 'Test Movie 2026 2160p',
      first_seen_at: '2026-06-08T00:00:00Z',
      last_seen_at: '2026-06-09T00:00:00Z',
    });
  });
});

describe('CatalogRepository (real D1)', () => {
  it('loadMovies filters by language and loadStats counts the catalog', async () => {
    const scraping = new ScrapingRepository(harness.db);
    const source = await scraping.findSource('scnsrc');
    const sourceId = source!.id;

    const seed = async (
      externalId: string,
      imdbId: string,
      postedAt: string,
    ): Promise<void> =>
      scraping.upsertRelease(
        sourceId,
        {
          externalId,
          imdbId,
          title: `Release ${externalId}`,
          url: `https://example.test/${externalId}`,
          postHtml: '<p>body</p>',
          postedAt,
        },
        postedAt,
      );

    await seed('en-1', 'tt2000001', '2026-06-01T00:00:00Z');
    await seed('hi-1', 'tt2000002', '2026-06-02T00:00:00Z');

    // Enrich only the English movie so the language filter has a target.
    await harness.db
      .prepare(
        `INSERT INTO tmdb_movies
            (imdb_id, status, original_language, raw_response, fetched_at)
          VALUES (?, 'found', 'en', '{}', '2026-06-03T00:00:00Z')`,
      )
      .bind('tt2000001')
      .run();

    const catalog = new CatalogRepository(harness.db);

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
   * The composite score, tier and prestige detection are now computed
   * entirely in SQL, so this exercises the real D1 query: a strong
   * prestige title must outscore a weak one and earn an 'A' tier.
   */
  it('scores and tiers movies in SQL (sort=score)', async () => {
    const scraping = new ScrapingRepository(harness.db);
    const sourceId = (await scraping.findSource('scnsrc'))!.id;
    const seedRelease = async (
      ext: string,
      imdb: string,
      postedAt: string,
    ): Promise<void> =>
      scraping.upsertRelease(
        sourceId,
        {
          externalId: ext,
          imdbId: imdb,
          title: `Release ${ext}`,
          url: `https://example.test/${ext}`,
          postHtml: '<p>b</p>',
          postedAt,
        },
        postedAt,
      );
    // Same posted date so recency is equal — score order is decided by
    // the rating / budget / prestige signals alone.
    await seedRelease('s-strong', 'tt3000001', '2026-06-01T00:00:00Z');
    await seedRelease('s-weak', 'tt3000002', '2026-06-01T00:00:00Z');

    await harness.db.batch([
      harness.db
        .prepare(
          `INSERT INTO tmdb_movies (imdb_id, status, original_language,
             vote_average, vote_count, budget, production_companies,
             raw_response, fetched_at)
           VALUES (?, 'found', 'en', 8.0, 5000, 200000000,
             '[{"id":210099,"name":"Amazon MGM"}]', '{}', '2026-06-03T00:00:00Z')`,
        )
        .bind('tt3000001'),
      harness.db
        .prepare(
          `INSERT INTO tmdb_movies (imdb_id, status, original_language,
             vote_average, vote_count, budget, raw_response, fetched_at)
           VALUES (?, 'found', 'en', 4.0, 5, 0, '{}', '2026-06-03T00:00:00Z')`,
        )
        .bind('tt3000002'),
    ]);

    const catalog = new CatalogRepository(harness.db);
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
    const scraping = new ScrapingRepository(harness.db);
    const sourceId = (await scraping.findSource('scnsrc'))!.id;
    const seedRelease = async (
      ext: string,
      imdb: string,
      postedAt: string,
    ): Promise<void> =>
      scraping.upsertRelease(
        sourceId,
        {
          externalId: ext,
          imdbId: imdb,
          title: `Release ${ext}`,
          url: `https://example.test/${ext}`,
          postHtml: '<p>b</p>',
          postedAt,
        },
        postedAt,
      );
    // Newer first in date order: tt-a (Jun 2) then tt-b (Jun 1).
    await seedRelease('p-a', 'tt4000001', '2026-06-02T00:00:00Z');
    await seedRelease('p-b', 'tt4000002', '2026-06-01T00:00:00Z');

    // Two 600 GB torrents — cumulative 1.2 TB overflows the 1 TB budget,
    // so the second (older) one must not fit.
    const big = 600_000_000_000;
    await harness.db.batch([
      harness.db
        .prepare(
          `INSERT INTO torrents (imdb_id, info_hash, title, raw_title,
             size_bytes, seeders, fetched_at)
           VALUES (?, 'hasha', 'A', 'A', ?, 10, '2026-06-03T00:00:00Z')`,
        )
        .bind('tt4000001', big),
      harness.db
        .prepare(
          `INSERT INTO torrents (imdb_id, info_hash, title, raw_title,
             size_bytes, seeders, fetched_at)
           VALUES (?, 'hashb', 'B', 'B', ?, 10, '2026-06-03T00:00:00Z')`,
        )
        .bind('tt4000002', big),
    ]);

    const catalog = new CatalogRepository(harness.db);
    const rows = await catalog.loadMovies('all', 'date', 'plan');

    expect(rows.map((r) => r.imdb_id)).toEqual(['tt4000001', 'tt4000002']);
    expect(rows.map((r) => r.cum_size_bytes)).toEqual([big, big * 2]);
    expect(rows.map((r) => r.fits)).toEqual([1, 0]);
  });
});
