import type { LookupResult, ResolvedLookup, TorrentProvider } from "./types";

// Walks providers in priority order. First success wins. If everyone
// returns empty, persist that. If everyone errors, propagate the last
// error along with the full attempt log so we can debug.
export class TorrentLookupManager {
  constructor(private readonly providers: TorrentProvider[]) {
    if (providers.length === 0) {
      throw new Error("TorrentLookupManager needs at least one provider");
    }
  }

  async lookup(imdbId: string): Promise<ResolvedLookup> {
    // Local mutable buffer; the returned attempted array is readonly via
    // the ResolvedLookup interface, but we build it up here.
    const attempted: {
      provider: string;
      status: LookupResult["status"];
      error?: string;
    }[] = [];
    let lastEmpty: { provider: string; result: LookupResult } | null = null;
    let lastError: { provider: string; result: LookupResult } | null = null;

    for (const provider of this.providers) {
      let result: LookupResult;
      try {
        result = await provider.search(imdbId);
      } catch (err) {
        result = {
          status: "error",
          torrents: [],
          rawResponse: "",
          error: err instanceof Error ? err.message : String(err),
        };
      }
      attempted.push({
        provider: provider.name,
        status: result.status,
        error: result.error,
      });

      if (result.status === "success") {
        return { provider: provider.name, result, attempted };
      }
      if (result.status === "empty" && !lastEmpty) {
        lastEmpty = { provider: provider.name, result };
      }
      if (result.status === "error") {
        lastError = { provider: provider.name, result };
      }
    }

    if (lastEmpty) {
      return {
        provider: lastEmpty.provider,
        result: lastEmpty.result,
        attempted,
      };
    }
    if (lastError) {
      return {
        provider: lastError.provider,
        result: lastError.result,
        attempted,
      };
    }
    // Should be unreachable, but TypeScript wants exhaustiveness.
    return {
      provider: "none",
      result: {
        status: "error",
        torrents: [],
        rawResponse: "",
        error: "no provider returned",
      },
      attempted,
    };
  }
}
