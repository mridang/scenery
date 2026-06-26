/**
 * Visual derivations shared by the catalog cards: the tier colour for
 * the score badge and the green/amber/grey state machine for torrent
 * availability. Plain functions so cards and the hero can read them
 * without pulling in a component.
 */
import type { ScoredMovie, Tier } from '../../../lib/catalog';

/** Score colour: green ≥ 85, amber ≥ 60, grey otherwise; sky for unknown. */
export function scoreColor(score: number, tier: Tier): string {
  if (tier === '?') {
    return '#9ca3af';
  }
  if (score >= 85) {
    return '#34d399';
  }
  if (score >= 60) {
    return '#fbbf24';
  }
  return '#9a9aa4';
}

/** Status colour mirrors the legacy `torrent` / `pending` / `none` palette. */
export function statusColor(state: TorrentState): string {
  if (state === 'torrent') {
    return '#34d399';
  }
  if (state === 'pending') {
    return '#fbbf24';
  }
  return '#71717a';
}

/** Coarse availability state used for the dot indicator + status label. */
export type TorrentState = 'torrent' | 'pending' | 'none';

/**
 * Map the raw torrent_status onto the simple three-state machine the
 * cards render: success-with-count → available, empty/error → none,
 * everything else (including never-looked-up rows) → pending.
 */
export function torrentState(movie: ScoredMovie): TorrentState {
  const { row } = movie;
  if (row.torrent_status === 'success' && (row.torrent_count ?? 0) > 0) {
    return 'torrent';
  }
  if (row.torrent_status === 'empty' || row.torrent_status === 'error') {
    return 'none';
  }
  return 'pending';
}

/** Compact "Score" → grade letter; mirrors the legacy `tier` field. */
export function gradeLabel(tier: Tier): string {
  return tier === '?' ? '?' : tier;
}

/** TMDB votes shortened: 1.2k, 24k, etc. */
export function fmtVotes(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
}

/** Top-right pill label: quality when available, the state label otherwise. */
export function topRightLabel(
  state: TorrentState,
  quality: string | null,
): string {
  if (state === 'torrent') {
    return quality ?? 'Available';
  }
  return state === 'pending' ? 'Pending' : 'No torrent';
}

/**
 * SVG path under `/icons/` for the resolution badge of a given quality,
 * or `null` if we don't have a matching badge. The text fallback in
 * {@link topRightLabel} still covers anything missing here.
 */
export function qualityIconPath(quality: string | null): string | null {
  if (quality === null) {
    return null;
  }
  if (quality === '2160p') {
    return '/icons/4k-ultra-hd.svg';
  }
  if (quality === '1440p') {
    return '/icons/2k-quad-hd.svg';
  }
  if (quality === '1080p') {
    return '/icons/1080p-full-hd.svg';
  }
  if (quality === '720p') {
    return '/icons/720p-hd.svg';
  }
  return null;
}
