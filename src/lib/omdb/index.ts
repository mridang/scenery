/**
 * @packageDocumentation
 *
 * OMDB client library: IMDb rating, IMDb vote count, Metacritic score and
 * Rotten Tomatoes score, keyed by imdb_id via the OMDB API. The enrichment
 * orchestration and its repository live in `@/domain/omdb`.
 */

export { OmdbClient } from './client';
export type { OmdbClientOptions } from './client';
export type { OmdbEnrichResult, OmdbRatings } from './types';
