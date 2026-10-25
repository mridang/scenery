/**
 * @packageDocumentation
 *
 * Torrentio's stream addon as a torrent provider. The human `title` carries
 * seeders/size/source in an emoji-delimited line that `parseStream` mines.
 * Built on {@link JsonClient}: fetch + Zod-decode, then map to the provider's
 * {@link LookupResult}.
 */

import { JsonClient } from '@/lib/http';

import { detectHdr, detectQuality, detectRemux } from '../parsing';
import type { LookupResult, ParsedTorrent, TorrentProvider } from '../types';
import { TorrentioResponseSchema, type TorrentioStream } from './models';
import type { ProviderOptions } from './types';

// Multipliers for the size units Torrentio emits in its 💾 annotation.
const SIZE_UNIT_BYTES: Record<string, number> = {
  TB: 1_000_000_000_000,
  GB: 1_000_000_000,
  MB: 1_000_000,
  KB: 1_000,
};
const ACCEPT_JSON: RequestInit = { headers: { Accept: 'application/json' } };

export class TorrentioProvider implements TorrentProvider {
  readonly name = 'torrentio';
  private readonly http: JsonClient;

  constructor(
    opts: ProviderOptions = {},
    fetcher: typeof fetch = globalThis.fetch,
  ) {
    this.http = new JsonClient(
      opts.baseUrl ?? 'https://torrentio.strem.fun/stream/movie',
      fetcher,
    );
  }

  async search(imdbId: string): Promise<LookupResult> {
    const result = await this.http.request(
      { path: `/${imdbId}.json`, init: ACCEPT_JSON },
      TorrentioResponseSchema,
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
    const torrents = (result.value.streams ?? [])
      .map((stream) => this.parseStream(stream))
      .filter((torrent): torrent is ParsedTorrent => torrent !== null);
    return {
      status: torrents.length > 0 ? 'success' : 'empty',
      torrents,
      rawResponse: result.raw,
      httpStatus: result.status,
    };
  }

  private parseStream(stream: TorrentioStream): ParsedTorrent | null {
    if (!stream.infoHash) {
      return null;
    }
    const raw = stream.title ?? '';
    const firstLine = raw.split('\n')[0] ?? '';

    const seedersMatch = raw.match(/👤\s*([\d,]+)/);
    const seeders =
      seedersMatch?.[1] !== undefined
        ? Number(seedersMatch[1].replace(/,/g, ''))
        : null;

    const sizeMatch = raw.match(/💾\s*([\d.]+)\s*(GB|MB|TB|KB)/i);
    const sizeBytes =
      sizeMatch?.[1] !== undefined && sizeMatch[2] !== undefined
        ? Number(sizeMatch[1]) * SIZE_UNIT_BYTES[sizeMatch[2].toUpperCase()]!
        : null;

    const sourceMatch = raw.match(/⚙️\s*([^\s\n]+)/);
    const haystack = `${stream.name ?? ''} ${firstLine}`;

    return {
      infoHash: stream.infoHash.toLowerCase(),
      title: firstLine.trim() || stream.infoHash,
      rawTitle: raw,
      source: sourceMatch?.[1] ?? null,
      seeders,
      sizeBytes,
      quality: detectQuality(haystack),
      isHdr: detectHdr(haystack),
      isRemux: detectRemux(haystack),
    };
  }
}
