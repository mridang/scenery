/**
 * @packageDocumentation
 *
 * TMDB enrichment domain: the enricher, its repository, and the composition
 * helper that wires them to the TMDB client (`@/lib/tmdb`) and a transport.
 */

import type { Database } from '@/domain/db/client';
import { TmdbClient } from '@/lib/tmdb';
import { TmdbEnricher } from './enricher';
import { TmdbRepository } from './repository';

export { TmdbEnricher } from './enricher';
export { TmdbRepository } from './repository';

/**
 * Convenience constructor that wires {@link TmdbClient},
 * {@link TmdbRepository}, and {@link TmdbEnricher} from a database, an
 * environment, and an injected transport. The composition root chooses the
 * transport (see `@/lib/transport`) so the TMDB client stays HTTP-agnostic.
 *
 * @public
 */
export function buildEnricher(
  db: Database,
  env: CloudflareEnv,
  transport: typeof fetch,
): TmdbEnricher {
  return new TmdbEnricher(
    new TmdbClient(transport, { apiKey: env.TMDB_API_KEY }),
    new TmdbRepository(db),
  );
}
