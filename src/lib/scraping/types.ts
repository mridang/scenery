import type { FetchStatus } from '@/lib/db';

/**
 * Result of attempting to scrape a single listing page.
 *
 * @public
 */
export interface PageRunResult {
  /** One-based page index that was attempted. */
  pageNumber: number;
  /** Monotonic attempt counter per (source, page). First attempt = 1. */
  attemptNumber: number;
  /** Overall outcome. */
  status: FetchStatus;
  /** Upstream HTTP status code when available. */
  httpStatus?: number;
  /** Human-readable error message on failure. */
  error?: string;
  /** Number of releases upserted on success. */
  releasesUpserted?: number;
  /** PK of the page_snapshots row written on success. */
  snapshotId?: number;
}
