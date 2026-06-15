import { STALE_THRESHOLD_MS } from '../_lib/badges';
import { timeAgo } from '../_lib/format';

/** Red banner shown when the last scrape is older than the threshold. */
export function StaleBanner({
  scrapeAt,
  nowMs,
}: {
  scrapeAt: string | null;
  nowMs: number;
}) {
  const stale =
    scrapeAt === null || nowMs - Date.parse(scrapeAt) > STALE_THRESHOLD_MS;
  if (!stale) {
    return null;
  }
  return (
    <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800 sm:text-sm">
      <span className="font-bold uppercase">⚠ stale</span> — last scrape{' '}
      <span title={scrapeAt ?? ''}>{timeAgo(scrapeAt, nowMs)}</span>. The
      workflow may be failing. Trigger a manual scrape, or check the cron logs.
    </div>
  );
}
