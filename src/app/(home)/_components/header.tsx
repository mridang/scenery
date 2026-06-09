import type { LastUpdate } from '@/lib/catalog';

import { timeAgo } from '../_lib/format';

/** Page title, the scrape/tmdb/torrent freshness line, RSS + manual triggers. */
export function Header({
  lastUpdate,
  nowMs,
  feedHref,
}: {
  lastUpdate: LastUpdate;
  nowMs: number;
  feedHref: string;
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-baseline sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-bold sm:text-xl">scenery</h1>
        <div className="text-[11px] leading-snug text-gray-500">
          scrape{' '}
          <span title={lastUpdate.scrapeAt ?? ''}>
            {timeAgo(lastUpdate.scrapeAt, nowMs)}
          </span>
          {lastUpdate.scrapeSource ? ` (${lastUpdate.scrapeSource})` : ''}
          {' · '}tmdb{' '}
          <span title={lastUpdate.enrichAt ?? ''}>
            {timeAgo(lastUpdate.enrichAt, nowMs)}
          </span>
          {' · '}torrents{' '}
          <span title={lastUpdate.torrentsAt ?? ''}>
            {timeAgo(lastUpdate.torrentsAt, nowMs)}
          </span>
          {lastUpdate.torrentsProvider
            ? ` (${lastUpdate.torrentsProvider})`
            : ''}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={feedHref}
          className="rounded border border-orange-500 px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50"
        >
          RSS
        </a>
        <form action="/api/cron" method="post" className="flex flex-wrap gap-2">
          <button
            type="submit"
            formAction="/api/cron?backfill=10"
            className="rounded border px-2 py-1 text-xs hover:bg-gray-100 sm:px-3"
          >
            Backfill 10
          </button>
          <button
            type="submit"
            formAction="/api/cron?enrichOnly=1"
            className="rounded border px-2 py-1 text-xs hover:bg-gray-100 sm:px-3"
          >
            TMDB enrich
          </button>
          <button
            type="submit"
            className="rounded border px-2 py-1 text-xs hover:bg-gray-100 sm:px-3"
          >
            Scrape p1
          </button>
        </form>
      </div>
    </header>
  );
}
