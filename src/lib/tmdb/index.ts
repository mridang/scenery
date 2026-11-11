/**
 * @packageDocumentation
 *
 * TMDB client library: the {@link TmdbClient} and its request/response models.
 * The enrichment orchestration and repository live in `@/domain/tmdb`.
 */

export { TmdbClient } from './client';
export type { TmdbClientOptions, TmdbResult } from './client';
export {
  TmdbGenreSchema,
  TmdbGenresResponseSchema,
  TmdbFindMovieSchema,
  TmdbFindResponseSchema,
  TmdbCastEntrySchema,
  TmdbCrewEntrySchema,
  TmdbCompanySchema,
  TmdbMovieResponseSchema,
  TmdbPersonResponseSchema,
} from './models';
export type {
  TmdbGenre,
  TmdbGenresResponse,
  TmdbFindMovie,
  TmdbFindResponse,
  TmdbCastEntry,
  TmdbCrewEntry,
  TmdbCompany,
  TmdbMovieResponse,
  TmdbPersonResponse,
} from './models';
