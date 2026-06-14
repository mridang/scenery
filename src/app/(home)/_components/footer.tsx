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
    <footer className="mt-12 border-t border-slate-200 pt-5 text-[12px] text-slate-500">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <span className="font-semibold tracking-wider text-slate-600 uppercase">
            Scrape
          </span>{' '}
          <span title={lastUpdate.scrapeAt ?? ''}>
            {timeAgo(lastUpdate.scrapeAt, nowMs)}
          </span>
          {lastUpdate.scrapeSource ? ` (${lastUpdate.scrapeSource})` : ''}
        </div>
        <div>
          <span className="font-semibold tracking-wider text-slate-600 uppercase">
            TMDB
          </span>{' '}
          <span title={lastUpdate.enrichAt ?? ''}>
            {timeAgo(lastUpdate.enrichAt, nowMs)}
          </span>
        </div>
        <div>
          <span className="font-semibold tracking-wider text-slate-600 uppercase">
            Torrents
          </span>{' '}
          <span title={lastUpdate.torrentsAt ?? ''}>
            {timeAgo(lastUpdate.torrentsAt, nowMs)}
          </span>
          {lastUpdate.torrentsProvider
            ? ` (${lastUpdate.torrentsProvider})`
            : ''}
        </div>
      </div>
      <div className="mt-3 text-slate-400">
        scenery · {count} movies shown · view={view} · sort={sort} · lang={lang}
      </div>
    </footer>
  );
}
