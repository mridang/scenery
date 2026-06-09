/**
 * Magnet-link construction and the dynamic tracker list.
 *
 * The UI no longer bakes a static tracker list into every link. Instead
 * the home page points each download at the `/magnet/<hash>` endpoint,
 * which builds the magnet on click using a freshly-fetched "best
 * trackers" list. This keeps the rendered HTML small and the trackers
 * current. The RSS feed still embeds a self-contained magnet (automated
 * clients don't follow an HTTP→magnet redirect reliably).
 */

/**
 * Trackers used when the live list can't be fetched. A small, stable set
 * of well-known public UDP trackers.
 */
export const FALLBACK_TRACKERS: readonly string[] = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
];

/** Cloudflare-hosted mirror of ngosang/trackerslist's "best" list. */
const TRACKERS_URL = 'https://cf.trackerslist.com/best.txt';
/** How long a fetched tracker list is reused within a warm isolate. */
const TRACKERS_TTL_MS = 6 * 60 * 60 * 1000;

/** v1 info hash: 40 hex chars. v2/base32: 32 chars of RFC 4648 base32. */
const HEX_40 = /^[a-fA-F0-9]{40}$/;
const BASE32_32 = /^[A-Z2-7]{32}$/i;

/** True when `hash` is a syntactically valid BitTorrent info hash. */
export function isValidInfoHash(hash: string): boolean {
  return HEX_40.test(hash) || BASE32_32.test(hash);
}

/** Build a `magnet:` URI from an info hash, display name and trackers. */
export function buildMagnet(
  infoHash: string,
  name: string | null,
  trackers: readonly string[],
): string {
  const displayNameParam =
    name === null || name === '' ? '' : `&dn=${encodeURIComponent(name)}`;
  const trackerParams = trackers
    .map((tracker) => `&tr=${encodeURIComponent(tracker)}`)
    .join('');
  return `magnet:?xt=urn:btih:${infoHash}${displayNameParam}${trackerParams}`;
}

/** The relative URL of the magnet endpoint for a given torrent. */
export function magnetPath(infoHash: string, name: string | null): string {
  const query =
    name === null || name === '' ? '' : `?dn=${encodeURIComponent(name)}`;
  return `/magnet/${infoHash}${query}`;
}

// Per-isolate memo so a burst of clicks doesn't refetch the list. Cold
// isolates fetch once; everything else reuses it for the TTL.
let cache: { at: number; trackers: readonly string[] } | null = null;

/** Clear the memoised tracker list. Test-only seam. */
export function resetTrackerCache(): void {
  cache = null;
}

/**
 * The current "best trackers" list, fetched live and memoised. Any
 * failure (network, non-200, empty body) falls back to
 * {@link FALLBACK_TRACKERS} so a magnet is always constructable.
 *
 * @param transport - injected fetch, so this stays testable and the lib
 *   never reaches for a global.
 */
export async function bestTrackers(
  transport: typeof fetch,
): Promise<readonly string[]> {
  const now = Date.now();
  if (cache !== null && now - cache.at < TRACKERS_TTL_MS) {
    return cache.trackers;
  }
  try {
    const response = await transport(TRACKERS_URL);
    if (!response.ok) {
      throw new Error(`tracker list HTTP ${response.status}`);
    }
    const trackers = (await response.text())
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (trackers.length === 0) {
      throw new Error('tracker list empty');
    }
    cache = { at: now, trackers };
    return trackers;
  } catch {
    return FALLBACK_TRACKERS;
  }
}
