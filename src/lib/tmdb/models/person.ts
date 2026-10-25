import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** Subset of `/person/{id}?append_to_response=movie_credits`. @public */
export const tmdbPersonResponseSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  popularity: z.number().optional(),
  known_for_department: z.string().optional(),
  movie_credits: z
    .object({
      cast: z
        .array(
          z.object({
            id: z.number().optional(),
            vote_count: z.number().optional(),
          }),
        )
        .optional(),
      crew: z
        .array(
          z.object({
            id: z.number().optional(),
            job: z.string().optional(),
            vote_count: z.number().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export type TmdbPersonResponse = z.infer<typeof tmdbPersonResponseSchema> &
  ApiModel;
