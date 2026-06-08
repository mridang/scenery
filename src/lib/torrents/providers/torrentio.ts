import { proxyFetch } from '../../util/proxy-fetch';
import { detectHdr, detectQuality, detectRemux } from '../parsing';
import type { LookupResult, ParsedTorrent, TorrentProvider } from '../types';

interface TorrentioStream {
  name?: string;
  title?: string;
  infoHash?: string;
}

interface TorrentioResponse {
  streams?: TorrentioStream[];
}

/** Options for {@link TorrentioProvider}. @public */
export interface TorrentioOptions {
  baseUrl?: string;
  timeoutMs?: number;
  /**
   * When set, route requests through ScrapingAnt's rotating proxy so a
   * single Worker IP can't get banned by Torrentio's rate limiter.
   */
  scrapingAntKey?: string;
}

export class TorrentioProvider implements TorrentProvider {
  readonly name = 'torrentio';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly scrapingAntKey?: string;

  constructor(opts: TorrentioOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'https://torrentio.strem.fun/stream/movie';
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.scrapingAntKey = opts.scrapingAntKey;
  }

  async search(imdbId: string): Promise<LookupResult> {
    const res = await proxyFetch(`${this.baseUrl}/${imdbId}.json`, {
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
    let parsed: TorrentioResponse;
    try {
      parsed = JSON.parse(res.text) as TorrentioResponse;
    } catch (err) {
      return {
        status: 'error',
        torrents: [],
        rawResponse: res.text.slice(0, 4000),
        httpStatus: res.status,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    const torrents = (parsed.streams ?? [])
      .map((s) => this.parseStream(s))
      .filter((t): t is ParsedTorrent => t !== null);
    return {
      status: torrents.length > 0 ? 'success' : 'empty',
      torrents,
      rawResponse: res.text,
      httpStatus: res.status,
    };
  }

  private parseStream(s: TorrentioStream): ParsedTorrent | null {
    if (!s.infoHash) return null;
    const raw = s.title ?? '';
    const firstLine = raw.split('\n')[0] ?? '';

    const seedersMatch = raw.match(/👤\s*([\d,]+)/);
    const seeders =
      seedersMatch?.[1] !== undefined
        ? Number(seedersMatch[1].replace(/,/g, ''))
        : null;

    const sizeMatch = raw.match(/💾\s*([\d.]+)\s*(GB|MB|TB|KB)/i);
    let sizeBytes: number | null = null;
    if (sizeMatch?.[1] !== undefined && sizeMatch[2] !== undefined) {
      const n = Number(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      sizeBytes =
        unit === 'TB'
          ? n * 1_000_000_000_000
          : unit === 'GB'
            ? n * 1_000_000_000
            : unit === 'MB'
              ? n * 1_000_000
              : n * 1_000;
    }

    const sourceMatch = raw.match(/⚙️\s*([^\s\n]+)/);
    const haystack = `${s.name ?? ''} ${firstLine}`;

    return {
      infoHash: s.infoHash.toLowerCase(),
      title: firstLine.trim() || s.infoHash,
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
