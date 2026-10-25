/**
 * @packageDocumentation
 *
 * Thin client for TMDB's REST API, built on {@link JsonClient}: each method
 * picks a path, query and response schema and returns a {@link Result}. It
 * knows nothing about D1 or enrichment policy — that lives in the enricher.
 */

import { JsonClient, type Result } from '@/lib/http';

import {
  tmdbFindResponseSchema,
  tmdbGenresResponseSchema,
  tmdbMovieResponseSchema,
  tmdbPersonResponseSchema,
  type TmdbFindResponse,
  type TmdbGenre,
  type TmdbMovieResponse,
  type TmdbPersonResponse,
} from './models';

/** Options for {@link TmdbClient}. @public */
export interface TmdbClientOptions {
  /** TMDB v3 API key. Required. */
  readonly apiKey: string;
  /** Override the API root. Defaults to `https://api.themoviedb.org/3`. */
  readonly baseUrl?: string;
}

/** The outcome of a TMDB call (the shared {@link Result}). @public */
export type TmdbResult<T> = Result<T>;

const ACCEPT_JSON: RequestInit = { headers: { Accept: 'application/json' } };

/** Client for TMDB's REST API. @public */
export class TmdbClient {
  private readonly http: JsonClient;
  private readonly apiKey: string;

  /** @throws When no API key is provided. */
  public constructor(
    options: TmdbClientOptions,
    fetcher: typeof fetch = globalThis.fetch,
  ) {
    if (!options.apiKey) {
      throw new Error('TmdbClient requires apiKey');
    }
    this.apiKey = options.apiKey;
    this.http = new JsonClient(
      options.baseUrl ?? 'https://api.themoviedb.org/3',
      fetcher,
    );
  }

  /** The query for a request, always carrying the api key. */
  private query(extra: Record<string, string> = {}): Record<string, string> {
    return { ...extra, api_key: this.apiKey };
  }

  /** Fetch the full movie-genre dictionary. */
  public async getMovieGenres(): Promise<Result<TmdbGenre[]>> {
    const result = await this.http.request(
      { path: '/genre/movie/list', query: this.query(), init: ACCEPT_JSON },
      tmdbGenresResponseSchema,
    );
    return result.ok ? { ...result, value: result.value.genres ?? [] } : result;
  }

  /** Look up a movie by IMDb id (returns the first movie match, if any). */
  public findByImdb(imdbId: string): Promise<Result<TmdbFindResponse>> {
    return this.http.request(
      {
        path: `/find/${encodeURIComponent(imdbId)}`,
        query: this.query({ external_source: 'imdb_id' }),
        init: ACCEPT_JSON,
      },
      tmdbFindResponseSchema,
    );
  }

  /** Fetch a movie with its credits appended in one round-trip. */
  public getMovieWithCredits(
    tmdbId: number,
  ): Promise<Result<TmdbMovieResponse>> {
    return this.http.request(
      {
        path: `/movie/${tmdbId}`,
        query: this.query({ append_to_response: 'credits' }),
        init: ACCEPT_JSON,
      },
      tmdbMovieResponseSchema,
    );
  }

  /** Fetch a person with their full filmography. */
  public getPersonWithCredits(
    personId: number,
  ): Promise<Result<TmdbPersonResponse>> {
    return this.http.request(
      {
        path: `/person/${personId}`,
        query: this.query({ append_to_response: 'movie_credits' }),
        init: ACCEPT_JSON,
      },
      tmdbPersonResponseSchema,
    );
  }
}
