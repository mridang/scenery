import { getDB } from '@/lib/util';
import { BUDGET_BYTES, CatalogService, parseViewOptions } from '@/lib/catalog';

import { Footer } from './_components/footer';
import { Header } from './_components/header';
import { ViewSortNav, LanguageNav } from './_components/filter-bar';
import { MovieRow } from './_components/movie-row';
import { PlanSummary } from './_components/plan-summary';
import { StaleBanner } from './_components/stale-banner';
import { StatsGrid } from './_components/stats-grid';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; sort?: string; view?: string }>;
}) {
  const { lang, sort, view } = parseViewOptions(await searchParams);

  const catalog = CatalogService.fromD1(getDB());
  const [stats, viewResult, langs, lastUpdate] = await Promise.all([
    catalog.stats(),
    catalog.view({ lang, sort, view }),
    catalog.languageCounts(),
    catalog.lastUpdate(),
  ]);
  const { movies: rows, plan } = viewResult;

  // Async Server Component rendered once per request, so reading the wall
  // clock here is deterministic for the render.
  // eslint-disable-next-line react-hooks/purity -- per-request server render
  const nowMs = Date.now();
  const feedHref = `/feed.xml?${new URLSearchParams({ lang, sort, view }).toString()}`;

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 px-3 py-4 text-sm text-slate-800 sm:px-6 sm:py-8">
      <link
        rel="alternate"
        type="application/rss+xml"
        title={`scenery — ${view === 'plan' ? '1 TB plan' : 'Catalog'} (${lang}, ${sort})`}
        href={feedHref}
      />

      <StaleBanner scrapeAt={lastUpdate.scrapeAt} nowMs={nowMs} />
      <Header lastUpdate={lastUpdate} nowMs={nowMs} feedHref={feedHref} />
      <ViewSortNav view={view} sort={sort} lang={lang} />
      {plan ? (
        <PlanSummary
          fits={plan.fits}
          skipped={plan.skipped}
          bytesFits={plan.bytesFits}
          budget={BUDGET_BYTES}
        />
      ) : null}
      <LanguageNav lang={lang} sort={sort} langs={langs} />
      <StatsGrid stats={stats} />

      {rows.length === 0 ? (
        <p className="text-slate-500">
          No movies yet. Click <em>Backfill 10 pages</em> to seed.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 sm:gap-4">
          {rows.map((movie, idx) => (
            <MovieRow
              key={movie.row.imdb_id}
              movie={movie}
              prev={idx > 0 ? rows[idx - 1]! : null}
              view={view}
              nowMs={nowMs}
            />
          ))}
        </ul>
      )}

      <Footer
        lastUpdate={lastUpdate}
        nowMs={nowMs}
        count={rows.length}
        view={view}
        sort={sort}
        lang={lang}
      />
    </main>
  );
}
