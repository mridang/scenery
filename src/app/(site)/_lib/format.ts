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

/** Build a `?key=value` query string, dropping empty values. */
export function buildQuery(params: Record<string, string>): string {
  const usp = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)),
  );
  const query = usp.toString();
  return query ? `?${query}` : '';
}
