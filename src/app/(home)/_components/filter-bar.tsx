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
    <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-500">View:</span>
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
      <span className="ml-4 text-gray-500">Sort:</span>
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
  const unknown = langs.find((l) => l.code === '?');
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-500">Language:</span>
      <LangChip
        code="en"
        active={lang}
        sort={sort}
        count={langs.find((l) => l.code === 'en')?.count ?? 0}
      />
      {langs
        .filter((l) => l.code !== 'en' && l.code !== '?')
        .map((l) => (
          <LangChip
            key={l.code}
            code={l.code}
            active={lang}
            sort={sort}
            count={l.count}
          />
        ))}
      {unknown ? (
        <LangChip code="?" active={lang} sort={sort} count={unknown.count} />
      ) : null}
      <LangChip
        code="all"
        active={lang}
        sort={sort}
        count={langs.reduce((s, l) => s + l.count, 0)}
      />
    </nav>
  );
}
