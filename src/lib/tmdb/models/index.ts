/**
 * @packageDocumentation
 *
 * The TMDB request/response models: one Zod schema per API shape, with its
 * inferred type. The schemas carry any per-field quirks so the client stays a
 * thin map of endpoint to typed result.
 */

export * from './genre';
export * from './find';
export * from './movie';
export * from './person';
