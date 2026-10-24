/**
 * @packageDocumentation
 *
 * Torrent lookup library: the provider clients, the release-name parser and
 * the lookup manager that walks a provider chain. The repository and the
 * run-level composition helpers live in `@/domain/torrents`.
 */

export {
  ApibayProvider,
  TorrentioProvider,
  defaultProviders,
} from './providers';
export type { ApibayOptions, ProviderOptions } from './providers';
export { TorrentLookupManager } from './manager';
export type {
  LookupResult,
  LookupStatus,
  ParsedTorrent,
  ResolvedLookup,
  TorrentProvider,
} from './types';
