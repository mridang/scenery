/**
 * Pure presentation formatters for the home page. Not components — just
 * string/number helpers, colocated with the page that uses them.
 */

import { relativeTime } from '@/lib/intl';

/** Minutes → `1h 30m` / `45m`. Null for missing/zero runtimes. */
export function formatRuntime(min: number | null): string | null {
  if (!min) {
    return null;
  }
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/** "3 hours ago" style label (`never` when missing/unparseable). */
export function timeAgo(at: string | null, nowMs: number): string {
  const parsed = at ? Date.parse(at) : NaN;
  return Number.isFinite(parsed)
    ? relativeTime(new Date(parsed), new Date(nowMs))
    : 'never';
}

/** Build a `?key=value` query string, dropping empty values. */
export function buildQuery(params: Record<string, string>): string {
  const usp = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)),
  );
  const query = usp.toString();
  return query ? `?${query}` : '';
}
