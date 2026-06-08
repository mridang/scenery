import type { LookupResult, ResolvedLookup, TorrentProvider } from './types';

// Walks providers in priority order. First success wins. If everyone
// returns empty, persist that. If everyone errors, propagate the last
// error along with the full attempt log so we can debug.
export class TorrentLookupManager {
  constructor(private readonly providers: readonly TorrentProvider[]) {
    if (providers.length === 0) {
      throw new Error('TorrentLookupManager needs at least one provider');
    }
  }

  async lookup(imdbId: string): Promise<ResolvedLookup> {
    // Run every provider in priority order, recording each outcome so the
    // attempt log preserves attempt order. Resolution is then derived from
    // the collected outcomes rather than mutated mid-loop.
    const outcomes = await this.providers.reduce<
      Promise<
        readonly { readonly provider: string; readonly result: LookupResult }[]
      >
    >(async (accP, provider) => {
      const acc = await accP;
      const result = await provider.search(imdbId).catch(
        (err: unknown): LookupResult => ({
          status: 'error',
          torrents: [],
          rawResponse: '',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return [...acc, { provider: provider.name, result }];
    }, Promise.resolve([]));

    const attempted = outcomes.map(({ provider, result }) => ({
      provider,
      status: result.status,
      error: result.error,
    }));

    // First success wins; else the first empty; else the last error; else
    // an unreachable 'none' fallback (TypeScript wants exhaustiveness).
    const firstSuccess = outcomes.find(
      ({ result }) => result.status === 'success',
    );
    if (firstSuccess) {
      return { ...firstSuccess, attempted };
    }
    const firstEmpty = outcomes.find(({ result }) => result.status === 'empty');
    if (firstEmpty) {
      return { ...firstEmpty, attempted };
    }
    const lastError = outcomes.findLast(
      ({ result }) => result.status === 'error',
    );
    if (lastError) {
      return { ...lastError, attempted };
    }
    return {
      provider: 'none',
      result: {
        status: 'error',
        torrents: [],
        rawResponse: '',
        error: 'no provider returned',
      },
      attempted,
    };
  }
}
