import { DdlvalleySource, ScnsrcSource } from './providers';
import type { Source } from './types';

export { DdlvalleySource, ScnsrcSource } from './providers';
export type { ExtractedRelease, FetchResult, Source } from './types';

/**
 * Build the registered set of sources over a given transport. The caller
 * (a composition root) decides how bytes are fetched and passes a label
 * describing that path — the sources themselves stay transport-agnostic.
 *
 * @param transport - A `fetch`-compatible transport (see `@/lib/transport`).
 * @param fetcherLabel - Identifier persisted on each snapshot row.
 * @returns Map of slug → {@link Source}.
 * @public
 */
export function buildSources(
  transport: typeof fetch,
  fetcherLabel: string,
): Record<string, Source> {
  return {
    scnsrc: new ScnsrcSource(transport, fetcherLabel),
    ddlvalley: new DdlvalleySource(transport, fetcherLabel),
  };
}
