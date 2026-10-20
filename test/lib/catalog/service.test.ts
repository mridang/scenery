import { describe, expect, it } from '@jest/globals';

import { CatalogService } from '../../../src/lib/catalog/service';
import type {
  CatalogReader,
  CatalogStats,
  LangCount,
  LastUpdate,
  ScoredRow,
} from '../../../src/lib/catalog/types';

function scoredRow(overrides: Partial<ScoredRow> = {}): ScoredRow {
  return {
    imdb_id: 'tt0000001',
    tmdb_id: 1,
    tmdb_status: 'found',
    tmdb_title: 'Sample',
    tmdb_year: 2026,
    release_date: null,
    tmdb_genre_ids: null,
    poster_path: null,
    backdrop_path: null,
    vote_average: null,
    vote_count: null,
    popularity: null,
    runtime: null,
    budget: null,
    imdb_rating: null,
    imdb_votes: null,
    metacritic_score: null,
    rt_score: null,
    talent_score: null,
    original_language: 'en',
    director: null,
    top_cast: null,
    production_companies: null,
    first_seen_at: '2026-06-01T00:00:00.000Z',
    release_count: 1,
    latest_release_title: null,
    latest_release_at: null,
    first_posted_at: null,
    torrent_status: null,
    torrent_count: null,
    best_info_hash: null,
    best_torrent_title: null,
    best_source: null,
    best_size_bytes: null,
    best_seeders: null,
    best_quality: null,
    // Scoring columns the SQL query would have populated.
    score: 0,
    tier: 'B',
    prestige_ids: null,
    cum_size_bytes: null,
    fits: 1,
    ...overrides,
  };
}

/**
 * In-memory {@link CatalogReader} stub. Records the (lang, sort, view)
 * triple passed to loadMovies so we can assert the service forwards the
 * selection strategy to the database, and returns supplied fixtures.
 */
class FakeReader implements CatalogReader {
  public lastArgs: { lang: string; sort: string; view: string } | null = null;
  public constructor(private readonly movies: ScoredRow[]) {}

  public loadMovies(
    lang: string,
    sort: string,
    view: string,
  ): Promise<ScoredRow[]> {
    this.lastArgs = { lang, sort, view };
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

describe('CatalogService.view — strategy is delegated to SQL', () => {
  it('forwards the (lang, sort, view) selection strategy to the reader', async () => {
    const reader = new FakeReader([scoredRow()]);
    const svc = new CatalogService(reader);
    await svc.view({ lang: 'fr', sort: 'score', view: 'plan' });
    expect(reader.lastArgs).toEqual({
      lang: 'fr',
      sort: 'score',
      view: 'plan',
    });
  });

  it('preserves the order the reader returned (SQL already sorted)', async () => {
    const reader = new FakeReader([
      scoredRow({ imdb_id: 'tt-a', score: 10 }),
      scoredRow({ imdb_id: 'tt-b', score: 99 }),
    ]);
    const svc = new CatalogService(reader);
    const { movies } = await svc.view({
      lang: 'all',
      sort: 'score',
      view: 'catalog',
    });
    expect(movies.map((m) => m.row.imdb_id)).toEqual(['tt-a', 'tt-b']);
    expect(movies.map((m) => m.score)).toEqual([10, 99]);
  });
});

describe('CatalogService.view — prestige labels', () => {
  it('maps matched prestige ids to distinct studio labels', async () => {
    const reader = new FakeReader([
      scoredRow({ imdb_id: 'tt-mgm', prestige_ids: '[210099]' }),
      scoredRow({ imdb_id: 'tt-hbo', prestige_ids: '[3268,7429]' }), // both HBO
      scoredRow({ imdb_id: 'tt-none', prestige_ids: null }),
    ]);
    const svc = new CatalogService(reader);
    const { movies } = await svc.view({
      lang: 'all',
      sort: 'date',
      view: 'catalog',
    });
    expect(movies[0]!.studios).toEqual(['Amazon MGM']);
    expect(movies[1]!.studios).toEqual(['HBO']);
    expect(movies[2]!.studios).toEqual([]);
  });
});

describe('CatalogService.view — genre and cast resolution', () => {
  it('resolves genre ids to names and parses the cast list', async () => {
    const reader = new FakeReader([
      scoredRow({
        // 28 is in the stub lookup (Action); 99 is unknown → "#99".
        tmdb_genre_ids: '[28, 99]',
        top_cast: '[{"name":"Ada"},{"name":"Bo"},{"noname":true}]',
      }),
    ]);
    const svc = new CatalogService(reader);
    const { movies } = await svc.view({
      lang: 'all',
      sort: 'date',
      view: 'catalog',
    });
    expect(movies[0]!.genres).toEqual(['Action', '#99']);
    expect(movies[0]!.cast).toEqual(['Ada', 'Bo']);
  });

  it('yields empty arrays for null / malformed JSON', async () => {
    const reader = new FakeReader([
      scoredRow({ tmdb_genre_ids: null, top_cast: 'not json' }),
    ]);
    const svc = new CatalogService(reader);
    const { movies } = await svc.view({
      lang: 'all',
      sort: 'date',
      view: 'catalog',
    });
    expect(movies[0]!.genres).toEqual([]);
    expect(movies[0]!.cast).toEqual([]);
  });
});

describe('CatalogService.view — catalog view', () => {
  it('carries the SQL running total but always fits with no plan summary', async () => {
    const reader = new FakeReader([
      scoredRow({ cum_size_bytes: 999, fits: 0 }),
    ]);
    const svc = new CatalogService(reader);
    const { movies, plan } = await svc.view({
      lang: 'all',
      sort: 'date',
      view: 'catalog',
    });
    // cumBytes passes the SQL value through (the feed's budgetGb gate
    // relies on it), but fits is forced true and no plan is built.
    expect(movies[0]!.cumBytes).toBe(999);
    expect(movies[0]!.fits).toBe(true);
    expect(plan).toBeUndefined();
  });
});

describe('CatalogService.view — plan view surfaces the SQL budget', () => {
  it('passes through cum_size_bytes / fits and tallies the plan summary', async () => {
    const reader = new FakeReader([
      scoredRow({ imdb_id: 'tt-1', cum_size_bytes: 400, fits: 1 }),
      scoredRow({ imdb_id: 'tt-2', cum_size_bytes: 900, fits: 1 }),
      scoredRow({ imdb_id: 'tt-3', cum_size_bytes: 1500, fits: 0 }),
    ]);
    const svc = new CatalogService(reader);
    const { movies, plan } = await svc.view({
      lang: 'all',
      sort: 'date',
      view: 'plan',
    });
    expect(movies.map((m) => m.cumBytes)).toEqual([400, 900, 1500]);
    expect(movies.map((m) => m.fits)).toEqual([true, true, false]);
    // Two rows fit; bytesFits is the running total of the last fitting row.
    expect(plan).toEqual({ fits: 2, skipped: 1, bytesFits: 900 });
  });
});
