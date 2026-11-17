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
import { TorrentioResponseSchema } from './models';
import type { TorrentioStream } from './models';
import type { LookupResult, ParsedTorrent, TorrentProvider } from '../types';
import type { ProviderOptions } from './types';

const SEEDERS_LINE = /👤\s*([\d,]+)/u;
const SIZE_LINE = /💾\s*([\d.]+)\s*(GB|MB|TB|KB)/iu;
const SOURCE_LINE = /⚙️\s*(\S+)/u;

/** The number of bytes in each size unit. */
interface UnitBytes {
  readonly [unit: string]: number;
}

// Multipliers for the size units Torrentio emits in its 💾 annotation.
const SIZE_UNIT_BYTES: UnitBytes = {
  TB: 1_000_000_000_000,
  GB: 1_000_000_000,
  MB: 1_000_000,
  KB: 1000,
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
    const firstLine = raw.split('\n', 1)[0] ?? '';

    const seedersMatch = SEEDERS_LINE.exec(raw);
    const seeders =
      seedersMatch?.[1] === undefined
        ? null
        : Number(seedersMatch[1].replaceAll(',', ''));

    const sizeMatch = SIZE_LINE.exec(raw);
    const sizeBytes =
      sizeMatch?.[1] !== undefined && sizeMatch[2] !== undefined
        ? Number(sizeMatch[1]) * SIZE_UNIT_BYTES[sizeMatch[2].toUpperCase()]!
        : null;

    const sourceMatch = SOURCE_LINE.exec(raw);
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
