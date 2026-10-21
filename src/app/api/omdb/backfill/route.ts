import { OmdbEnricher } from '../../../../lib/omdb';
import { withRetry } from '../../../../lib/transport';
import { getDB, getEnv } from '../../../../lib/util';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

/**
 * One-shot OMDB backfill. Walks `tmdb_movies` rows whose `omdb_status`
 * is NULL or `error` and fills them in by calling OMDB. Returns the
 * sweep summary so a caller can drive it iteratively (each call
 * processes up to `limit` movies, then comes back).
 *
 * Limit defaults to 25 to stay well under the 50-subrequest cap; the
 * worst case is a sequential ~30 s of OMDB calls before the Worker
 * has to yield. Pass `?limit=N` to override (capped at 200).
 *
 * Unauthenticated; same rationale as `/api/push/trigger`.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const requested = Number.parseInt(
    url.searchParams.get('limit') ?? String(DEFAULT_LIMIT),
    10,
  );
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(MAX_LIMIT, requested))
    : DEFAULT_LIMIT;

  const env = getEnv();
  const enricher = new OmdbEnricher(getDB(), {
    apiKey: env.OMDB_API_KEY,
    transport: withRetry(globalThis.fetch),
  });
  const result = await enricher.sweepPending(limit);
  return Response.json({ ok: true, limit, ...result });
}
