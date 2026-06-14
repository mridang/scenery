import Link from 'next/link';

import { languageLabel } from '@/lib/catalog';

import { buildQuery } from '../_lib/format';

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
      className={`rounded border px-2.5 py-1 sm:px-2 sm:py-0.5 ${
        isActive
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {languageLabel(code)}{' '}
      <span className={isActive ? 'opacity-80' : 'text-gray-400'}>{count}</span>
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
      className={`rounded border px-2.5 py-1 sm:px-2 sm:py-0.5 ${
        isActive
          ? 'border-indigo-500 bg-indigo-500 text-white'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
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
      className={`rounded border px-2.5 py-1 sm:px-2 sm:py-0.5 ${
        isActive
          ? 'border-purple-500 bg-purple-500 text-white'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );
}
