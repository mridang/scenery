/**
 * Visual vocabulary for the home page: the Tailwind class maps per tier
 * and prestige studio, and the torrent-status badge state machine. Pure
 * lookups/logic — no components.
 */
import type { Tier } from '@/lib/catalog';

/** Beyond this, the top-of-page staleness banner shows. */
export const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/** Left-border + background tint per tier (the row accent). */
export const TIER_STYLE: Record<Tier, string> = {
  A: 'border-emerald-500 bg-emerald-50/60',
  B: '',
  C: 'border-gray-300 bg-gray-50/60 opacity-70',
  '?': 'border-sky-400 bg-sky-50/40',
};

/** Pill colour per tier (the little A/B/C/? badge). */
export const TIER_BADGE: Record<Tier, string> = {
  A: 'bg-emerald-500 text-white',
  B: 'bg-gray-300 text-gray-700',
  C: 'bg-gray-400 text-white',
  '?': 'bg-sky-400 text-white',
};

// Brand colour per prestige studio label (the labels come from
// catalog/prestige.ts; this maps each to its colour).
const PRESTIGE_CLS: Record<string, string> = {
  Netflix: 'bg-red-600 text-white',
  'Apple TV+': 'bg-black text-white',
  Marvel: 'bg-red-700 text-white',
  HBO: 'bg-fuchsia-700 text-white',
  A24: 'bg-neutral-900 text-white',
  'Amazon MGM': 'bg-sky-700 text-white',
  Searchlight: 'bg-amber-700 text-white',
  Annapurna: 'bg-violet-700 text-white',
  Focus: 'bg-slate-700 text-white',
  NEON: 'bg-lime-500 text-black',
  'Plan B': 'bg-orange-600 text-white',
  Disney: 'bg-blue-800 text-white',
  'Warner Bros': 'bg-blue-900 text-white',
  Universal: 'bg-zinc-800 text-white',
  Paramount: 'bg-blue-700 text-white',
  'Metro-Goldwyn-Mayer': 'bg-amber-600 text-white',
  Lionsgate: 'bg-yellow-600 text-white',
};

/** Tailwind classes for a prestige-studio badge. */
export function prestigeCls(label: string): string {
  return PRESTIGE_CLS[label] ?? 'bg-gray-700 text-white';
}

/** A rendered torrent-status badge: its visual class and label. */
export interface TorrentBadge {
  readonly cls: string;
  readonly label: string;
}

/**
 * Map a movie's torrent lookup state to a badge. Before a lookup row
 * exists, the 24h maturity gate (keyed off the newest release post-time,
 * not the scrape time) decides between "waiting Nh" and "pending".
 */
export function torrentBadge(
  status: string | null,
  releaseAt: string | null,
  nowMs: number,
  count: number | null,
): TorrentBadge {
  if (status === 'success' && (count ?? 0) > 0) {
    return { cls: 'bg-emerald-600 text-white', label: '✓ torrent' };
  }
  if (status === 'empty') {
    return { cls: 'bg-gray-300 text-gray-700', label: 'no torrents' };
  }
  if (status === 'error') {
    return { cls: 'bg-red-600 text-white', label: '✗ lookup err' };
  }
  const seen = releaseAt !== null ? Date.parse(releaseAt) : NaN;
  const age = Number.isFinite(seen) ? nowMs - seen : Infinity;
  if (age < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - age) / (60 * 60 * 1000));
    return {
      cls: 'bg-amber-300 text-amber-900',
      label: `⏳ wait ${hoursLeft}h`,
    };
  }
  return { cls: 'bg-sky-200 text-sky-900', label: '⏳ pending' };
}
