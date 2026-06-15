import type { LangCount } from '@/lib/catalog';

import { LangChip, SortChip, ViewChip } from './chips';

/** The view (catalog / plan) and sort (score / date) selector row. */
export function ViewSortNav({
  view,
  sort,
  lang,
}: {
  view: string;
  sort: string;
  lang: string;
}) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-slate-500">View</span>
      <ViewChip
        view="catalog"
        active={view}
        sort={sort}
        lang={lang}
        label="Catalog"
      />
      <ViewChip
        view="plan"
        active={view}
        sort={sort}
        lang={lang}
        label="1 TB plan"
      />
      <span className="basis-full font-medium text-slate-500 sm:ml-4 sm:basis-auto">
        Sort
      </span>
      <SortChip
        sort="score"
        active={sort}
        lang={lang}
        view={view}
        label="Score (best first)"
      />
      <SortChip
        sort="date"
        active={sort}
        lang={lang}
        view={view}
        label="Date (newest first)"
      />
    </nav>
  );
}

/** The language filter row (English first, then the rest, '?' and 'all'). */
export function LanguageNav({
  lang,
  sort,
  langs,
}: {
  lang: string;
  sort: string;
  langs: readonly LangCount[];
}) {
  const unknown = langs.find((langCount) => langCount.code === '?');
  return (
    <div className="-mx-3 mb-5 max-w-full overflow-x-auto px-3 sm:mx-0 sm:overflow-visible sm:px-0">
      <nav className="flex items-center gap-2 text-xs whitespace-nowrap sm:flex-wrap">
        <span className="flex-none font-medium text-slate-500">Language</span>
        <LangChip
          code="en"
          active={lang}
          sort={sort}
          count={langs.find((langCount) => langCount.code === 'en')?.count ?? 0}
        />
        {langs
          .filter(
            (langCount) => langCount.code !== 'en' && langCount.code !== '?',
          )
          .map((langCount) => (
            <LangChip
              key={langCount.code}
              code={langCount.code}
              active={lang}
              sort={sort}
              count={langCount.count}
            />
          ))}
        {unknown ? (
          <LangChip code="?" active={lang} sort={sort} count={unknown.count} />
        ) : null}
        <LangChip
          code="all"
          active={lang}
          sort={sort}
          count={langs.reduce((sum, langCount) => sum + langCount.count, 0)}
        />
      </nav>
    </div>
  );
}
