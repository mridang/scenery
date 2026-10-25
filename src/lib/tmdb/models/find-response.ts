import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** The movie-level fields we capture from TMDB's `/find` endpoint. @public */
export const TmdbFindMovieSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  original_title: z.string().optional(),
  release_date: z.string().optional(),
  overview: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  genre_ids: z.array(z.number()).optional(),
  popularity: z.number().optional(),
  vote_average: z.number().optional(),
  vote_count: z.number().optional(),
});
export type TmdbFindMovie = z.infer<typeof TmdbFindMovieSchema> & ApiModel;

/** Response shape of `/find/{imdb_id}?external_source=imdb_id`. @public */
export const TmdbFindResponseSchema = z.object({
  movie_results: z.array(TmdbFindMovieSchema).optional(),
});
export type TmdbFindResponse = z.infer<typeof TmdbFindResponseSchema> &
  ApiModel;
