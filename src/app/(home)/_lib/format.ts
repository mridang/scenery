/**
 * Pure presentation formatters for the home page. Not components — just
 * string/number helpers, colocated with the page that uses them.
 */

/** Minutes → `1h 30m` / `45m`. Null for missing/zero runtimes. */
export function formatRuntime(min: number | null): string | null {
  if (!min) {
    return null;
  }
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when `at` is within the last 24h of `nowMs`. */
export function isFresh(at: string | null, nowMs: number): boolean {
  if (!at) {
    return false;
  }
  const ms = Date.parse(at);
  return Number.isFinite(ms) && nowMs - ms < DAY_MS;
}

/** Coarse "x ago" label (`never` when missing/unparseable). */
export function timeAgo(at: string | null, nowMs: number): string {
  if (!at) {
    return 'never';
  }
  const parsed = Date.parse(at);
  if (!Number.isFinite(parsed)) {
    return 'never';
  }
  const seconds = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Compact money: `$200M` / `$1.2B` / `$500K`. Null for missing/zero. */
export function fmtMoney(n: number | null): string | null {
  if (n == null || n <= 0) {
    return null;
  }
  if (n >= 1_000_000_000) {
    return `$${(n / 1_000_000_000).toFixed(1)}B`;
  }
  if (n >= 1_000_000) {
    return `$${Math.round(n / 1_000_000)}M`;
  }
  return `$${Math.round(n / 1000)}K`;
}

/** Compact size: `4.3 GB` / `700 MB`. Null for missing/zero. */
export function fmtSize(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) {
    return null;
  }
  const gb = bytes / 1_000_000_000;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1_000_000)} MB`;
}

/** Build a `?lang=&sort=&view=` query string, dropping empty values. */
export function buildQuery(params: Record<string, string>): string {
  const usp = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)),
  );
  const query = usp.toString();
  return query ? `?${query}` : '';
}
