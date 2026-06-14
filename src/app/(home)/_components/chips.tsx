import Link from 'next/link';

import { languageLabel } from '@/lib/catalog';

import { buildQuery } from '../_lib/format';

const PILL_BASE =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs whitespace-nowrap transition';
const PILL_IDLE =
  'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

/** A language filter pill (shows the language name + movie count). */
export function LangChip({
  code,
  active,
  count,
  sort,
  view,
}: {
  code: string;
  active: string;
  count: number;
  sort: string;
  view?: string;
}) {
  const isActive = code === active;
  return (
    <Link
      href={`/${buildQuery({ lang: code, sort, view: view ?? '' })}`}
      className={`${PILL_BASE} ${
        isActive
          ? 'border border-emerald-500 bg-emerald-500 text-white shadow-sm'
          : PILL_IDLE
      }`}
    >
      {languageLabel(code)}
      <span
        className={`tabular-nums ${isActive ? 'text-white/80' : 'text-slate-400'}`}
      >
        {count}
      </span>
    </Link>
  );
}

/** A sort selector pill (score / date). */
export function SortChip({
  sort,
  active,
  lang,
  view,
  label,
}: {
  sort: string;
  active: string;
  lang: string;
  view: string;
  label: string;
}) {
  const isActive = sort === active;
  return (
    <Link
      href={`/${buildQuery({ lang, sort, view })}`}
      className={`${PILL_BASE} ${
        isActive
          ? 'border border-indigo-500 bg-indigo-500 text-white shadow-sm'
          : PILL_IDLE
      }`}
    >
      {label}
    </Link>
  );
}

/** A view selector pill (catalog / 1 TB plan). */
export function ViewChip({
  view,
  active,
  sort,
  lang,
  label,
}: {
  view: string;
  active: string;
  sort: string;
  lang: string;
  label: string;
}) {
  const isActive = view === active;
  return (
    <Link
      href={`/${buildQuery({ lang, sort, view })}`}
      className={`${PILL_BASE} ${
        isActive
          ? 'border border-purple-500 bg-purple-500 text-white shadow-sm'
          : PILL_IDLE
      }`}
    >
      {label}
    </Link>
  );
}
