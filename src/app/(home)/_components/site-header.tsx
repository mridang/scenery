import type { LastUpdate } from '../../../lib/catalog';

import { timeAgo } from '../_lib/format';

/** Beyond this gap, the bell's red dot signals "last scrape is stale". */
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/**
 * The two-parallelogram "scenery" mark. Inline so the SVG sits on the
 * same paint pass as the wordmark and never flashes a missing-icon gap.
 */
function Logo({
  width = 46,
  height = 40,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <svg width={width} height={height} viewBox="0 0 32 28" className="block">
      <path d="M9 3 L26 3 L20 13 L3 13 Z" fill="#3b5bff" />
      <path d="M12 15 L29 15 L23 25 L6 25 Z" fill="#3b5bff" opacity={0.72} />
    </svg>
  );
}

/**
 * Sticky dark header: brand, primary nav, search box, freshness bell,
 * and a kebab menu that hides the operational scrape/backfill/enrich
 * buttons so they remain reachable without cluttering the design.
 *
 * The bell only shows its red dot when the last scrape is older than
 * {@link STALE_THRESHOLD_MS} — replacing the old top-of-page banner
 * with the lighter affordance the mockup calls for.
 */
export function SiteHeader({
  lastUpdate,
  nowMs,
  q,
  hiddenParams,
}: {
  lastUpdate: LastUpdate;
  nowMs: number;
  q: string;
  /** Other URL params to preserve when the search form submits. */
  hiddenParams: Readonly<Record<string, string>>;
}) {
  const stale =
    lastUpdate.scrapeAt === null ||
    nowMs - Date.parse(lastUpdate.scrapeAt) > STALE_THRESHOLD_MS;

  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-[rgba(31,31,34,0.86)] backdrop-blur-xl">
      <div className="relative flex w-full items-center justify-between gap-6 p-4 sm:px-7 2xl:px-12">
        {/* Left: brand + nav */}
        <div className="flex items-center gap-6 sm:gap-[38px]">
          <a
            href="/"
            className="flex items-center gap-[13px] text-inherit no-underline"
          >
            <Logo />
            <span className="text-[29px] font-bold tracking-[-0.03em]">
              scenery
            </span>
          </a>
          <nav className="hidden items-center gap-[30px] sm:flex">
            <span className="cursor-pointer text-[14px] font-semibold text-white">
              Movies
            </span>
            <span className="flex cursor-default items-center gap-[7px] text-[14px] font-medium text-[#9a9aa4]">
              Shows
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold tracking-wider text-[#9a9aa4] uppercase">
                Soon
              </span>
            </span>
          </nav>
        </div>

        {/* Right: search + maintenance kebab + freshness bell */}
        <div className="flex items-center gap-3 sm:gap-[22px]">
          <form
            action="/"
            method="GET"
            className="flex w-[180px] items-center gap-2 rounded-[10px] border border-transparent bg-[#2c2c31] py-[7px] pr-[7px] pl-4 sm:w-[250px]"
          >
            {Object.entries(hiddenParams).map(([name, value]) =>
              value ? (
                <input key={name} type="hidden" name={name} value={value} />
              ) : null,
            )}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search"
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[#f3f3f6] outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex size-8 flex-none items-center justify-center rounded-lg bg-[#3a3a41]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 18 18"
                fill="none"
                stroke="#c8c8cf"
                strokeWidth="1.7"
              >
                <circle cx="8" cy="8" r="5.5" />
                <path d="M12.5 12.5 L16 16" strokeLinecap="round" />
              </svg>
            </button>
          </form>

          <MaintenanceMenu />

          <div className="relative size-[42px] flex-none" title="Updates">
            <div className="flex size-[42px] items-center justify-center rounded-full border border-transparent bg-[#26262d]">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#e8e8ec"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </div>
            {stale ? (
              <span
                className="absolute top-px right-px size-[9px] rounded-full border-2 border-[#1f1f22] bg-red-500"
                title={`stale · last scrape ${timeAgo(lastUpdate.scrapeAt, nowMs)}`}
              />
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

/**
 * Kebab popover holding the scrape / enrich / backfill nudges that used
 * to live in the header. `<details>` gives us a click-toggled popover
 * without any client-side React.
 */
function MaintenanceMenu() {
  return (
    <details className="group relative">
      <summary className="flex size-[42px] cursor-pointer list-none items-center justify-center rounded-full border border-transparent bg-[#26262d] [&::-webkit-details-marker]:hidden">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="#e8e8ec"
          aria-hidden
        >
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </summary>
      <form
        action="/api/cron"
        method="post"
        className="absolute top-[calc(100%+8px)] right-0 z-40 flex w-[180px] flex-col gap-1 rounded-xl border border-white/10 bg-[#26262d] p-2 shadow-2xl"
      >
        <button
          type="submit"
          formAction="/api/cron?backfill=10"
          className="rounded-md px-3 py-2 text-left text-[12.5px] font-medium text-[#d4d4d8] hover:bg-white/5"
        >
          Backfill 10 pages
        </button>
        <button
          type="submit"
          formAction="/api/cron?enrichOnly=1"
          className="rounded-md px-3 py-2 text-left text-[12.5px] font-medium text-[#d4d4d8] hover:bg-white/5"
        >
          TMDB enrich
        </button>
        <button
          type="submit"
          className="rounded-md px-3 py-2 text-left text-[12.5px] font-medium text-[#d4d4d8] hover:bg-white/5"
        >
          Scrape page 1
        </button>
      </form>
    </details>
  );
}
