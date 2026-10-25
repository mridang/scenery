/**
 * @packageDocumentation
 *
 * The Pirate Bay's official JSON API (`q.php`), as a torrent provider. Lookups
 * by IMDb id are native (`q=tt…&cat=200`); an empty result is a single
 * sentinel row with an all-zero info_hash. Built on {@link JsonClient}: fetch +
 * Zod-decode, then map to the provider's {@link LookupResult}.
 */

import { JsonClient } from '@/lib/http';

import { detectHdr, detectQuality, detectRemux } from '../parsing';
import type { LookupResult, ParsedTorrent, TorrentProvider } from '../types';
import { ApibayResponseSchema, type ApibayStream } from './models';
import type { ApibayOptions } from './types';

const EMPTY_HASH = '0000000000000000000000000000000000000000';
const ACCEPT_JSON: RequestInit = { headers: { Accept: 'application/json' } };

export class ApibayProvider implements TorrentProvider {
  readonly name = 'apibay';
  private readonly http: JsonClient;
  private readonly category: string;

  constructor(
    opts: ApibayOptions = {},
    fetcher: typeof fetch = globalThis.fetch,
  ) {
    this.http = new JsonClient(
      opts.baseUrl ?? 'https://apibay.org/q.php',
      fetcher,
    );
    this.category = opts.category ?? '200'; // 200 = video/movies
  }

  async search(imdbId: string): Promise<LookupResult> {
    const result = await this.http.request(
      { path: '', query: { q: imdbId, cat: this.category }, init: ACCEPT_JSON },
      ApibayResponseSchema,
    );
    if (!result.ok) {
      return {
        status: 'error',
        torrents: [],
        rawResponse: result.raw.slice(0, 4000),
        ...(result.status === undefined ? {} : { httpStatus: result.status }),
        error: result.error,
      };
    }

    const streams = result.value;
    if (streams.length === 1 && streams[0]?.info_hash === EMPTY_HASH) {
      return {
        status: 'empty',
        torrents: [],
        rawResponse: result.raw,
        httpStatus: result.status,
      };
    }

    const torrents = streams
      .map((stream) => this.parseStream(stream))
      .filter((torrent): torrent is ParsedTorrent => torrent !== null);
    return {
      status: torrents.length > 0 ? 'success' : 'empty',
      torrents,
      rawResponse: result.raw,
      httpStatus: result.status,
    };
  }

  private parseStream(stream: ApibayStream): ParsedTorrent | null {
    if (!stream.info_hash || stream.info_hash === EMPTY_HASH) {
      return null;
    }
    const sizeNum = Number(stream.size);
    const seeders = Number(stream.seeders);
    return {
      infoHash: stream.info_hash.toLowerCase(),
      title: stream.name,
      rawTitle: stream.name,
      source: 'ThePirateBay',
      seeders: Number.isFinite(seeders) ? seeders : null,
      sizeBytes: Number.isFinite(sizeNum) && sizeNum > 0 ? sizeNum : null,
      quality: detectQuality(stream.name),
      isHdr: detectHdr(stream.name),
      isRemux: detectRemux(stream.name),
    };
  }
}
