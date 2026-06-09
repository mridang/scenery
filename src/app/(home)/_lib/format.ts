/**
 * Pure presentation formatters for the home page. Not components — just
 * string/number helpers, colocated with the page that uses them.
 */

/** Minutes → `1h 30m` / `45m`. Null for missing/zero runtimes. */
export function formatRuntime(min: number | null): string | null {
  if (!min) {
    return null;
  }
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True when `at` is within the last 24h of `nowMs`. */
export function isFresh(at: string | null, nowMs: number): boolean {
  if (!at) {
    return false;
  }
  const t = Date.parse(at);
  return Number.isFinite(t) && nowMs - t < DAY_MS;
}

/** Coarse "x ago" label (`never` when missing/unparseable). */
export function timeAgo(at: string | null, nowMs: number): string {
  if (!at) {
    return 'never';
  }
  const t = Date.parse(at);
  if (!Number.isFinite(t)) {
    return 'never';
  }
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 60) {
    return `${s}s ago`;
  }
  const m = Math.floor(s / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  const h = Math.floor(m / 60);
  if (h < 48) {
    return `${h}h ago`;
  }
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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
    Object.entries(params).filter(([, v]) => Boolean(v)),
  );
  const s = usp.toString();
  return s ? `?${s}` : '';
}
