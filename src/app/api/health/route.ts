import { CatalogRepository } from '@/lib/catalog';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/**
 * Minimal health endpoint for uptime monitors and the staleness check.
 * Returns 200 + JSON when the catalog has at least one snapshot in the
 * last 48 h; returns 503 + JSON otherwise.
 */
export async function GET() {
  const db = getDB();
  const repo = new CatalogRepository(db);
  const [stats, last] = await Promise.all([
    repo.loadStats(),
    repo.loadLastUpdate(),
  ]);
  const nowMs = Date.now();
  const scrapeAgeMs =
    last.scrapeAt !== null ? nowMs - Date.parse(last.scrapeAt) : null;
  const stale = scrapeAgeMs === null || scrapeAgeMs > STALE_THRESHOLD_MS;
  const body = {
    ok: !stale,
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
  };
  return Response.json(body, {
    status: stale ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
