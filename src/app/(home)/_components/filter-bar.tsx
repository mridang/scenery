import Link from 'next/link';

import type { LangCount, PageViewOptions } from '../../../lib/catalog';

import { buildQuery } from '../_lib/format';

const PILL_GROUP =
  'inline-flex items-center gap-[2px] rounded-[10px] bg-white/5 p-[4px]';

const PILL_BASE =
  'font-sans text-[12.5px] font-semibold px-[14px] py-[7px] rounded-[8px] whitespace-nowrap transition-colors';
const PILL_ACTIVE = 'text-white bg-[var(--accent)]';
const PILL_IDLE = 'font-medium text-[#b4b4be] bg-transparent hover:text-white';

/**
 * Build the query string for a single-param flip while preserving every
 * other URL filter. Centralised so the chips below never drop the active
 * language, sort, or search state when navigating.
 */
function patchHref(opts: PageViewOptions, patch: Partial<PageViewOptions>) {
  const merged = { ...opts, ...patch };
  return `/${buildQuery({
    lang: merged.lang,
    sort: merged.pageSort,
    view: merged.view,
    status: merged.status,
    layout: merged.layout,
    q: merged.q,
  })}`;
}

interface Pill {
  key: string;
  label: string;
  active: boolean;
  href: string;
}

function PillGroup({ pills }: { pills: readonly Pill[] }) {
  return (
    <div className={PILL_GROUP}>
      {pills.map((pill) => (
        <Link
          key={pill.key}
          href={pill.href}
          className={`${PILL_BASE} ${pill.active ? PILL_ACTIVE : PILL_IDLE}`}
        >
          {pill.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * Headline + dual pill groups (status, sort) + the 1 TB Plan CTA, the
 * Genres / Language dropdowns, and the RSS link. Sits below the hero and
 * above the grid; mirrors the mockup's main control row.
 */
export function FilterBar({
  opts,
  langs,
  total,
  withTorrents,
  feedHref,
}: {
  opts: PageViewOptions;
  langs: readonly LangCount[];
  total: number;
  withTorrents: number;
  feedHref: string;
}) {
  const sortLabel =
    opts.pageSort === 'score'
      ? 'score'
      : opts.pageSort === 'rating'
        ? 'rating'
        : 'release date';
  const planHref = patchHref(opts, { view: 'plan' });

  const statusPills: Pill[] = [
    { key: 'all', label: 'All' },
    { key: 'available', label: 'Available' },
    { key: 'pending', label: 'Pending' },
    { key: 'none', label: 'No torrent' },
  ].map((pill) => ({
    ...pill,
    active: opts.status === pill.key,
    href: patchHref(opts, { status: pill.key }),
  }));

  const sortPills: Pill[] = [
    { key: 'score', label: 'Score' },
    { key: 'date', label: 'Date' },
    { key: 'rating', label: 'Rating' },
  ].map((pill) => ({
    ...pill,
    active: opts.pageSort === pill.key,
    href: patchHref(opts, { sort: pill.key }),
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="m-0 text-[26px] font-bold tracking-[-0.025em]">
          {opts.view === 'plan' ? '1 TB download plan' : 'New releases'}
        </h1>
        <p className="m-0 mt-[7px] text-[13.5px] text-[#9a9aa4]">
          Scored on prestige &amp; quality signals · {withTorrents} of {total}{' '}
          available now · ranked by {sortLabel}.
        </p>
      </div>

      <div className="mb-[22px] flex flex-wrap items-center gap-[10px]">
        <PillGroup pills={statusPills} />
        <PillGroup pills={sortPills} />

        <div className="ml-auto flex items-center gap-4">
          <Link
            href={planHref}
            className="rounded-[10px] border-none bg-[var(--accent)] px-4 py-[9px] font-sans text-[13px] font-semibold whitespace-nowrap text-white no-underline"
          >
            1 TB Plan
          </Link>
          <LanguageDropdown langs={langs} opts={opts} />
          <a
            href={feedHref}
            target="_blank"
            rel="noreferrer"
            aria-label="RSS feed"
            className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-white/5 no-underline hover:bg-[rgba(238,128,47,0.16)]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#ee802f">
              <circle cx="6.18" cy="17.82" r="2.18" />
              <path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83C19.56 11.4 12.6 4.44 4 4.44z" />
              <path d="M4 10.1v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83C13.9 14.4 9.6 10.1 4 10.1z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Native-`<details>` language picker. The current language is the
 * summary label; clicking opens the full list of available languages
 * (plus 'All') as plain anchor pills. No client JS — the popover state
 * is the browser's.
 */
function LanguageDropdown({
  opts,
  langs,
}: {
  opts: PageViewOptions;
  langs: readonly LangCount[];
}) {
  const current = opts.lang;
  const label = current === 'all' ? 'All langs' : current.toUpperCase();
  const ordered = [
    ...langs.filter((langCount) => langCount.code === 'en'),
    ...langs.filter(
      (langCount) => langCount.code !== 'en' && langCount.code !== '?',
    ),
    ...langs.filter((langCount) => langCount.code === '?'),
  ];
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-[6px] text-[13.5px] font-medium text-[#9a9aa4] [&::-webkit-details-marker]:hidden">
        {label}
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          stroke="#8a8a92"
          strokeWidth="1.6"
        >
          <path d="M2.5 4.5 L6 8 L9.5 4.5" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="absolute top-[calc(100%+8px)] right-0 z-40 flex max-h-[260px] w-[180px] flex-col gap-1 overflow-y-auto rounded-xl border border-white/10 bg-[#26262d] p-2 shadow-2xl">
        <Link
          href={`/${buildQuery({ lang: 'all', sort: opts.pageSort, view: opts.view, status: opts.status, layout: opts.layout, q: opts.q })}`}
          className={`flex items-center justify-between rounded-md px-3 py-2 text-[12.5px] hover:bg-white/5 ${current === 'all' ? 'text-white' : 'text-[#d4d4d8]'}`}
        >
          <span>All languages</span>
          <span className="font-mono text-[10px] text-[#6e6e78]">
            {langs.reduce((sum, langCount) => sum + langCount.count, 0)}
          </span>
        </Link>
        {ordered.map((langCount) => (
          <Link
            key={langCount.code}
            href={`/${buildQuery({ lang: langCount.code, sort: opts.pageSort, view: opts.view, status: opts.status, layout: opts.layout, q: opts.q })}`}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-[12.5px] hover:bg-white/5 ${current === langCount.code ? 'text-white' : 'text-[#d4d4d8]'}`}
          >
            <span>
              {langCount.code === '?'
                ? 'Unknown'
                : langCount.code.toUpperCase()}
            </span>
            <span className="font-mono text-[10px] text-[#6e6e78]">
              {langCount.count}
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}
