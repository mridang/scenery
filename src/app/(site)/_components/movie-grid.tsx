import { MovieCardMosaic, MovieCardUniform } from './movie-card';
import type { ScoredMovie } from '@/domain/catalog';

/**
 * Either grid the catalog renders into. Mosaic interleaves a small set
 * of "big" 2×2 tiles (the top-by-votes titles) with regular ones, so
 * the page reads as a magazine spread rather than a sortable list.
 * Uniform is the conventional rectangular grid — same data, no rhythm.
 */
export function MovieGrid({
  movies,
  layout,
}: Readonly<{
  movies: readonly ScoredMovie[];
  layout: string;
}>) {
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
    .toSorted((a, b) => (b.row.vote_count ?? 0) - (a.row.vote_count ?? 0))
    .slice(0, BIG_COUNT);
  const bigIds = new Set(popularity.map((movie) => movie.row.imdb_id));

  const bigs = movies.filter((movie) => bigIds.has(movie.row.imdb_id));
  const smalls = movies.filter((movie) => !bigIds.has(movie.row.imdb_id));

  const gapN = Math.max(2, Math.round(smalls.length / (bigs.length + 1)));
  const woven = smalls.flatMap((small, index) => {
    const big =
      (index + 1) % gapN === 0 ? bigs[(index + 1) / gapN - 1] : undefined;
    return big
      ? [
          { movie: small, big: false },
          { movie: big, big: true },
        ]
      : [{ movie: small, big: false }];
  });
  const rest = bigs
    .slice(Math.floor(smalls.length / gapN))
    .map((movie) => ({ movie, big: true }));
  return [...woven, ...rest];
}
