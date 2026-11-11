import { databaseFrom, type Database } from '@/domain/db/client';
import { beforeEach, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

import { ScrapingRepository } from '@/domain/scraping/repository';
import type { ExtractedRelease } from '@/lib/sources/types';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  queryPlan,
  recordStatements,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

/**
 * Runs against a SQLite-backed D1 stand-in with the migrations applied, so it
 * exercises the actual ON CONFLICT upsert semantics and the seeded `scnsrc`
 * source.
 */
let d1: D1Database;
let raw: DatabaseSync;
let db: Database;

beforeEach(() => {
  const built = sqliteD1(...APP_MIGRATIONS);
  d1 = built.d1;
  raw = built.raw;
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

  it('nextAttemptNumber counts on from the newest attempt of the page', async () => {
    const repo = new ScrapingRepository(db);
    const sourceId = (await repo.findSource('scnsrc'))!.id;
    for (const attemptNumber of [1, 2, 3]) {
      await repo.insertFailedAttempt({
        sourceId,
        pageNumber: 1,
        pageUrl: 'https://example.test/page/1',
        attemptNumber,
        startedAt: '2026-06-01T00:00:00Z',
        finishedAt: '2026-06-01T00:00:01Z',
      });
    }
    expect(await repo.nextAttemptNumber(sourceId, 1)).toBe(4);
    expect(await repo.nextAttemptNumber(sourceId, 2)).toBe(1);
  });

  it('nextAttemptNumber reads the newest attempt through the attempt index', async () => {
    const { d1: recorded, statements } = recordStatements(d1);
    const sourceId = (await new ScrapingRepository(db).findSource('scnsrc'))!
      .id;
    await new ScrapingRepository(databaseFrom(recorded)).nextAttemptNumber(
      sourceId,
      1,
    );
    const plans = statements.flatMap((sql) => queryPlan(raw, sql));
    expect(
      plans.some((line) => line.includes('fetch_attempts_src_page_idx')),
    ).toBe(true);
    expect(plans.filter((line) => line.includes('TEMP B-TREE'))).toEqual([]);
  });
});

describe('ScrapingRepository.upsertRelease and movies.newest_posted_at', () => {
  const release = (
    externalId: string,
    postedAt: string | undefined,
  ): ExtractedRelease => ({
    externalId,
    imdbId: 'tt8000001',
    title: externalId,
    url: `https://example.test/${externalId}`,
    postHtml: '<p/>',
    postedAt,
  });
  const newest = (): unknown =>
    raw
      .prepare(
        `SELECT newest_posted_at AS n FROM movies WHERE imdb_id = 'tt8000001'`,
      )
      .get()?.['n'];

  it('holds the newest release time of the movie', async () => {
    const repo = new ScrapingRepository(db);
    const sourceId = (await repo.findSource('scnsrc'))!.id;
    await repo.upsertRelease(
      sourceId,
      release('a', '2026-06-01T00:00:00Z'),
      '2026-06-09T00:00:00Z',
    );
    expect(newest()).toBe('2026-06-01T00:00:00Z');
    await repo.upsertRelease(
      sourceId,
      release('b', '2026-06-05T00:00:00Z'),
      '2026-06-09T00:00:00Z',
    );
    expect(newest()).toBe('2026-06-05T00:00:00Z');
  });

  it('falls back to first_seen_at for a release without a date', async () => {
    const repo = new ScrapingRepository(db);
    const sourceId = (await repo.findSource('scnsrc'))!.id;
    await repo.upsertRelease(
      sourceId,
      release('a', undefined),
      '2026-06-09T00:00:00Z',
    );
    expect(newest()).toBe('2026-06-09T00:00:00Z');
  });

  it('follows a re-scrape that moves posted_at back', async () => {
    const repo = new ScrapingRepository(db);
    const sourceId = (await repo.findSource('scnsrc'))!.id;
    await repo.upsertRelease(
      sourceId,
      release('a', '2026-06-05T00:00:00Z'),
      '2026-06-09T00:00:00Z',
    );
    await repo.upsertRelease(
      sourceId,
      release('a', '2026-06-02T00:00:00Z'),
      '2026-06-10T00:00:00Z',
    );
    expect(newest()).toBe('2026-06-02T00:00:00Z');
  });
});
