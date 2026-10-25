import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** TMDB genre row (`/genre/movie/list`). @public */
export const TmdbGenreSchema = z.object({ id: z.number(), name: z.string() });
export type TmdbGenre = z.infer<typeof TmdbGenreSchema> & ApiModel;

/** Response shape of `/genre/movie/list`. @public */
export const TmdbGenresResponseSchema = z.object({
  genres: z.array(TmdbGenreSchema).optional(),
});
export type TmdbGenresResponse = z.infer<typeof TmdbGenresResponseSchema> &
  ApiModel;
