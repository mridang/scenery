import { buildEnricher } from './tmdb/index';
import type { EnrichSummary } from './tmdb/types';

export type { EnrichSummary } from './tmdb/types';

/**
 * Back-compat helper that constructs a default {@link TmdbEnricher} and
 * runs one pass. New code should use {@link buildEnricher} directly.
 *
 * @deprecated Use the class-based API in `@/lib/tmdb`.
 * @public
 */
export async function enrichMovies(
  db: D1Database,
  env: CloudflareEnv,
  limit = 200,
): Promise<EnrichSummary> {
  return buildEnricher(db, env).run(limit);
}

/**
 * Back-compat helper that refreshes the genres dictionary.
 *
 * @deprecated Use `buildEnricher(db, env).refreshGenres()`.
 * @public
 */
export async function refreshGenres(
  db: D1Database,
  env: CloudflareEnv,
): Promise<number> {
  return buildEnricher(db, env).refreshGenres();
}
