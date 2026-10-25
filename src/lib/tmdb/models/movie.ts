import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** Cast entry from `/movie/{id}?append_to_response=credits`. @public */
export const tmdbCastEntrySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  character: z.string().optional(),
});
export type TmdbCastEntry = z.infer<typeof tmdbCastEntrySchema> & ApiModel;

/** Crew entry from `/movie/{id}?append_to_response=credits`. @public */
export const tmdbCrewEntrySchema = z.object({
  id: z.number().optional(),
  job: z.string().optional(),
  name: z.string().optional(),
});
export type TmdbCrewEntry = z.infer<typeof tmdbCrewEntrySchema> & ApiModel;

/** Production company entry on movie responses. @public */
export const tmdbCompanySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
});
export type TmdbCompany = z.infer<typeof tmdbCompanySchema> & ApiModel;

/** Subset of `/movie/{id}?append_to_response=credits` we persist. @public */
export const tmdbMovieResponseSchema = z.object({
  runtime: z.number().nullable().optional(),
  budget: z.number().nullable().optional(),
  revenue: z.number().nullable().optional(),
  original_language: z.string().nullable().optional(),
  production_companies: z.array(tmdbCompanySchema).optional(),
  credits: z
    .object({
      cast: z.array(tmdbCastEntrySchema).optional(),
      crew: z.array(tmdbCrewEntrySchema).optional(),
    })
    .optional(),
});
export type TmdbMovieResponse = z.infer<typeof tmdbMovieResponseSchema> &
  ApiModel;
