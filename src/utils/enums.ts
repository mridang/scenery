/**
 * @packageDocumentation
 *
 * The closed value-sets ("enums") for the constrained text columns. They
 * live in the db layer because they are the *storage* value domains —
 * the schema applies them to columns via `text(col, { enum })`, and the
 * domain libs import the derived types so the constraint flows end to
 * end (a stored status can only ever be one of these strings).
 *
 * Each constant is `as const` so the derived `(typeof X)[number]` union
 * is exact. Open-ended identifiers (a torrent's tracker `source`, a
 * movie's `imdb_id`) are deliberately NOT here — only genuinely closed
 * sets belong.
 */

/** Registered scrape sources (one provider class per slug). */
export const SOURCE_SLUGS = ['scnsrc', 'ddlvalley'] as const;
export type SourceSlug = (typeof SOURCE_SLUGS)[number];

/** Outcome of a single page fetch attempt. */
export const FETCH_STATUSES = ['success', 'failed'] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];

/** TMDB enrichment outcome for a movie. ("pending" = no row, not a value.) */
export const TMDB_STATUSES = ['found', 'not_found', 'error'] as const;
export type TmdbStatus = (typeof TMDB_STATUSES)[number];

/** Outcome of a torrent lookup for a movie. */
export const LOOKUP_STATUSES = ['success', 'empty', 'error'] as const;
export type LookupStatus = (typeof LOOKUP_STATUSES)[number];

/** Torrent provider that answered a lookup. */
export const TORRENT_PROVIDERS = ['apibay', 'torrentio'] as const;
export type TorrentProviderName = (typeof TORRENT_PROVIDERS)[number];

/** Detected video quality of a torrent (null when unknown). */
export const QUALITIES = ['2160p', '1080p', '720p', '480p'] as const;
export type Quality = (typeof QUALITIES)[number];

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
