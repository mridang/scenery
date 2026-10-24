/**
 * @packageDocumentation
 *
 * The closed value-sets ("enums") for the storage columns the app owns. They
 * live in the domain's db layer because they are *storage* value domains — the
 * schema applies them to columns via `text(col, { enum })`, and the derived
 * types flow end to end (a stored status can only ever be one of these
 * strings).
 *
 * Value-sets that belong to a library's own surface (a torrent's detected
 * quality, lookup status and provider name; a source's slug) are NOT here —
 * they live with that library (`@/lib/torrents/types`, `@/lib/sources/types`)
 * and the schema imports them from there.
 */

/** Outcome of a single page fetch attempt. */
export const FETCH_STATUSES = ['success', 'failed'] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];

/** TMDB enrichment outcome for a movie. ("pending" = no row, not a value.) */
export const TMDB_STATUSES = ['found', 'not_found', 'error'] as const;
export type TmdbStatus = (typeof TMDB_STATUSES)[number];

/** What an operator can ask `POST /api/operations` to run. */
export const OPERATION_TYPES = [
  'pipeline_run',
  'omdb_backfill',
  'push_trigger',
] as const;
export type OperationType = (typeof OPERATION_TYPES)[number];

/** Where an operation is: running, or how it ended. */
export const OPERATION_STATUSES = ['running', 'succeeded', 'failed'] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];
