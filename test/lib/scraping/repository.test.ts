import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';

import { ScrapingRepository } from '../../../src/lib/scraping/repository';
import type { ExtractedRelease } from '../../../src/lib/sources/types';
import { createTestD1, wipe, type TestD1 } from '../../d1';

/**
 * Runs against a real workerd-backed D1 (via Miniflare), so it exercises
 * the actual ON CONFLICT upsert semantics and the seeded `scnsrc` source.
 */
let harness: TestD1;

beforeAll(async () => {
  harness = await createTestD1();
});
afterAll(async () => {
  await harness.dispose();
});
beforeEach(async () => {
  await wipe(harness.db);
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
