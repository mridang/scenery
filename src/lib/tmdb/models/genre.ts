import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** TMDB genre row (`/genre/movie/list`). @public */
export const tmdbGenreSchema = z.object({ id: z.number(), name: z.string() });
export type TmdbGenre = z.infer<typeof tmdbGenreSchema> & ApiModel;

/** Response shape of `/genre/movie/list`. @public */
export const tmdbGenresResponseSchema = z.object({
  genres: z.array(tmdbGenreSchema).optional(),
});
export type TmdbGenresResponse = z.infer<typeof tmdbGenresResponseSchema> &
  ApiModel;
