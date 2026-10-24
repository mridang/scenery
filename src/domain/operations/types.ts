/**
 * @packageDocumentation
 *
 * What an operator can ask for through `POST /api/operations`, as checked
 * parameters: one shape per `type`, so the code that runs an operation never
 * has to re-check what it was given.
 */

import type { SourceSlug } from '@/lib/sources/types';
import type { TorrentProviderName } from '@/lib/torrents/types';

/** The steps of a pipeline run, in the order they happen. */
export const PIPELINE_STEPS = ['scrape', 'enrich', 'torrents'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

/** Most pages a pipeline run may backfill: each one costs outbound fetches. */
export const MAX_BACKFILL_PAGES = 100;

/** Smallest and largest OMDB sweep, and the size of one that does not say. */
export const MIN_OMDB_LIMIT = 1;
export const MAX_OMDB_LIMIT = 200;
export const DEFAULT_OMDB_LIMIT = 25;

/** Parameters of a `pipeline_run`. */
export interface PipelineRunParameters {
  /** Run just this source; otherwise every registered source. */
  readonly source?: SourceSlug;
  /** How many listing pages to scrape per source (1 when 0). */
  readonly backfill_pages: number;
  /** Which steps to run. */
  readonly steps: readonly PipelineStep[];
  /** Which torrent providers to ask; the defaults when absent. */
  readonly torrent_providers?: readonly TorrentProviderName[];
}

/** An operation to run, with its checked parameters. */
export type OperationRequest =
  | {
      readonly type: 'pipeline_run';
      readonly parameters: PipelineRunParameters;
    }
  | {
      readonly type: 'omdb_backfill';
      readonly parameters: { readonly limit: number };
    }
  | {
      readonly type: 'push_trigger';
      readonly parameters: Readonly<Record<string, never>>;
    };
