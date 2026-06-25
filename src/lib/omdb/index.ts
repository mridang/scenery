/**
 * @packageDocumentation
 *
 * OMDB enrichment: IMDb rating, IMDb vote count, Metacritic score,
 * Rotten Tomatoes score, all keyed by imdb_id via the OMDB API.
 */

export { OmdbClient } from './client';
export type { OmdbClientOptions } from './client';
export { OmdbRepository } from './repository';
export { OmdbEnricher } from './enricher';
export type { OmdbSweepResult } from './enricher';
export type { OmdbEnrichResult, OmdbRatings } from './types';
