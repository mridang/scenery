/**
 * @packageDocumentation
 *
 * The OMDB API response shape we care about. We only model the four
 * scores plus the raw payload — everything else (title, runtime, plot,
 * etc.) is already provided by TMDB.
 */

/** Parsed OMDB result for a single movie. @public */
export interface OmdbRatings {
  readonly imdb_rating: number | null;
  readonly imdb_votes: number | null;
  readonly metacritic_score: number | null;
  readonly rt_score: number | null;
}

/** One enrichment outcome — `found`, `not_found`, or `error`. @public */
export interface OmdbEnrichResult {
  readonly status: 'found' | 'not_found' | 'error';
  readonly ratings: OmdbRatings | null;
  readonly raw: string;
  readonly error: string | null;
}
