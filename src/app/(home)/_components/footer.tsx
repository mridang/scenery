import type { LastUpdate } from '@/lib/catalog';

import { timeAgo } from '../_lib/format';

/** Per-stage freshness footer + the current view/sort/lang summary line. */
export function Footer({
  lastUpdate,
  nowMs,
  count,
  view,
  sort,
  lang,
}: {
  lastUpdate: LastUpdate;
  nowMs: number;
  count: number;
  view: string;
  sort: string;
  lang: string;
}) {
  return (
    <footer className="mt-10 border-t border-gray-200 pt-4 text-[11px] text-gray-500">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
        <div>
          <span className="font-semibold uppercase">Scrape</span>{' '}
          <span title={lastUpdate.scrapeAt ?? ''}>
            {timeAgo(lastUpdate.scrapeAt, nowMs)}
          </span>
          {lastUpdate.scrapeSource ? ` (${lastUpdate.scrapeSource})` : ''}
        </div>
        <div>
          <span className="font-semibold uppercase">TMDB</span>{' '}
          <span title={lastUpdate.enrichAt ?? ''}>
            {timeAgo(lastUpdate.enrichAt, nowMs)}
          </span>
        </div>
        <div>
          <span className="font-semibold uppercase">Torrents</span>{' '}
          <span title={lastUpdate.torrentsAt ?? ''}>
            {timeAgo(lastUpdate.torrentsAt, nowMs)}
          </span>
          {lastUpdate.torrentsProvider
            ? ` (${lastUpdate.torrentsProvider})`
            : ''}
        </div>
      </div>
      <div className="mt-2 text-gray-400">
        scenery · {count} movies shown · view={view} · sort={sort} · lang={lang}
      </div>
    </footer>
  );
}
