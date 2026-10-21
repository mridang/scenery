import { OmdbEnricher } from '../../../lib/omdb';
import { readJsonObject } from '../../../lib/api/json';
import { problems } from '../../../lib/api/problem';
import { withRetry } from '../../../lib/transport';
import { getDB, getEnv } from '../../../lib/util';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

/**
 * `POST /api/omdb-backfills`: run one OMDB backfill sweep. Walks `tmdb_movies`
 * rows whose `omdb_status` is NULL or `error` and fills them in by calling
 * OMDB, then answers 200 with the sweep summary so a caller can drive it
 * iteratively (each call processes up to `limit` movies, then comes back).
 *
 * The optional JSON body is `{ limit }`, a whole number from 1 to 200 (default
 * 25, which stays well under the 50-subrequest cap: the worst case is a
 * sequential ~30 s of OMDB calls before the Worker has to yield). Answers 400
 * for a limit outside that range.
 *
 * Unauthenticated: this is a single-user personal tracker and the worst case is
 * a few extra OMDB calls on the operator's own key.
 */
export async function POST(request: Request): Promise<Response> {
  const body = request.headers.has('content-type')
    ? await readJsonObject(request, 'The body must be a JSON object.')
    : ({ ok: true, value: {} } as const);
  if (!body.ok) {
    return body.response;
  }
  const { limit = DEFAULT_LIMIT } = body.value;
  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    return problems.badRequest(
      `limit must be a whole number from 1 to ${MAX_LIMIT}.`,
    );
  }

  const env = getEnv();
  const enricher = new OmdbEnricher(getDB(), {
    apiKey: env.OMDB_API_KEY,
    transport: withRetry(globalThis.fetch),
  });
  const result = await enricher.sweepPending(limit);
  return Response.json({ limit, ...result });
}
