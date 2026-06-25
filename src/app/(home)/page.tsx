import {
  BUDGET_BYTES,
  CatalogService,
  parsePageViewOptions,
  type ScoredMovie,
} from '../../lib/catalog';
import { getDB } from '../../lib/util';

import { ComingSoon } from './_components/coming-soon';
import { FilterBar } from './_components/filter-bar';
import { Footer } from './_components/footer';
import { Hero } from './_components/hero';
import { MovieGrid } from './_components/movie-grid';
import { PlanView } from './_components/plan-view';
import { SiteHeader } from './_components/site-header';
import { buildQuery } from './_lib/format';
import { torrentState } from './_lib/movie-style';

export const dynamic = 'force-dynamic';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    lang?: string;
    sort?: string;
    view?: string;
    status?: string;
    layout?: string;
    q?: string;
  }>;
}) {
  const opts = parsePageViewOptions(await searchParams);

  const catalog = CatalogService.fromD1(getDB());
  const [viewResult, langs, lastUpdate] = await Promise.all([
    catalog.view({ lang: opts.lang, sort: opts.sort, view: opts.view }),
    catalog.languageCounts(),
    catalog.lastUpdate(),
  ]);

  // Async Server Component rendered once per request, so reading the wall
  // clock here is deterministic for the render.
  // eslint-disable-next-line react-hooks/purity -- per-request server render
  const nowMs = Date.now();

  const feedHref = `/feed.xml?${new URLSearchParams({
    lang: opts.lang,
    sort: opts.sort,
    view: opts.view,
  }).toString()}`;

  const hiddenParams = {
    lang: opts.lang,
    sort: opts.pageSort,
    view: opts.view,
    status: opts.status,
    layout: opts.layout,
  };

  if (opts.view === 'plan') {
    return (
      <>
        <SiteHeader
          lastUpdate={lastUpdate}
          nowMs={nowMs}
          q={opts.q}
          hiddenParams={hiddenParams}
        />
        <PlanView movies={viewResult.movies} budgetBytes={BUDGET_BYTES} />
        <Footer
          count={viewResult.movies.filter((movie) => movie.fits).length}
          total={viewResult.movies.length}
          avgScore={averageScore(viewResult.movies)}
          lastUpdate={lastUpdate}
          nowMs={nowMs}
        />
      </>
    );
  }

  // Catalog view: apply the page-only filters (status / search / 'rating'
  // sort) on the SQL-ordered list. Status uses the same state machine the
  // cards render, so the filter labels and the dot indicators agree.
  const filtered = applyPageFilters(viewResult.movies, opts);

  const heroSource = pickHero(viewResult.movies);
  const comingSoon = pickComingSoon(viewResult.movies);
  const comingSoonHref = `/${buildQuery({
    ...hiddenParams,
    status: 'pending',
  })}`;
  const withTorrents = viewResult.movies.filter(
    (movie) =>
      movie.row.torrent_status === 'success' &&
      (movie.row.torrent_count ?? 0) > 0,
  ).length;

  return (
    <>
      <SiteHeader
        lastUpdate={lastUpdate}
        nowMs={nowMs}
        q={opts.q}
        hiddenParams={hiddenParams}
      />
      <main className="mx-auto max-w-[1480px] px-4 pt-[34px] pb-11 sm:px-7">
        <div className="mb-[34px] flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1">
            <Hero movie={heroSource} />
          </div>
          <ComingSoon movies={comingSoon} seeMoreHref={comingSoonHref} />
        </div>

        <FilterBar
          opts={opts}
          langs={langs}
          total={viewResult.movies.length}
          withTorrents={withTorrents}
          feedHref={feedHref}
        />

        {filtered.length === 0 ? (
          <p className="text-[#9a9aa4]">
            Nothing matches the current filters. Try clearing the search or
            switching status back to All.
          </p>
        ) : (
          <MovieGrid movies={filtered} layout={opts.layout} />
        )}
      </main>

      <Footer
        count={filtered.length}
        total={viewResult.movies.length}
        avgScore={averageScore(viewResult.movies)}
        lastUpdate={lastUpdate}
        nowMs={nowMs}
      />
    </>
  );
}

/** Page-level status / search / 'rating' sort applied after the SQL fetch. */
function applyPageFilters(
  movies: readonly ScoredMovie[],
  opts: ReturnType<typeof parsePageViewOptions>,
): readonly ScoredMovie[] {
  const q = opts.q.toLowerCase();
  const filtered = movies.filter((movie) => {
    if (opts.status !== 'all') {
      const state = torrentState(movie);
      if (opts.status === 'available' && state !== 'torrent') {
        return false;
      }
      if (opts.status === 'pending' && state !== 'pending') {
        return false;
      }
      if (opts.status === 'none' && state !== 'none') {
        return false;
      }
    }
    if (q) {
      const haystack = [
        movie.row.tmdb_title ?? movie.row.latest_release_title ?? '',
        movie.row.director ?? '',
        movie.cast.join(' '),
        movie.genres.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }
    return true;
  });
  if (opts.pageSort === 'rating') {
    return [...filtered].sort(
      (a, b) => (b.row.vote_average ?? 0) - (a.row.vote_average ?? 0),
    );
  }
  return filtered;
}

/** Highest TMDB vote count with a usable poster — the hero centerpiece. */
function pickHero(movies: readonly ScoredMovie[]): ScoredMovie | null {
  let best: ScoredMovie | null = null;
  let bestVotes = -1;
  for (const movie of movies) {
    if (!movie.row.poster_path) {
      continue;
    }
    const votes = movie.row.vote_count ?? 0;
    if (votes > bestVotes) {
      best = movie;
      bestVotes = votes;
    }
  }
  return best;
}

/** Top three pending/no-torrent rows by score for the "Coming Soon" rail. */
function pickComingSoon(
  movies: readonly ScoredMovie[],
): readonly ScoredMovie[] {
  return [...movies]
    .filter((movie) => torrentState(movie) !== 'torrent')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** Rounded average composite score across the catalog. */
function averageScore(movies: readonly ScoredMovie[]): number {
  if (movies.length === 0) {
    return 0;
  }
  const sum = movies.reduce((acc, movie) => acc + movie.score, 0);
  return Math.round(sum / movies.length);
}
