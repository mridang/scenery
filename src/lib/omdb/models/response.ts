import { z } from 'zod';

import type { ApiModel } from '@/lib/http';

/** The four coerced scores we keep from OMDb. @public */
export interface OmdbRatings {
  readonly imdb_rating: number | null;
  readonly imdb_votes: number | null;
  readonly metacritic_score: number | null;
  readonly rt_score: number | null;
}

/** OMDb gives scores as strings ("8.5") or "N/A"; a float, else null. */
function floatOrNull(input: string | undefined): number | null {
  if (input === undefined || input === 'N/A') {
    return null;
  }
  const value = Number.parseFloat(input);
  return Number.isFinite(value) ? value : null;
}

/** As {@link floatOrNull}, but an integer with any non-digits stripped ("1,234", "85%"). */
function intOrNull(input: string | undefined): number | null {
  if (input === undefined || input === 'N/A') {
    return null;
  }
  const value = Number.parseInt(input.replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

/** OMDb's raw `?i=` body, before coercion. */
const rawOmdbSchema = z.object({
  Response: z.string().optional(),
  Error: z.string().optional(),
  imdbRating: z.string().optional(),
  imdbVotes: z.string().optional(),
  Metascore: z.string().optional(),
  Ratings: z
    .array(z.object({ Source: z.string(), Value: z.string() }))
    .optional(),
});

/**
 * OMDb's `?i=` response, coerced: the `Response` flag, any error, and the four
 * scores as numbers (the stringly-typed "8.5"/"1,234"/"85%"/"N/A" quirks are
 * handled here, in the model, not in the client). @public
 */
export const omdbResponseSchema = rawOmdbSchema.transform((body) => ({
  response: body.Response,
  error: body.Error ?? null,
  ratings: {
    imdb_rating: floatOrNull(body.imdbRating),
    imdb_votes: intOrNull(body.imdbVotes),
    metacritic_score: intOrNull(body.Metascore),
    rt_score: intOrNull(
      body.Ratings?.find((entry) => entry.Source === 'Rotten Tomatoes')?.Value,
    ),
  } satisfies OmdbRatings,
}));
export type OmdbResponse = z.infer<typeof omdbResponseSchema> & ApiModel;
