import { isRetryableStatus, retry } from "../util/retry";
import type {
  TmdbFindResponse,
  TmdbGenre,
  TmdbMovieResponse,
  TmdbPersonResponse,
} from "./types";

/**
 * Options for {@link TmdbClient}.
 *
 * @public
 */
export interface TmdbClientOptions {
  /** TMDB v3 API key. Required. */
  apiKey: string;
  /** Override the API root. Defaults to `https://api.themoviedb.org/3`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Defaults to 10 000. */
  timeoutMs?: number;
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
  private readonly timeoutMs: number;

  /** @throws When no API key is provided. */
  public constructor(opts: TmdbClientOptions) {
    if (!opts.apiKey) throw new Error("TmdbClient requires apiKey");
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? "https://api.themoviedb.org/3";
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  /** Fetch the full movie-genre dictionary. */
  public async getMovieGenres(): Promise<TmdbResult<TmdbGenre[]>> {
    return this.callJson<{ genres: TmdbGenre[] }>(
      `${this.baseUrl}/genre/movie/list`,
      {},
    ).then((r) => (r.ok ? { ...r, value: r.value.genres ?? [] } : r));
  }

  /** Look up a movie by IMDb id (returns the first movie match, if any). */
  public findByImdb(imdbId: string): Promise<TmdbResult<TmdbFindResponse>> {
    return this.callJson<TmdbFindResponse>(
      `${this.baseUrl}/find/${encodeURIComponent(imdbId)}`,
      { external_source: "imdb_id" },
    );
  }

  /** Fetch a movie with its credits appended in one round-trip. */
  public getMovieWithCredits(
    tmdbId: number,
  ): Promise<TmdbResult<TmdbMovieResponse>> {
    return this.callJson<TmdbMovieResponse>(`${this.baseUrl}/movie/${tmdbId}`, {
      append_to_response: "credits",
    });
  }

  /** Fetch a person with their full filmography. */
  public getPersonWithCredits(
    personId: number,
  ): Promise<TmdbResult<TmdbPersonResponse>> {
    return this.callJson<TmdbPersonResponse>(
      `${this.baseUrl}/person/${personId}`,
      { append_to_response: "movie_credits" },
    );
  }

  private async callJson<T>(
    url: string,
    query: Record<string, string>,
  ): Promise<TmdbResult<T>> {
    const u = new URL(url);
    u.searchParams.set("api_key", this.apiKey);
    for (const [k, v] of Object.entries(query)) {
      u.searchParams.set(k, v);
    }
    // 3 attempts with jittered backoff on 408/429/5xx and transport
    // errors. Parse failures and 4xx-other are permanent.
    const result = await retry<TmdbResult<T>>(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const resp = await globalThis.fetch(u, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const raw = await resp.text();
        if (!resp.ok) {
          const value: TmdbResult<T> = {
            ok: false,
            error: `http ${resp.status}`,
            raw,
            httpStatus: resp.status,
          };
          return isRetryableStatus(resp.status)
            ? { ok: false, error: value.error, retry: true }
            : { ok: true, value };
        }
        try {
          const value: TmdbResult<T> = {
            ok: true,
            value: JSON.parse(raw) as T,
            raw,
            httpStatus: resp.status,
          };
          return { ok: true, value };
        } catch (err) {
          return {
            ok: true,
            value: {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
              raw,
              httpStatus: resp.status,
            },
          };
        }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          retry: true,
        };
      } finally {
        clearTimeout(timer);
      }
    });
    if (!result.ok) {
      return { ok: false, error: result.error, raw: "" };
    }
    return result.value;
  }
}
