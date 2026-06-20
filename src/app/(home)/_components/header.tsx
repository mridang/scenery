import type { LastUpdate } from '../../../lib/catalog';

import { timeAgo } from '../_lib/format';
import { PushToggle } from './push-toggle';

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
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          scenery
        </h1>
        <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
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
        <PushToggle />
        <a
          href={feedHref}
          className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
        >
          RSS
        </a>
        <form
          action="/api/cron"
          method="post"
          className="hidden flex-wrap items-center gap-1.5 sm:flex"
        >
          <button
            type="submit"
            formAction="/api/cron?backfill=10"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
          >
            Backfill 10
          </button>
          <button
            type="submit"
            formAction="/api/cron?enrichOnly=1"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
          >
            TMDB enrich
          </button>
          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
          >
            Scrape p1
          </button>
        </form>
      </div>
    </header>
  );
}
