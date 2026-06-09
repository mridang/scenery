import { safeJsonParse } from '../../util';
import { detectHdr, detectQuality, detectRemux } from '../parsing';
import type { LookupResult, ParsedTorrent, TorrentProvider } from '../types';
import type { ApibayOptions } from './types';

// The Pirate Bay's official JSON API. Lookups by IMDb id are supported
// natively — q=tt12345678&cat=200.
//
// Empty results return a single sentinel row with an all-zero info_hash.

interface ApibayStream {
  readonly id: string;
  readonly name: string;
  readonly info_hash: string;
  readonly leechers: string;
  readonly seeders: string;
  readonly num_files: string;
  readonly size: string; // bytes, as a string
  readonly username: string;
  readonly added: string; // unix epoch as string
  readonly status: string;
  readonly category: string;
  readonly imdb: string;
}

const EMPTY_HASH = '0000000000000000000000000000000000000000';

export class ApibayProvider implements TorrentProvider {
  readonly name = 'apibay';
  private readonly baseUrl: string;
  private readonly category: string;

  constructor(
    private readonly transport: typeof fetch,
    opts: ApibayOptions = {},
  ) {
    this.baseUrl = opts.baseUrl ?? 'https://apibay.org/q.php';
    this.category = opts.category ?? '200'; // 200 = video/movies
  }

  async search(imdbId: string): Promise<LookupResult> {
    const url = `${this.baseUrl}?q=${encodeURIComponent(imdbId)}&cat=${this.category}`;
    try {
      const resp = await this.transport(url, {
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) {
        const text = await resp.text();
        return {
          status: 'error',
          torrents: [],
          rawResponse: text.slice(0, 4000),
          httpStatus: resp.status,
          error: `http ${resp.status}`,
        };
      }

      const text = await resp.text();
      const parsed = safeJsonParse<ApibayStream[]>(text);
      if (!parsed.ok) {
        return {
          status: 'error',
          torrents: [],
          rawResponse: text.slice(0, 4000),
          httpStatus: resp.status,
          error: parsed.error,
        };
      }

      const streams = parsed.value;
      if (
        Array.isArray(streams) &&
        streams.length === 1 &&
        streams[0]?.info_hash === EMPTY_HASH
      ) {
        return {
          status: 'empty',
          torrents: [],
          rawResponse: text,
          httpStatus: resp.status,
        };
      }

      const torrents = streams
        .map((stream) => this.parseStream(stream))
        .filter((torrent): torrent is ParsedTorrent => torrent !== null);
      return {
        status: torrents.length > 0 ? 'success' : 'empty',
        torrents,
        rawResponse: text,
        httpStatus: resp.status,
      };
    } catch (err: unknown) {
      return {
        status: 'error',
        torrents: [],
        rawResponse: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
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
