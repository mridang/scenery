import { describe, expect, it } from '@jest/globals';

import { TmdbEnricher } from '../../../src/lib/tmdb/enricher';
import type { TmdbClient, TmdbResult } from '../../../src/lib/tmdb/client';
import type { TmdbRepository } from '../../../src/lib/tmdb/repository';
import type {
  TmdbFindResponse,
  TmdbMovieResponse,
  TmdbPersonResponse,
} from '../../../src/lib/tmdb/types';

/** Returns the item at `index`, failing the test loudly when it is absent. */
function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`expected an item at index ${index}`);
  }
  return item;
}

/** A recorded call: the repo method name plus its arguments. */
type Call = { method: string; args: readonly unknown[] };

/**
 * A fake repository that records every call. Only the methods the enricher
 * touches are implemented; everything is cast to the real interface so the
 * enricher is exercised exactly as in production.
 */
function fakeRepo(overrides: Partial<Record<string, unknown>> = {}): {
  repo: TmdbRepository;
  calls: Call[];
} {
  const calls: Call[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]): Promise<void> => {
      calls.push({ method, args });
      return Promise.resolve();
    };
  const base: Record<string, unknown> = {
    recordMovieError: record('recordMovieError'),
    recordMovieNotFound: record('recordMovieNotFound'),
    upsertFoundMovie: record('upsertFoundMovie'),
    updateMovieCredits: record('updateMovieCredits'),
    recordCreditsError: record('recordCreditsError'),
    upsertPerson: record('upsertPerson'),
    ...overrides,
  };
  return { repo: base as unknown as TmdbRepository, calls };
}

const ok = <T>(value: T, raw = '{}'): TmdbResult<T> => ({
  ok: true,
  value,
  raw,
  httpStatus: 200,
});
const fail = (error: string, raw = ''): TmdbResult<never> => ({
  ok: false,
  error,
  raw,
  httpStatus: 500,
});

/** A fake client returning whatever the test stubs each method to. */
function fakeClient(stubs: Partial<TmdbClient>): TmdbClient {
  return stubs as unknown as TmdbClient;
}

describe('TmdbEnricher.enrichMovie', () => {
  it('records an error and returns "error" when /find fails', async () => {
    const { repo, calls } = fakeRepo();
    const client = fakeClient({
      findByImdb: () => Promise.resolve(fail('http 500', 'boom')),
    });
    const enricher = new TmdbEnricher(client, repo);

    const verdict = await enricher.enrichMovie('tt1');

    expect(verdict).toBe('error');
    expect(calls.map((c) => c.method)).toEqual(['recordMovieError']);
    const [imdbId, raw, message] = nth(calls, 0).args;
    expect(imdbId).toBe('tt1');
    expect(raw).toBe('boom');
    expect(message).toBe('http 500');
  });

  it('records not-found and returns "not_found" on an empty result set', async () => {
    const { repo, calls } = fakeRepo();
    const empty: TmdbFindResponse = { movie_results: [] };
    const client = fakeClient({
      findByImdb: () => Promise.resolve(ok(empty, '{"movie_results":[]}')),
    });
    const enricher = new TmdbEnricher(client, repo);

    const verdict = await enricher.enrichMovie('tt2');

    expect(verdict).toBe('not_found');
    expect(calls.map((c) => c.method)).toEqual(['recordMovieNotFound']);
    expect(nth(calls, 0).args[0]).toBe('tt2');
  });

  it('persists a found movie then its credits and returns "found"', async () => {
    const { repo, calls } = fakeRepo();
    const find: TmdbFindResponse = {
      movie_results: [{ id: 27205, title: 'Inception' }],
    };
    const movie: TmdbMovieResponse = { runtime: 148 };
    const client = fakeClient({
      findByImdb: () => Promise.resolve(ok(find)),
      getMovieWithCredits: () => Promise.resolve(ok(movie, '{"runtime":148}')),
    });
    const enricher = new TmdbEnricher(client, repo);

    const verdict = await enricher.enrichMovie('tt1375666');

    expect(verdict).toBe('found');
    expect(calls.map((c) => c.method)).toEqual([
      'upsertFoundMovie',
      'updateMovieCredits',
    ]);
    // upsertFoundMovie is handed the first movie result.
    expect(nth(calls, 0).args[0]).toBe('tt1375666');
    expect(nth(calls, 0).args[1]).toEqual({ id: 27205, title: 'Inception' });
    // updateMovieCredits receives the parsed credits payload.
    expect(nth(calls, 1).args[0]).toBe('tt1375666');
    expect(nth(calls, 1).args[1]).toEqual(movie);
  });

  it('still returns "found" but records a credits error when /movie fails', async () => {
    const { repo, calls } = fakeRepo();
    const find: TmdbFindResponse = {
      movie_results: [{ id: 27205 }],
    };
    const client = fakeClient({
      findByImdb: () => Promise.resolve(ok(find)),
      getMovieWithCredits: () => Promise.resolve(fail('http 502', 'gateway')),
    });
    const enricher = new TmdbEnricher(client, repo);

    const verdict = await enricher.enrichMovie('tt9');

    expect(verdict).toBe('found');
    expect(calls.map((c) => c.method)).toEqual([
      'upsertFoundMovie',
      'recordCreditsError',
    ]);
    expect(nth(calls, 1).args[2]).toBe('http 502');
  });
});

describe('TmdbEnricher.enrichPerson', () => {
  it('returns false and persists nothing when the person fetch fails', async () => {
    const { repo, calls } = fakeRepo();
    const client = fakeClient({
      getPersonWithCredits: () => Promise.resolve(fail('http 500')),
    });
    const enricher = new TmdbEnricher(client, repo);

    const okFlag = await enricher.enrichPerson(287);

    expect(okFlag).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('computes prestige from vote counts and upserts the person', async () => {
    const { repo, calls } = fakeRepo();
    const person: TmdbPersonResponse = {
      id: 287,
      name: 'Brad Pitt',
      movie_credits: {
        cast: [{ id: 1, vote_count: 99 }],
        crew: [{ id: 2, job: 'Director', vote_count: 900 }],
      },
    };
    const client = fakeClient({
      getPersonWithCredits: () => Promise.resolve(ok(person, '{}')),
    });
    const enricher = new TmdbEnricher(client, repo);

    const okFlag = await enricher.enrichPerson(287);

    expect(okFlag).toBe(true);
    expect(calls.map((c) => c.method)).toEqual(['upsertPerson']);
    const [value, fallbackId, prestige, totalCredits] = nth(calls, 0).args as [
      TmdbPersonResponse,
      number,
      number,
      number,
    ];
    expect(value).toEqual(person);
    expect(fallbackId).toBe(287);
    // log10(99 + 900 + 1) === log10(1000) === 3.
    expect(prestige).toBeCloseTo(3, 10);
    // one cast credit + one Director crew credit.
    expect(totalCredits).toBe(2);
  });
});

describe('TmdbEnricher.refreshGenres', () => {
  it('throws when the genre fetch fails', async () => {
    const { repo } = fakeRepo({ upsertGenre: () => Promise.resolve() });
    const client = fakeClient({
      getMovieGenres: () => Promise.resolve(fail('http 500')),
    });
    const enricher = new TmdbEnricher(client, repo);

    await expect(enricher.refreshGenres()).rejects.toThrow(/tmdb genres/);
  });

  it('upserts every genre and returns the count', async () => {
    const calls: Call[] = [];
    const { repo } = fakeRepo({
      upsertGenre: (...args: unknown[]) => {
        calls.push({ method: 'upsertGenre', args });
        return Promise.resolve();
      },
    });
    const client = fakeClient({
      getMovieGenres: () =>
        Promise.resolve(
          ok([
            { id: 28, name: 'Action' },
            { id: 35, name: 'Comedy' },
          ]),
        ),
    });
    const enricher = new TmdbEnricher(client, repo);

    const n = await enricher.refreshGenres();

    expect(n).toBe(2);
    expect(calls.map((c) => c.args[0])).toEqual([
      { id: 28, name: 'Action' },
      { id: 35, name: 'Comedy' },
    ]);
  });
});
