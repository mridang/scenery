/**
 * @packageDocumentation
 *
 * What this app checks about itself for `GET /api/health`, beyond whether the
 * Worker is up and the database is bound (`src/app/api/health/route.ts`, which
 * is the same in every app). The catalog is only as good as its last scrape, so
 * the check fails when nothing has been scraped in the last 48 hours.
 */

import { CatalogService } from './catalog';
import { getDB, isDatabaseBound } from './util';

/** The outcome of the app's own check. */
export interface AppHealth {
  /** Whether the app is healthy; false turns the answer into a 503. */
  readonly ok: boolean;
  /** Extra fields for the body of the answer. */
  readonly details: Readonly<Record<string, unknown>>;
}

/** How old the last scrape may be before the catalog counts as stale. */
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/**
 * The app's own check: unhealthy when the database is not bound or the catalog
 * has no scrape in the last 48 hours; the body says how much the catalog holds
 * and when and where it was last fed.
 */
export async function appHealth(): Promise<AppHealth> {
  if (!isDatabaseBound()) {
    return { ok: false, details: {} };
  }
  const catalog = CatalogService.fromD1(getDB());
  const [stats, last] = await Promise.all([
    catalog.stats(),
    catalog.lastUpdate(),
  ]);
  const scrapeAgeMs =
    last.scrapeAt !== null ? Date.now() - Date.parse(last.scrapeAt) : null;
  const stale = scrapeAgeMs === null || scrapeAgeMs > STALE_THRESHOLD_MS;
  return {
    ok: !stale,
    details: {
      movies: stats.movies,
      releases: stats.releases,
      tmdb_found: stats.tmdb_found,
      failed_attempts: stats.failed_attempts,
      last_scrape_at: last.scrapeAt,
      last_scrape_source: last.scrapeSource,
      last_scrape_age_ms: scrapeAgeMs,
      last_enrich_at: last.enrichAt,
      last_torrent_at: last.torrentsAt,
      last_torrent_provider: last.torrentsProvider,
      stale_threshold_ms: STALE_THRESHOLD_MS,
    },
  };
}
