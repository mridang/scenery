/**
 * @packageDocumentation
 *
 * The TMDB request/response models: one Zod schema + its type per file, each
 * extending ApiModel. The schemas carry any per-field quirks so the client
 * stays a thin map of endpoint to typed result.
 */

export { TmdbGenreSchema, TmdbGenresResponseSchema } from './genres-response';
export type { TmdbGenre, TmdbGenresResponse } from './genres-response';
export { TmdbFindMovieSchema, TmdbFindResponseSchema } from './find-response';
export type { TmdbFindMovie, TmdbFindResponse } from './find-response';
export {
  TmdbCastEntrySchema,
  TmdbCrewEntrySchema,
  TmdbCompanySchema,
  TmdbMovieResponseSchema,
} from './movie-response';
export type {
  TmdbCastEntry,
  TmdbCrewEntry,
  TmdbCompany,
  TmdbMovieResponse,
} from './movie-response';
export { TmdbPersonResponseSchema } from './person-response';
export type { TmdbPersonResponse } from './person-response';
