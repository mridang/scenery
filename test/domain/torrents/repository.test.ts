import { databaseFrom, type Database } from '@/domain/db/client';
import { beforeEach, describe, expect, it } from '@jest/globals';

import { ScrapingRepository } from '@/domain/scraping/repository';
import { TorrentRepository } from '@/domain/torrents/repository';
import type { ResolvedLookup } from '@/lib/torrents/types';
import { APP_MIGRATIONS } from '../../lib/db/migrations';
import { sqliteD1 } from '../../lib/db/sqlite-d1';

/**
 * Tests for the torrent repository: the candidate gate (maturity +
 * lookup status), the too-fresh counter, and persist/totalStored. Seeds via
 * ScrapingRepository so the releases/movies joins are realistic; lookup rows
 * go in through the repository or raw SQL.
 */
let d1: D1Database;
let db: Database;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const old = (): string => new Date(Date.now() - 3 * ONE_DAY_MS).toISOString(); // >24h ago
const recent = (): string =>
  new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago

beforeEach(() => {
  d1 = sqliteD1(...APP_MIGRATIONS).d1;
  db = databaseFrom(d1);
});

/** Seed a movie + release for the seeded `scnsrc` source with a posted_at. */
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

/** Insert a torrent_lookups row directly with a chosen status. */
async function seedLookup(imdb: string, status: string): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO torrent_lookups
         (imdb_id, status, searched_at, attempt_count, result_count)
       VALUES (?, ?, ?, 1, 0)`,
    )
    .bind(imdb, status, new Date().toISOString())
    .run();
}

describe('TorrentRepository.candidates (SQLite-backed D1)', () => {
  it('returns a mature movie with no lookup row', async () => {
    await seedRelease('m-1', 'tt5000001', old());
    const repo = new TorrentRepository(db);

    const ids = await repo.candidates(10);
    expect(ids).toEqual(['tt5000001']);
  });

  it('excludes a movie whose newest release is within 24h unless force', async () => {
    await seedRelease('m-fresh', 'tt5000002', recent());
    const repo = new TorrentRepository(db);

    expect(await repo.candidates(10)).toEqual([]);
    expect(await repo.candidates(10, true)).toEqual(['tt5000002']);
  });

  it("treats a 'error' lookup as a candidate but 'success' as resolved", async () => {
    await seedRelease('m-err', 'tt5000003', old());
    await seedRelease('m-ok', 'tt5000004', old());
    await seedLookup('tt5000003', 'error');
    await seedLookup('tt5000004', 'success');
    const repo = new TorrentRepository(db);

    const ids = await repo.candidates(10);
    expect(ids).toEqual(['tt5000003']);
  });

  it("also excludes movies with an 'empty' lookup (any non-error status)", async () => {
    await seedRelease('m-empty', 'tt5000005', old());
    await seedLookup('tt5000005', 'empty');
    const repo = new TorrentRepository(db);

    expect(await repo.candidates(10)).toEqual([]);
  });

  it('orders by newest release ascending and respects the limit', async () => {
    await seedRelease(
      'a',
      'tt5000010',
      new Date(Date.now() - 5 * ONE_DAY_MS).toISOString(),
    );
    await seedRelease(
      'b',
      'tt5000011',
      new Date(Date.now() - 4 * ONE_DAY_MS).toISOString(),
    );
    await seedRelease(
      'c',
      'tt5000012',
      new Date(Date.now() - 3 * ONE_DAY_MS).toISOString(),
    );
    const repo = new TorrentRepository(db);

    const ids = await repo.candidates(2);
    expect(ids).toEqual(['tt5000010', 'tt5000011']);
  });
});

describe('TorrentRepository.tooFreshCount (SQLite-backed D1)', () => {
  it('counts movies with no lookup whose newest release is within 24h', async () => {
    await seedRelease('fresh-1', 'tt6000001', recent());
    await seedRelease('fresh-2', 'tt6000002', recent());
    await seedRelease('mature', 'tt6000003', old());
    const repo = new TorrentRepository(db);

    expect(await repo.tooFreshCount()).toBe(2);
  });

  it('does not count a fresh movie that already has any lookup row', async () => {
    await seedRelease('fresh-looked', 'tt6000004', recent());
    await seedLookup('tt6000004', 'error');
    const repo = new TorrentRepository(db);

    expect(await repo.tooFreshCount()).toBe(0);
  });
});

describe('TorrentRepository.persist + totalStored (SQLite-backed D1)', () => {
  it('stores torrents and writes a lookup row on success', async () => {
    await seedRelease('p-1', 'tt7000001', old());
    const repo = new TorrentRepository(db);

    const resolved: ResolvedLookup = {
      provider: 'apibay',
      attempted: [{ provider: 'apibay', status: 'success' }],
      result: {
        status: 'success',
        rawResponse: '[]',
        torrents: [
          {
            infoHash: 'abc123',
            title: 'Movie.2026.1080p.WEB-DL',
            rawTitle: 'Movie.2026.1080p.WEB-DL',
            source: 'ThePirateBay',
            seeders: 42,
            sizeBytes: 8_000_000_000,
            quality: '1080p',
            isHdr: false,
            isRemux: false,
          },
        ],
      },
    };

    await repo.persist('tt7000001', resolved);

    expect(await repo.totalStored()).toBe(1);

    const lookup = await d1
      .prepare(
        `SELECT status, result_count, provider FROM torrent_lookups WHERE imdb_id = ?`,
      )
      .bind('tt7000001')
      .first<{ status: string; result_count: number; provider: string }>();
    expect(lookup?.status).toBe('success');
    expect(lookup?.result_count).toBe(1);
    expect(lookup?.provider).toBe('apibay');

    // The movie is no longer a candidate now that it has a success lookup.
    expect(await repo.candidates(10)).toEqual([]);
  });

  it('writes only a lookup row (no torrents) on an empty result', async () => {
    await seedRelease('p-2', 'tt7000002', old());
    const repo = new TorrentRepository(db);

    await repo.persist('tt7000002', {
      provider: 'apibay',
      attempted: [{ provider: 'apibay', status: 'empty' }],
      result: { status: 'empty', rawResponse: '[]', torrents: [] },
    });

    expect(await repo.totalStored()).toBe(0);
    const n = await d1
      .prepare(`SELECT COUNT(*) AS n FROM torrent_lookups WHERE imdb_id = ?`)
      .bind('tt7000002')
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
  });
});
