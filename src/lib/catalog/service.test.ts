import { describe, expect, it } from '@jest/globals';

import { CatalogService } from './service';
import type {
  CatalogReader,
  CatalogStats,
  LangCount,
  LastUpdate,
  MovieRow,
} from './types';
import { BUDGET_BYTES } from './types';

function row(overrides: Partial<MovieRow> = {}): MovieRow {
  return {
    imdb_id: 'tt0000001',
    tmdb_id: 1,
    tmdb_status: 'found',
    tmdb_title: 'Sample',
    tmdb_year: 2026,
    release_date: null,
    tmdb_genre_ids: null,
    poster_path: null,
    vote_average: null,
    vote_count: null,
    popularity: null,
    runtime: null,
    budget: null,
    talent_score: null,
    original_language: 'en',
    director: null,
    top_cast: null,
    production_companies: null,
    first_seen_at: '2026-06-01T00:00:00.000Z',
    release_count: 1,
    latest_release_title: null,
    latest_release_at: null,
    // Null so scoring is time-independent: recency contributes 0 and the
    // test stays deterministic regardless of the wall clock.
    first_posted_at: null,
    torrent_status: null,
    torrent_count: null,
    best_info_hash: null,
    best_torrent_title: null,
    best_source: null,
    best_size_bytes: null,
    best_seeders: null,
    best_quality: null,
    ...overrides,
  };
}

/**
 * In-memory {@link CatalogReader} stub. Records the language passed to
 * loadMovies so we can assert the service forwards it, and returns
 * whatever fixtures the test supplied.
 */
class FakeReader implements CatalogReader {
  public lastLang: string | null = null;
  public constructor(private readonly movies: MovieRow[]) {}

  public loadMovies(lang: string): Promise<MovieRow[]> {
    this.lastLang = lang;
    return Promise.resolve(this.movies);
  }
  public loadGenres(): Promise<Map<number, string>> {
    return Promise.resolve(new Map([[28, 'Action']]));
  }
  public loadStats(): Promise<CatalogStats> {
    return Promise.resolve({
      releases: 5,
      movies: 3,
      snapshots: 2,
      failed_attempts: 0,
      tmdb_found: 3,
      tmdb_not_found: 0,
      tmdb_pending: 0,
    });
  }
  public loadLanguageCounts(): Promise<LangCount[]> {
    return Promise.resolve([{ code: 'en', count: 3 }]);
  }
  public loadLastUpdate(): Promise<LastUpdate> {
    return Promise.resolve({
      scrapeAt: '2026-06-07T00:00:00.000Z',
      scrapeSource: 'scnsrc',
      enrichAt: null,
      torrentsAt: null,
      torrentsProvider: null,
    });
  }
}

describe('CatalogService delegations', () => {
  const svc = new CatalogService(new FakeReader([]));

  it('forwards stats from the reader', async () => {
    expect((await svc.stats()).movies).toBe(3);
  });
  it('forwards genres from the reader', async () => {
    expect((await svc.genres()).get(28)).toBe('Action');
  });
  it('forwards language counts from the reader', async () => {
    expect(await svc.languageCounts()).toEqual([{ code: 'en', count: 3 }]);
  });
  it('forwards last-update from the reader', async () => {
    expect((await svc.lastUpdate()).scrapeSource).toBe('scnsrc');
  });
});

describe('CatalogService.view — language', () => {
  it('passes the requested language through to the reader', async () => {
    const reader = new FakeReader([row()]);
    const svc = new CatalogService(reader);
    await svc.view({ lang: 'fr', sort: 'date', view: 'catalog' });
    expect(reader.lastLang).toBe('fr');
  });
});

describe('CatalogService.view — sort strategies', () => {
  // The DB returns rows already ordered "recent first"; date sort must
  // preserve that order, score sort must re-order by descending score.
  const movies = [
    row({ imdb_id: 'tt-weak', vote_average: 4, vote_count: 10 }),
    row({ imdb_id: 'tt-strong', vote_average: 9, vote_count: 5000 }),
  ];

  it("sort='date' preserves the reader's order", async () => {
    const svc = new CatalogService(new FakeReader(movies));
    const { movies: out } = await svc.view({
      lang: 'all',
      sort: 'date',
      view: 'catalog',
    });
    expect(out.map((m) => m.row.imdb_id)).toEqual(['tt-weak', 'tt-strong']);
  });

  it("sort='score' orders by descending score", async () => {
    const svc = new CatalogService(new FakeReader(movies));
    const { movies: out } = await svc.view({
      lang: 'all',
      sort: 'score',
      view: 'catalog',
    });
    expect(out.map((m) => m.row.imdb_id)).toEqual(['tt-strong', 'tt-weak']);
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
  });

  it('does not attach a plan summary in catalog view', async () => {
    const svc = new CatalogService(new FakeReader(movies));
    const result = await svc.view({
      lang: 'all',
      sort: 'score',
      view: 'catalog',
    });
    expect(result.plan).toBeUndefined();
  });
});

describe('CatalogService.view — plan (within-budget) strategy', () => {
  it('tags cumulative bytes and flips fits when the budget overflows', async () => {
    const half = BUDGET_BYTES * 0.6;
    const movies = [
      row({ imdb_id: 'tt-a', best_size_bytes: half }),
      row({ imdb_id: 'tt-b', best_size_bytes: half }), // cumulative > budget
    ];
    const svc = new CatalogService(new FakeReader(movies));
    const { movies: out, plan } = await svc.view({
      lang: 'all',
      sort: 'date',
      view: 'plan',
    });

    expect(out[0]!.cumBytes).toBe(half);
    expect(out[0]!.fits).toBe(true);
    expect(out[1]!.cumBytes).toBe(half * 2);
    expect(out[1]!.fits).toBe(false);
    expect(plan).toEqual({ fits: 1, skipped: 1, bytesFits: half });
  });

  it('excludes rows without a measured torrent size from the plan', async () => {
    const movies = [
      row({ imdb_id: 'tt-sized', best_size_bytes: 1_000 }),
      row({ imdb_id: 'tt-unsized', best_size_bytes: null }),
    ];
    const svc = new CatalogService(new FakeReader(movies));
    const { movies: out } = await svc.view({
      lang: 'all',
      sort: 'date',
      view: 'plan',
    });
    expect(out.map((m) => m.row.imdb_id)).toEqual(['tt-sized']);
  });
});
