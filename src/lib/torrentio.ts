// Back-compat shim. The real implementation now lives under
// src/lib/torrents/ as a class-based, provider-pluggable layer.
// New code should import from '@/lib/torrents' directly.
export { runTorrentLookups as fetchTorrents } from "./torrents";
export type { TorrentRunSummary as TorrentioSummary } from "./torrents";
