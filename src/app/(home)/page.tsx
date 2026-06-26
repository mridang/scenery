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
import { HeroCarousel } from './_components/hero-carousel';
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

  const heroSlate = pickHeroSlate(viewResult.movies, nowMs);
  const comingSoon = pickComingSoon(viewResult.movies, nowMs);
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
      <main className="mx-auto w-full px-4 pt-[34px] pb-11 sm:px-7 2xl:px-12">
        <div className="mb-[34px] flex flex-col gap-6 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1">
            <HeroCarousel movies={heroSlate} />
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

/** Movies first observed within this window count as "recently scraped". */
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** True if the catalog first observed this row inside the recent window. */
function wasScrapedRecently(movie: ScoredMovie, nowMs: number): boolean {
  const seen = Date.parse(movie.row.first_seen_at);
  return Number.isFinite(seen) && nowMs - seen <= RECENT_WINDOW_MS;
}

/** How many slides the hero carousel rotates through. */
const HERO_SLATE_SIZE = 5;

/**
 * Hero slate = up to {@link HERO_SLATE_SIZE} movies that were scraped in
 * the last 24h AND already have a torrent, newest scrape first. Falls
 * back to the most-recent torrent movies overall (so a quiet day still
 * fills the carousel) and finally to any poster-bearing movie — the
 * carousel never paints empty.
 */
function pickHeroSlate(
  movies: readonly ScoredMovie[],
  nowMs: number,
): readonly ScoredMovie[] {
  const withPoster = movies.filter(
    (movie) => movie.row.poster_path || movie.row.backdrop_path,
  );
  const byNewest = [...withPoster].sort(
    (a, b) => Date.parse(b.row.first_seen_at) - Date.parse(a.row.first_seen_at),
  );
  const recentWithTorrent = byNewest.filter(
    (movie) =>
      wasScrapedRecently(movie, nowMs) && torrentState(movie) === 'torrent',
  );
  if (recentWithTorrent.length >= HERO_SLATE_SIZE) {
    return recentWithTorrent.slice(0, HERO_SLATE_SIZE);
  }
  // Top up with the freshest torrents overall, skipping anything already in
  // the slate so the carousel never shows the same movie twice in a row.
  const seen = new Set(recentWithTorrent.map((movie) => movie.row.imdb_id));
  const fallback = byNewest.filter(
    (movie) =>
      !seen.has(movie.row.imdb_id) && torrentState(movie) === 'torrent',
  );
  const slate = [...recentWithTorrent, ...fallback].slice(0, HERO_SLATE_SIZE);
  if (slate.length > 0) {
    return slate;
  }
  // Last resort: a non-torrent movie is still better than an empty hero.
  return byNewest.slice(0, HERO_SLATE_SIZE);
}

/**
 * Coming Soon = movies scraped in the last 24h that don't have a torrent
 * yet — the "we just noticed these, downloads pending" rail. Ordered by
 * scrape time, newest first, capped at 3.
 */
function pickComingSoon(
  movies: readonly ScoredMovie[],
  nowMs: number,
): readonly ScoredMovie[] {
  return movies
    .filter(
      (movie) =>
        wasScrapedRecently(movie, nowMs) && torrentState(movie) !== 'torrent',
    )
    .toSorted(
      (a, b) =>
        Date.parse(b.row.first_seen_at) - Date.parse(a.row.first_seen_at),
    )
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
