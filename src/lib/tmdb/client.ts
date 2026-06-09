import { safeJsonParse } from '@/lib/util';
import type {
  TmdbFindResponse,
  TmdbGenre,
  TmdbMovieResponse,
  TmdbPersonResponse,
} from './types';

/**
 * Options for {@link TmdbClient}.
 *
 * @public
 */
export interface TmdbClientOptions {
  /** TMDB v3 API key. Required. */
  readonly apiKey: string;
  /** Override the API root. Defaults to `https://api.themoviedb.org/3`. */
  readonly baseUrl?: string;
}

/**
 * Either the parsed response, or a typed failure record. The enricher
 * uses the failure path to persist HTTP errors without retrying.
 *
 * @public
 */
export type TmdbResult<T> =
  | { ok: true; value: T; raw: string; httpStatus: number }
  | { ok: false; error: string; raw: string; httpStatus?: number };

/**
 * Thin wrapper around TMDB's REST API. Knows nothing about D1 or
 * enrichment policy — that lives in {@link TmdbEnricher}.
 *
 * @public
 */
export class TmdbClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /** @throws When no API key is provided. */
  public constructor(
    private readonly transport: typeof fetch,
    opts: TmdbClientOptions,
  ) {
    if (!opts.apiKey) {
      throw new Error('TmdbClient requires apiKey');
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.themoviedb.org/3';
  }

  /** Fetch the full movie-genre dictionary. */
  public async getMovieGenres(): Promise<TmdbResult<TmdbGenre[]>> {
    return this.callJson<{ genres: TmdbGenre[] }>(
      `${this.baseUrl}/genre/movie/list`,
      {},
    ).then((result) =>
      result.ok ? { ...result, value: result.value.genres ?? [] } : result,
    );
  }

  /** Look up a movie by IMDb id (returns the first movie match, if any). */
  public findByImdb(imdbId: string): Promise<TmdbResult<TmdbFindResponse>> {
    return this.callJson<TmdbFindResponse>(
      `${this.baseUrl}/find/${encodeURIComponent(imdbId)}`,
      { external_source: 'imdb_id' },
    );
  }

  /** Fetch a movie with its credits appended in one round-trip. */
  public getMovieWithCredits(
    tmdbId: number,
  ): Promise<TmdbResult<TmdbMovieResponse>> {
    return this.callJson<TmdbMovieResponse>(`${this.baseUrl}/movie/${tmdbId}`, {
      append_to_response: 'credits',
    });
  }

  /** Fetch a person with their full filmography. */
  public getPersonWithCredits(
    personId: number,
  ): Promise<TmdbResult<TmdbPersonResponse>> {
    return this.callJson<TmdbPersonResponse>(
      `${this.baseUrl}/person/${personId}`,
      { append_to_response: 'movie_credits' },
    );
  }

  private async callJson<T>(
    url: string,
    query: Record<string, string>,
  ): Promise<TmdbResult<T>> {
    const parsedUrl = new URL(url);
    parsedUrl.search = new URLSearchParams({
      ...query,
      api_key: this.apiKey,
    }).toString();
    try {
      const resp = await this.transport(parsedUrl, {
        headers: { Accept: 'application/json' },
      });
      const raw = await resp.text();
      if (!resp.ok) {
        return {
          ok: false,
          error: `http ${resp.status}`,
          raw,
          httpStatus: resp.status,
        };
      }
      const parsed = safeJsonParse<T>(raw);
      return parsed.ok
        ? { ok: true, value: parsed.value, raw, httpStatus: resp.status }
        : { ok: false, error: parsed.error, raw, httpStatus: resp.status };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        raw: '',
      };
    }
  }
}
