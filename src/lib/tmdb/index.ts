import { TmdbClient } from "./client";
import { TmdbEnricher } from "./enricher";
import { TmdbRepository } from "./repository";

export type { TmdbClientOptions, TmdbResult } from "./client";
export { TmdbClient } from "./client";
export { TmdbEnricher } from "./enricher";
export { TmdbRepository } from "./repository";
export type * from "./types";

/**
 * Convenience constructor that wires {@link TmdbClient},
 * {@link TmdbRepository}, and {@link TmdbEnricher} from a D1 binding
 * and an environment.
 *
 * @public
 */
export function buildEnricher(
  db: D1Database,
  env: CloudflareEnv,
): TmdbEnricher {
  return new TmdbEnricher(
    new TmdbClient({ apiKey: env.TMDB_API_KEY }),
    new TmdbRepository(db),
  );
}
