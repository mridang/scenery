/**
 * @packageDocumentation
 *
 * The OMDb enrichment outcome the repository persists: the status the enricher
 * derived from the client's {@link Result}, the ratings (when found), the raw
 * body and any error.
 */

import type { OmdbRatings } from '@/lib/omdb';

/** One enrichment outcome — `found`, `not_found`, or `error`. @public */
export interface OmdbEnrichResult {
  readonly status: 'found' | 'not_found' | 'error';
  readonly ratings: OmdbRatings | null;
  readonly raw: string;
  readonly error: string | null;
}
