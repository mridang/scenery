import { TmdbClient } from './client';
import { TmdbEnricher } from './enricher';
import { TmdbRepository } from './repository';

export type { TmdbClientOptions, TmdbResult } from './client';
export { TmdbClient } from './client';
export { TmdbEnricher } from './enricher';
export { TmdbRepository } from './repository';
export type * from './types';

/**
 * Convenience constructor that wires {@link TmdbClient},
 * {@link TmdbRepository}, and {@link TmdbEnricher} from a D1 binding, an
 * environment, and an injected transport. The composition root chooses
 * the transport (see `@/lib/transport`) so this lib stays HTTP-agnostic.
 *
 * @public
 */
export function buildEnricher(
  db: D1Database,
  env: CloudflareEnv,
  transport: typeof fetch,
): TmdbEnricher {
  return new TmdbEnricher(
    new TmdbClient(transport, { apiKey: env.TMDB_API_KEY }),
    new TmdbRepository(db),
  );
}
