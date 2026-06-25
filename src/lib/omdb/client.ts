/**
 * @packageDocumentation
 *
 * Thin OMDB API client. One call per imdb_id, returns the typed
 * {@link OmdbEnrichResult} plus the raw JSON body for forensics.
 */

import type { OmdbEnrichResult, OmdbRatings } from './types';

/** Construction options for {@link OmdbClient}. @public */
export interface OmdbClientOptions {
  readonly apiKey: string;
  readonly transport?: typeof fetch;
  readonly baseUrl?: string;
}

interface OmdbRawResponse {
  readonly Response?: string;
  readonly Error?: string;
  readonly imdbRating?: string;
  readonly imdbVotes?: string;
  readonly Metascore?: string;
  readonly Ratings?: ReadonlyArray<{
    readonly Source: string;
    readonly Value: string;
  }>;
}

/**
 * Fetch ratings for one IMDb id. Network errors are returned as
 * `status: 'error'`; a successful response with `Response: 'False'` is
 * translated to `status: 'not_found'` (most often a brand-new film that
 * OMDB hasn't ingested yet); everything else is `status: 'found'` with
 * the parsed ratings.
 *
 * @public
 */
export class OmdbClient {
  private readonly apiKey: string;
  private readonly transport: typeof fetch;
  private readonly baseUrl: string;

  public constructor(opts: OmdbClientOptions) {
    if (!opts.apiKey) {
      throw new Error('OmdbClient requires an apiKey');
    }
    this.apiKey = opts.apiKey;
    this.transport = opts.transport ?? globalThis.fetch;
    this.baseUrl = opts.baseUrl ?? 'https://www.omdbapi.com/';
  }

  public async fetchByImdb(imdbId: string): Promise<OmdbEnrichResult> {
    const url = `${this.baseUrl}?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(
      this.apiKey,
    )}`;
    let response: Response;
    try {
      response = await this.transport(url);
    } catch (err) {
      return {
        status: 'error',
        ratings: null,
        raw: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
    const raw = await response.text();
    if (!response.ok) {
      return {
        status: 'error',
        ratings: null,
        raw,
        error: `http ${response.status}`,
      };
    }
    const body = parseSafely(raw);
    if (body === null) {
      return { status: 'error', ratings: null, raw, error: 'invalid json' };
    }
    if (body.Response === 'False') {
      return {
        status: 'not_found',
        ratings: null,
        raw,
        error: body.Error ?? null,
      };
    }
    return { status: 'found', ratings: parseRatings(body), raw, error: null };
  }
}

function parseSafely(raw: string): OmdbRawResponse | null {
  try {
    return JSON.parse(raw) as OmdbRawResponse;
  } catch {
    return null;
  }
}

function parseRatings(body: OmdbRawResponse): OmdbRatings {
  const rtEntry = body.Ratings?.find(
    (entry) => entry.Source === 'Rotten Tomatoes',
  );
  return {
    imdb_rating: parseFloatOrNull(body.imdbRating),
    imdb_votes: parseIntOrNull(body.imdbVotes),
    metacritic_score: parseIntOrNull(body.Metascore),
    rt_score: parsePercentageOrNull(rtEntry?.Value),
  };
}

function parseFloatOrNull(input: string | undefined): number | null {
  if (input === undefined || input === 'N/A') {
    return null;
  }
  const value = Number.parseFloat(input);
  return Number.isFinite(value) ? value : null;
}

function parseIntOrNull(input: string | undefined): number | null {
  if (input === undefined || input === 'N/A') {
    return null;
  }
  const value = Number.parseInt(input.replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

function parsePercentageOrNull(input: string | undefined): number | null {
  if (input === undefined || input === 'N/A') {
    return null;
  }
  // OMDB returns e.g. "85%" for RT. Strip the suffix and parse.
  return parseIntOrNull(input);
}
