/**
 * @packageDocumentation
 *
 * The TMDB request/response models: one Zod schema + its type per file, each
 * extending ApiModel. The schemas carry any per-field quirks so the client
 * stays a thin map of endpoint to typed result.
 */

export * from './genres-response';
export * from './find-response';
export * from './movie-response';
export * from './person-response';
