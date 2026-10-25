/**
 * @packageDocumentation
 *
 * TMDB client library: the {@link TmdbClient} and its request/response models.
 * The enrichment orchestration and repository live in `@/domain/tmdb`.
 */

export { TmdbClient } from './client';
export type { TmdbClientOptions, TmdbResult } from './client';
export * from './models';
