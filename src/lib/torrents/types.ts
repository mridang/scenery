// The value-sets this torrent library owns. They are the codec's own
// vocabulary (what a release name and a provider chain produce), so they live
// here, not in the storage layer; the app schema imports them to constrain its
// columns (the domain may depend on a library, never the other way round).

/** Detected video quality of a torrent (null when unknown). @public */
export const QUALITIES = ['2160p', '1080p', '720p', '480p'] as const;
export type Quality = (typeof QUALITIES)[number];

/** Outcome of a torrent lookup for a movie. @public */
export const LOOKUP_STATUSES = ['success', 'empty', 'error'] as const;
export type LookupStatus = (typeof LOOKUP_STATUSES)[number];

/** Torrent provider that answered a lookup. @public */
export const TORRENT_PROVIDERS = ['apibay', 'torrentio'] as const;
export type TorrentProviderName = (typeof TORRENT_PROVIDERS)[number];

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
