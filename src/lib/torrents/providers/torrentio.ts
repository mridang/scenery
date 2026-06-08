import { proxyFetch, safeJsonParse } from '../../util';
import { detectHdr, detectQuality, detectRemux } from '../parsing';
import type { LookupResult, ParsedTorrent, TorrentProvider } from '../types';
import type { ProviderOptions } from './types';

interface TorrentioStream {
  readonly name?: string;
  readonly title?: string;
  readonly infoHash?: string;
}

interface TorrentioResponse {
  readonly streams?: readonly TorrentioStream[];
}

// Multipliers for the size units Torrentio emits in its 💾 annotation.
const SIZE_UNIT_BYTES: Record<string, number> = {
  TB: 1_000_000_000_000,
  GB: 1_000_000_000,
  MB: 1_000_000,
  KB: 1_000,
};

export class TorrentioProvider implements TorrentProvider {
  readonly name = 'torrentio';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly scrapingAntKey?: string;

  constructor(opts: ProviderOptions = {}) {
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
    const parsed = safeJsonParse<TorrentioResponse>(res.text);
    if (!parsed.ok) {
      return {
        status: 'error',
        torrents: [],
        rawResponse: res.text.slice(0, 4000),
        httpStatus: res.status,
        error: parsed.error,
      };
    }
    const torrents = (parsed.value.streams ?? [])
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
    if (!s.infoHash) {
      return null;
    }
    const raw = s.title ?? '';
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
