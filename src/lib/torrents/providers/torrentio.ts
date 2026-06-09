import { safeJsonParse } from '../../util';
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

  constructor(
    private readonly transport: typeof fetch,
    opts: ProviderOptions = {},
  ) {
    this.baseUrl = opts.baseUrl ?? 'https://torrentio.strem.fun/stream/movie';
  }

  async search(imdbId: string): Promise<LookupResult> {
    try {
      const resp = await this.transport(`${this.baseUrl}/${imdbId}.json`, {
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
      const parsed = safeJsonParse<TorrentioResponse>(text);
      if (!parsed.ok) {
        return {
          status: 'error',
          torrents: [],
          rawResponse: text.slice(0, 4000),
          httpStatus: resp.status,
          error: parsed.error,
        };
      }
      const torrents = (parsed.value.streams ?? [])
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
