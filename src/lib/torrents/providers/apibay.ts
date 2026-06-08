import { proxyFetch, safeJsonParse } from '../../util';
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
  private readonly timeoutMs: number;
  private readonly scrapingAntKey?: string;

  constructor(opts: ApibayOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'https://apibay.org/q.php';
    this.category = opts.category ?? '200'; // 200 = video/movies
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.scrapingAntKey = opts.scrapingAntKey;
  }

  async search(imdbId: string): Promise<LookupResult> {
    const url = `${this.baseUrl}?q=${encodeURIComponent(imdbId)}&cat=${this.category}`;
    const res = await proxyFetch(url, {
      scrapingAntKey: this.scrapingAntKey,
      timeoutMs: this.timeoutMs,
    });
    if (!res.ok) {
      return {
        status: 'error',
        torrents: [],
        rawResponse: res.text.slice(0, 4000),
        httpStatus: res.status,
        error: res.error ?? `http ${res.status}`,
      };
    }

    const parsed = safeJsonParse<ApibayStream[]>(res.text);
    if (!parsed.ok) {
      return {
        status: 'error',
        torrents: [],
        rawResponse: res.text.slice(0, 4000),
        httpStatus: res.status,
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
        rawResponse: res.text,
        httpStatus: res.status,
      };
    }

    const torrents = streams
      .map((s) => this.parseStream(s))
      .filter((t): t is ParsedTorrent => t !== null);
    return {
      status: torrents.length > 0 ? 'success' : 'empty',
      torrents,
      rawResponse: res.text,
      httpStatus: res.status,
    };
  }

  private parseStream(s: ApibayStream): ParsedTorrent | null {
    if (!s.info_hash || s.info_hash === EMPTY_HASH) {
      return null;
    }
    const sizeNum = Number(s.size);
    const seeders = Number(s.seeders);
    return {
      infoHash: s.info_hash.toLowerCase(),
      title: s.name,
      rawTitle: s.name,
      source: 'ThePirateBay',
      seeders: Number.isFinite(seeders) ? seeders : null,
      sizeBytes: Number.isFinite(sizeNum) && sizeNum > 0 ? sizeNum : null,
      quality: detectQuality(s.name),
      isHdr: detectHdr(s.name),
      isRemux: detectRemux(s.name),
    };
  }
}
