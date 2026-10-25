import { databaseFrom, type Database } from '@/domain/db/client';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { ScrapingRepository } from '@/domain/scraping/repository';
import type { ExtractedRelease } from '@/lib/sources/types';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

/**
 * Runs against a SQLite-backed D1 stand-in with the migrations applied, so it
 * exercises the actual ON CONFLICT upsert semantics and the seeded `scnsrc`
 * source.
 */
let d1: D1Database;
let db: Database;

beforeEach(() => {
  d1 = sqliteD1(...APP_MIGRATIONS).d1;
  db = databaseFrom(d1);
});

describe('ScrapingRepository (SQLite-backed D1)', () => {
  it('upserts movie + release and dedupes on re-scrape', async () => {
    const repo = new ScrapingRepository(db);

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

    const movies = await d1
      .prepare('SELECT imdb_id, first_seen_at, last_seen_at FROM movies')
      .all();
    expect(movies.results).toHaveLength(1);
    expect(movies.results[0]).toMatchObject({
      imdb_id: 'tt1234567',
      first_seen_at: '2026-06-08T00:00:00Z',
      last_seen_at: '2026-06-09T00:00:00Z',
    });

    const releases = await d1
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
