import { describe, expect, it } from '@jest/globals';

import { TmdbClient } from '@/lib/tmdb/client';
import type { TmdbFindResponse } from '@/lib/tmdb';

/** Returns the item at `index`, failing the test loudly when it is absent. */
function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`expected an item at index ${index}`);
  }
  return item;
}

/**
 * Build a `typeof fetch` stub that records the URL it was called with and
 * returns a canned response. The TmdbClient only ever passes a `URL` (or a
 * string) as the first arg, so we normalise to a string for inspection.
 */
function stubTransport(
  handler: (url: string) => { status: number; body: string },
): { transport: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const transport = (async (input: URL | RequestInfo): Promise<Response> => {
    const url = input instanceof URL ? input.toString() : String(input);
    calls.push(url);
    const { status, body } = handler(url);
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { transport, calls };
}

const FOUND_MOVIE: TmdbFindResponse = {
  movie_results: [
    {
      id: 27205,
      title: 'Inception',
      original_title: 'Inception',
      release_date: '2010-07-15',
      vote_average: 8.4,
      vote_count: 35000,
    },
  ],
};

describe('TmdbClient', () => {
  it('throws when constructed without an api key', () => {
    const { transport } = stubTransport(() => ({ status: 200, body: '{}' }));
    expect(() => new TmdbClient({ apiKey: '' }, transport)).toThrow(/apiKey/);
  });

  it('builds the find request URL with the imdb id, external_source and api key', async () => {
    const { transport, calls } = stubTransport(() => ({
      status: 200,
      body: JSON.stringify(FOUND_MOVIE),
    }));
    const client = new TmdbClient({ apiKey: 'secret-key' }, transport);

    await client.findByImdb('tt1375666');

    expect(calls).toHaveLength(1);
    const url = new URL(nth(calls, 0));
    expect(url.origin + url.pathname).toBe(
      'https://api.themoviedb.org/3/find/tt1375666',
    );
    expect(url.searchParams.get('external_source')).toBe('imdb_id');
    expect(url.searchParams.get('api_key')).toBe('secret-key');
  });

  it('honours a custom baseUrl', async () => {
    const { transport, calls } = stubTransport(() => ({
      status: 200,
      body: '{"genres":[]}',
    }));
    const client = new TmdbClient(
      {
        apiKey: 'k',
        baseUrl: 'https://proxy.example/tmdb',
      },
      transport,
    );

    await client.getMovieGenres();

    const url = new URL(nth(calls, 0));
    expect(url.origin + url.pathname).toBe(
      'https://proxy.example/tmdb/genre/movie/list',
    );
  });

  it('parses a found movie into a typed success result', async () => {
    const { transport } = stubTransport(() => ({
      status: 200,
      body: JSON.stringify(FOUND_MOVIE),
    }));
    const client = new TmdbClient({ apiKey: 'k' }, transport);

    const res = await client.findByImdb('tt1375666');

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe(200);
      expect(res.value.movie_results?.[0]?.id).toBe(27205);
      expect(res.value.movie_results?.[0]?.title).toBe('Inception');
    }
  });

  it('appends credits when requesting a movie', async () => {
    const { transport, calls } = stubTransport(() => ({
      status: 200,
      body: '{"runtime":148}',
    }));
    const client = new TmdbClient({ apiKey: 'k' }, transport);

    const res = await client.getMovieWithCredits(27205);

    const url = new URL(nth(calls, 0));
    expect(url.origin + url.pathname).toBe(
      'https://api.themoviedb.org/3/movie/27205',
    );
    expect(url.searchParams.get('append_to_response')).toBe('credits');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.runtime).toBe(148);
    }
  });

  it('returns a typed failure on a 404 / not-found', async () => {
    const { transport } = stubTransport(() => ({
      status: 404,
      body: '{"status_message":"not found"}',
    }));
    const client = new TmdbClient({ apiKey: 'k' }, transport);

    const res = await client.findByImdb('tt0000000');

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(404);
      expect(res.error).toBe('http 404');
      expect(res.raw).toContain('not found');
    }
  });

  it('returns a failure (without httpStatus) when the transport throws', async () => {
    const transport = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const client = new TmdbClient({ apiKey: 'k' }, transport);

    const res = await client.findByImdb('tt1');

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('network down');
      expect(res.status).toBeUndefined();
    }
  });

  it('returns a failure when a 200 body is not valid JSON', async () => {
    const { transport } = stubTransport(() => ({
      status: 200,
      body: 'not json{',
    }));
    const client = new TmdbClient({ apiKey: 'k' }, transport);

    const res = await client.findByImdb('tt1');

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(200);
      expect(res.raw).toBe('not json{');
    }
  });
});
