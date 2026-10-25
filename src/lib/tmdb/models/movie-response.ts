import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** Cast entry from `/movie/{id}?append_to_response=credits`. @public */
export const TmdbCastEntrySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  character: z.string().optional(),
});
export type TmdbCastEntry = z.infer<typeof TmdbCastEntrySchema> & ApiModel;

/** Crew entry from `/movie/{id}?append_to_response=credits`. @public */
export const TmdbCrewEntrySchema = z.object({
  id: z.number().optional(),
  job: z.string().optional(),
  name: z.string().optional(),
});
export type TmdbCrewEntry = z.infer<typeof TmdbCrewEntrySchema> & ApiModel;

/** Production company entry on movie responses. @public */
export const TmdbCompanySchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
});
export type TmdbCompany = z.infer<typeof TmdbCompanySchema> & ApiModel;

/** Subset of `/movie/{id}?append_to_response=credits` we persist. @public */
export const TmdbMovieResponseSchema = z.object({
  runtime: z.number().nullable().optional(),
  budget: z.number().nullable().optional(),
  revenue: z.number().nullable().optional(),
  original_language: z.string().nullable().optional(),
  production_companies: z.array(TmdbCompanySchema).optional(),
  credits: z
    .object({
      cast: z.array(TmdbCastEntrySchema).optional(),
      crew: z.array(TmdbCrewEntrySchema).optional(),
    })
    .optional(),
});
export type TmdbMovieResponse = z.infer<typeof TmdbMovieResponseSchema> &
  ApiModel;
