import type { ScoredMovie } from '../../../lib/catalog';

import { MovieCardMosaic, MovieCardUniform } from './movie-card';

/**
 * Either grid the catalog renders into. Mosaic interleaves a small set
 * of "big" 2×2 tiles (the top-by-votes titles) with regular ones, so
 * the page reads as a magazine spread rather than a sortable list.
 * Uniform is the conventional rectangular grid — same data, no rhythm.
 */
export function MovieGrid({
  movies,
  layout,
}: {
  movies: readonly ScoredMovie[];
  layout: string;
}) {
  if (layout === 'mosaic') {
    const ordered = mosaicOrder(movies);
    return (
      <div className="scn-mosaic">
        {ordered.map(({ movie, big }) => (
          <MovieCardMosaic key={movie.row.imdb_id} movie={movie} big={big} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(198px,1fr))] gap-x-[18px] gap-y-[26px]">
      {movies.map((movie) => (
        <MovieCardUniform key={movie.row.imdb_id} movie={movie} />
      ))}
    </div>
  );
}

/**
 * Pick the ~6 most-popular titles (by TMDB vote count) to render as 2×2
 * "big" tiles, then weave them through the smalls at roughly even
 * intervals so the eye encounters one every few rows instead of a
 * top-heavy clump. Stable: tile size tracks popularity, not the more
 * volatile composite score — same movies stay big day-to-day.
 */
function mosaicOrder(
  movies: readonly ScoredMovie[],
): Array<{ movie: ScoredMovie; big: boolean }> {
  const BIG_COUNT = 6;
  const popularity = [...movies]
    .sort((a, b) => (b.row.vote_count ?? 0) - (a.row.vote_count ?? 0))
    .slice(0, BIG_COUNT);
  const bigIds = new Set(popularity.map((movie) => movie.row.imdb_id));

  const bigs: ScoredMovie[] = [];
  const smalls: ScoredMovie[] = [];
  for (const movie of movies) {
    if (bigIds.has(movie.row.imdb_id)) {
      bigs.push(movie);
    } else {
      smalls.push(movie);
    }
  }

  const gapN = Math.max(2, Math.round(smalls.length / (bigs.length + 1)));
  const out: Array<{ movie: ScoredMovie; big: boolean }> = [];
  let bi = 0;
  for (let i = 0; i < smalls.length; i++) {
    out.push({ movie: smalls[i]!, big: false });
    if ((i + 1) % gapN === 0 && bi < bigs.length) {
      out.push({ movie: bigs[bi++]!, big: true });
    }
  }
  while (bi < bigs.length) {
    out.push({ movie: bigs[bi++]!, big: true });
  }
  return out;
}
