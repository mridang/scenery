/**
 * @packageDocumentation
 *
 * Thin OMDb API client built on {@link JsonClient}: one call per imdb_id,
 * returning a {@link Result} of the coerced response (or a typed failure). The
 * found/not-found/error policy lives in the domain enricher.
 */

import { JsonClient, type Result } from '@/lib/http';

import { omdbResponseSchema, type OmdbResponse } from './models';

/** Construction options for {@link OmdbClient}. @public */
export interface OmdbClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
}

/** Client for the OMDb API. @public */
export class OmdbClient {
  private readonly http: JsonClient;
  private readonly apiKey: string;

  public constructor(
    options: OmdbClientOptions,
    fetcher: typeof fetch = globalThis.fetch,
  ) {
    if (!options.apiKey) {
      throw new Error('OmdbClient requires an apiKey');
    }
    this.apiKey = options.apiKey;
    this.http = new JsonClient(
      options.baseUrl ?? 'https://www.omdbapi.com/',
      fetcher,
    );
  }

  /** Fetch ratings for one IMDb id. */
  public fetchByImdb(imdbId: string): Promise<Result<OmdbResponse>> {
    return this.http.request(
      { path: '', query: { i: imdbId, apikey: this.apiKey } },
      omdbResponseSchema,
    );
  }
}
