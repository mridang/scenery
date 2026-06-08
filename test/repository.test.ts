import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { CatalogRepository } from '../src/lib/catalog/repository';
import { ScrapingRepository } from '../src/lib/scraping/repository';
import type { ExtractedRelease } from '../src/lib/sources/types';

// v0.16 of the pool dropped per-test storage isolation, so migrations are
// applied once (in the setup file) and writes persist across tests in a
// file. Wipe every mutable table before each test — children before
// parents to respect D1's enforced foreign keys — while leaving the
// `sources` seed from 0001/0010 intact.
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM fetch_attempts'),
    env.DB.prepare('DELETE FROM page_snapshots'),
    env.DB.prepare('DELETE FROM releases'),
    env.DB.prepare('DELETE FROM tmdb_movies'),
    env.DB.prepare('DELETE FROM tmdb_people'),
    env.DB.prepare('DELETE FROM tmdb_genres'),
    env.DB.prepare('DELETE FROM torrents'),
    env.DB.prepare('DELETE FROM torrent_lookups'),
    env.DB.prepare('DELETE FROM movies'),
  ]);
});

/**
 * These run inside workerd against a real in-memory D1 (not a SQL mock),
 * so they exercise the actual ON CONFLICT upsert semantics, the seeded
 * `scnsrc` source, and the multi-table joins the catalog page relies on.
 */
describe('ScrapingRepository (real D1)', () => {
  it('upserts movie + release and dedupes on re-scrape', async () => {
    const repo = new ScrapingRepository(env.DB);

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

    const movies = await env.DB.prepare(
      'SELECT imdb_id, first_seen_at, last_seen_at FROM movies',
    ).all();
    expect(movies.results).toHaveLength(1);
    expect(movies.results[0]).toMatchObject({
      imdb_id: 'tt1234567',
      first_seen_at: '2026-06-08T00:00:00Z',
      last_seen_at: '2026-06-09T00:00:00Z',
    });

    const releases = await env.DB.prepare(
      'SELECT title, first_seen_at, last_seen_at FROM releases',
    ).all();
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
    const scraping = new ScrapingRepository(env.DB);
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
    await env.DB.prepare(
      `INSERT INTO tmdb_movies
          (imdb_id, status, original_language, raw_response, fetched_at)
        VALUES (?, 'found', 'en', '{}', '2026-06-03T00:00:00Z')`,
    )
      .bind('tt2000001')
      .run();

    const catalog = new CatalogRepository(env.DB);

    const all = await catalog.loadMovies('all');
    expect(all.map((m) => m.imdb_id).sort()).toEqual([
      'tt2000001',
      'tt2000002',
    ]);

    const english = await catalog.loadMovies('en');
    expect(english).toHaveLength(1);
    expect(english[0]?.imdb_id).toBe('tt2000001');

    const stats = await catalog.loadStats();
    expect(stats.movies).toBe(2);
    expect(stats.releases).toBe(2);
    expect(stats.tmdb_found).toBe(1);
    expect(stats.tmdb_pending).toBe(1);
  });
});
