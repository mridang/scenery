import type { LastUpdate } from '../../../lib/catalog';

import { timeAgo } from '../_lib/format';

/**
 * The list of upstream data sources surfaced as favicon chips in the
 * footer. Order matches the mockup. The label sits next to the favicon
 * pulled from Google's s2 service, so adding a source here is enough to
 * make it appear — no asset to ship.
 */
const DATA_SOURCES: ReadonlyArray<{ label: string; domain: string }> = [
  { label: 'TMDB', domain: 'themoviedb.org' },
  { label: 'OMDb', domain: 'omdbapi.com' },
  { label: 'ddlvalley', domain: 'ddlvalley.cool' },
  { label: 'scnsrc', domain: 'scnsrc.me' },
  { label: 'torrentio', domain: 'torrentio.strem.fun' },
  { label: 'apibay', domain: 'apibay.org' },
  { label: '1337x', domain: '1337x.to' },
  { label: 'YTS', domain: 'yts.mx' },
];

/**
 * Two-tier page footer. The top tier carries the brand+blurb and the
 * data-source chip row. The bottom strip mirrors the mockup's micro
 * stats line — items shown / average score / "updated Nh ago" — so
 * freshness stays visible without the heavier banner the old page used.
 */
export function Footer({
  count,
  total,
  avgScore,
  lastUpdate,
  nowMs,
}: {
  count: number;
  total: number;
  avgScore: number;
  lastUpdate: LastUpdate;
  nowMs: number;
}) {
  const scrapeAgo = timeAgo(lastUpdate.scrapeAt, nowMs);
  return (
    <footer className="mt-7 border-t border-white/[0.07]">
      <div className="mx-auto flex max-w-[1480px] flex-wrap justify-between gap-10 px-4 pt-[34px] pb-10 sm:px-7">
        <div className="max-w-[300px]">
          <div className="mb-3 flex items-center gap-[10px]">
            <svg
              width="30"
              height="26"
              viewBox="0 0 32 28"
              className="block"
              aria-hidden
            >
              <path d="M9 3 L26 3 L20 13 L3 13 Z" fill="#3b5bff" />
              <path
                d="M12 15 L29 15 L23 25 L6 25 Z"
                fill="#3b5bff"
                opacity={0.72}
              />
            </svg>
            <span className="text-[19px] font-bold tracking-[-0.03em]">
              scenery
            </span>
          </div>
          <p className="m-0 text-[12.5px] leading-[1.6] text-[#86868c]">
            New movie releases, scored on prestige &amp; quality signals — with
            ratings, torrents and a 1&nbsp;TB download plan.
          </p>
        </div>
        <div className="flex max-w-[430px] flex-col gap-[14px]">
          <span className="font-mono text-[10px] tracking-[0.14em] text-[#6e6e78] uppercase">
            Data sources
          </span>
          <div className="flex flex-wrap gap-2">
            {DATA_SOURCES.map((source) => (
              <span
                key={source.domain}
                className="inline-flex items-center gap-[7px] rounded-[8px] bg-white/5 px-[11px] py-[6px] font-mono text-[11.5px] text-[#c4c4cc]"
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=64`}
                  alt=""
                  width={15}
                  height={15}
                  className="block flex-none rounded-[3px]"
                />
                {source.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-[1480px] flex-wrap justify-between gap-4 px-4 pt-4 pb-9 font-mono text-[11px] text-[#6e6e78] sm:px-7">
          <span>© 2026 scenery</span>
          <span>
            <span className="font-semibold text-[#cfcfd4]">{count}</span> of{' '}
            {total} shown · avg{' '}
            <span className="font-semibold text-[#cfcfd4]">{avgScore}</span> ·
            updated {scrapeAgo}
          </span>
        </div>
      </div>
    </footer>
  );
}
