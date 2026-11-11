/**
 * @packageDocumentation
 *
 * OMDb client library: the {@link OmdbClient} and its response model. The
 * enrichment orchestration and repository live in `@/domain/omdb`.
 */

export { OmdbClient } from './client';
export type { OmdbClientOptions } from './client';
export { OmdbResponseSchema } from './models';
export type { OmdbRatings, OmdbResponse } from './models';
