import type { LookupStatus, Quality, TorrentProviderName } from '@/utils/enums';

// The lookup/quality/provider value-sets are storage-constrained; re-export
// so torrent consumers can keep importing them from this module.
export type { LookupStatus, Quality, TorrentProviderName } from '@/utils/enums';

// Universal shape every provider must emit.
export interface ParsedTorrent {
  readonly infoHash: string;
  readonly title: string;
  readonly rawTitle: string;
  readonly source: string | null; // KAT / 1337x / TPB / etc. as labelled by the provider
  readonly seeders: number | null;
  readonly sizeBytes: number | null;
  readonly quality: Quality | null;
  readonly isHdr: boolean;
  readonly isRemux: boolean;
}

export interface LookupResult {
  readonly status: LookupStatus;
  readonly torrents: readonly ParsedTorrent[];
  readonly rawResponse: string;
  readonly httpStatus?: number;
  readonly error?: string;
}

// One concrete torrent source — Torrentio, apibay, etc.
export interface TorrentProvider {
  readonly name: TorrentProviderName;
  search(imdbId: string): Promise<LookupResult>;
}

// Chained-lookup outcome — which provider answered, what it returned.
export interface ResolvedLookup {
  readonly provider: TorrentProviderName;
  readonly result: LookupResult;
  readonly attempted: readonly {
    readonly provider: TorrentProviderName;
    readonly status: LookupStatus;
    readonly error?: string;
  }[];
}
