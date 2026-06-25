import type { ScoredMovie } from '../../../lib/catalog';

import { formatRuntime } from '../_lib/format';
import { backdropUrl } from '../_lib/tmdb-image';

import { RatingsRow } from './ratings';

/**
 * Big editorial card sitting above the catalog grid. The "what to watch
 * next" anchor of the page: a 16:9 TMDB backdrop, the title at hero
 * size, and the same rating/availability signals (IMDb · Metacritic ·
 * Rotten Tomatoes · quality · size · language) the cards below carry,
 * so the eye doesn't have to relearn the vocabulary.
 *
 * Renders `null` when the movie is absent or has no image at all —
 * there's no sensible placeholder for a card whose visual centerpiece
 * is the art.
 */
export function Hero({ movie }: { movie: ScoredMovie | null }) {
  if (!movie) {
    return null;
  }
  const backdrop = backdropUrl(
    movie.row.backdrop_path,
    movie.row.poster_path,
    'w1280',
  );
  if (!backdrop) {
    return null;
  }

  const { row, genres, cast } = movie;
  const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
  const runtime = formatRuntime(row.runtime);
  const metaLine = [...genres, runtime].filter(Boolean).join('  ·  ');
  const credit = [
    row.director ? `Dir. ${row.director}` : null,
    cast.length ? cast.slice(0, 3).join(', ') : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  const status =
    row.torrent_status === 'success' && (row.torrent_count ?? 0) > 0
      ? (row.best_quality ?? 'Available')
      : row.torrent_status === 'empty'
        ? 'No torrent yet'
        : 'Pending';
  const sizeText =
    row.best_size_bytes && row.best_size_bytes > 0
      ? `${(row.best_size_bytes / 1_000_000_000).toFixed(1)} GB`
      : null;
  const language = (row.original_language ?? 'en').toUpperCase();
  const footerBits = [status, sizeText, language].filter(Boolean).join('  ·  ');

  return (
    <a
      href={`https://www.imdb.com/title/${row.imdb_id}/`}
      target="_blank"
      rel="noreferrer"
      className="relative block h-full min-h-[430px] overflow-hidden rounded-[14px] bg-[#2a2a2e] text-inherit no-underline"
    >
      <div
        className="absolute inset-0 bg-cover bg-[center_20%] saturate-[1.06]"
        style={{ backgroundImage: `url(${backdrop})` }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,15,17,0.97)_0%,rgba(15,15,17,0.95)_30%,rgba(15,15,17,0.5)_52%,rgba(15,15,17,0)_68%)]" />
      <div className="absolute inset-y-0 left-0 flex max-w-[580px] flex-col justify-center gap-[13px] px-6 sm:px-[42px]">
        <span className="font-mono text-[11px] tracking-[0.16em] text-[var(--accent)] uppercase">
          Latest movies
        </span>
        <h2 className="m-0 text-[36px] leading-none font-extrabold tracking-[-0.035em] sm:text-[48px]">
          {title}
        </h2>
        {metaLine ? (
          <div className="font-mono text-[12px] text-[#c3c3cc]">{metaLine}</div>
        ) : null}
        {credit ? (
          <div className="max-w-[460px] truncate text-[13.5px] leading-[1.5] text-[#b4b4be]">
            {credit}
          </div>
        ) : null}
        <RatingsRow
          imdbRating={row.imdb_rating ?? row.vote_average}
          imdbVotes={row.imdb_votes ?? row.vote_count}
          mcScore={row.metacritic_score}
          rtScore={row.rt_score}
          size="md"
        />
        <div className="mt-2 font-mono text-[12px] text-[#d4d4da]">
          {footerBits}
        </div>
      </div>
    </a>
  );
}
