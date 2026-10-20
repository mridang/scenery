import type { ScoredMovie } from '../../../lib/catalog';

import { posterUrl } from '../_lib/tmdb-image';

/**
 * Right-rail "what's next" list. These are the highest-scored movies the
 * catalog knows about that don't have a torrent yet — i.e. on-the-radar
 * releases, not the rented-shelf grid that fills the rest of the page.
 *
 * The button is a deep-link into the catalog with `?status=pending`, so
 * "See more" exposes the same filter every other surface uses.
 */
export function ComingSoon({
  movies,
  seeMoreHref,
}: {
  movies: readonly ScoredMovie[];
  seeMoreHref: string;
}) {
  if (movies.length === 0) {
    return null;
  }

  return (
    <aside className="sticky top-[150px] hidden w-[300px] flex-none rounded-[14px] border border-transparent bg-[#2a2a2e] p-5 lg:block">
      <div className="mb-[18px] text-[17px] font-bold tracking-[-0.02em]">
        Coming Soon
      </div>
      <div className="flex flex-col gap-5">
        {movies.map((movie) => (
          <ComingSoonRow key={movie.row.imdb_id} movie={movie} />
        ))}
      </div>
      <a
        href={seeMoreHref}
        className="mt-5 block w-full rounded-[10px] border border-white/20 bg-transparent py-[13px] text-center text-[13px] font-semibold text-[#f3f3f6] no-underline"
      >
        See more
      </a>
    </aside>
  );
}

function ComingSoonRow({ movie }: { movie: ScoredMovie }) {
  const { row, genres, cast } = movie;
  const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
  // Sidebar thumb is 58 CSS px → ~174 device px at 3×; w185 was right at
  // the edge, w342 leaves a margin and stays crisp on retina laptops.
  const poster = posterUrl(row.poster_path, 'w342');
  const genreLine = genres.slice(0, 2).join(', ');
  const credit = [
    row.director ? `Dir. ${row.director}` : null,
    cast.length ? cast.slice(0, 3).join(', ') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <a
      href={`https://www.imdb.com/title/${row.imdb_id}/`}
      target="_blank"
      rel="noreferrer"
      className="flex gap-[14px] text-inherit no-underline transition-opacity hover:opacity-80"
    >
      {poster ? (
        <img
          src={poster}
          loading="lazy"
          alt=""
          className="h-[86px] w-[58px] flex-none rounded bg-[#1c1c22] object-cover"
        />
      ) : (
        <div className="h-[86px] w-[58px] flex-none rounded bg-[#1c1c22]" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <span className="text-[14px] leading-[1.3] font-semibold tracking-[-0.01em]">
          {title}
        </span>
        {genreLine ? (
          <span className="font-mono text-[10px] text-[#8a8a94]">
            {genreLine}
          </span>
        ) : null}
        {credit ? (
          <span className="line-clamp-3 text-[11.5px] leading-[1.45] text-[#8a8a94]">
            {credit}
          </span>
        ) : null}
      </div>
    </a>
  );
}
