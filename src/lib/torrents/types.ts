// Universal shape every provider must emit.
export interface ParsedTorrent {
  readonly infoHash: string;
  readonly title: string;
  readonly rawTitle: string;
  readonly source: string | null; // KAT / 1337x / TPB / etc. as labelled by the provider
  readonly seeders: number | null;
  readonly sizeBytes: number | null;
  readonly quality: string | null; // 480p / 720p / 1080p / 2160p
  readonly isHdr: boolean;
  readonly isRemux: boolean;
}

export type LookupStatus = 'success' | 'empty' | 'error';

export interface LookupResult {
  readonly status: LookupStatus;
  readonly torrents: readonly ParsedTorrent[];
  readonly rawResponse: string;
  readonly httpStatus?: number;
  readonly error?: string;
}

// One concrete torrent source — Torrentio, apibay, etc.
export interface TorrentProvider {
  readonly name: string;
  search(imdbId: string): Promise<LookupResult>;
}

// Chained-lookup outcome — which provider answered, what it returned.
export interface ResolvedLookup {
  readonly provider: string;
  readonly result: LookupResult;
  readonly attempted: readonly {
    readonly provider: string;
    readonly status: LookupStatus;
    readonly error?: string;
  }[];
}
