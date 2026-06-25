import type { ScoredMovie } from '../../../lib/catalog';

import { formatRuntime } from '../_lib/format';
import { posterUrl } from '../_lib/tmdb-image';

/**
 * Big editorial card sitting above the catalog grid. The "what to watch
 * next" anchor of the page: a backdrop poster, the title at hero size,
 * and the same metadata signals (genres · runtime · rating · size) the
 * cards below carry, so the eye doesn't have to relearn the vocabulary.
 *
 * Renders `null` when the movie is absent or has no poster — there's no
 * sensible placeholder for a card whose visual centerpiece is the art.
 */
export function Hero({ movie }: { movie: ScoredMovie | null }) {
  if (!movie || !movie.row.poster_path) {
    return null;
  }

  const { row, genres, cast } = movie;
  const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
  const backdrop = posterUrl(row.poster_path, 'w780')!;
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
        {row.vote_average !== null && (row.vote_count ?? 0) > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] text-[#e8e8ec]">
            <span className="inline-flex items-center gap-[5px] whitespace-nowrap">
              <span className="rounded-[3px] bg-[#e6c84f] px-1 py-[2px] text-[9px] leading-none font-bold text-black">
                IMDb
              </span>
              <span className="font-semibold">
                {row.vote_average.toFixed(1)} ({fmtVotes(row.vote_count!)})
              </span>
            </span>
          </div>
        ) : null}
        <div className="mt-2 font-mono text-[12px] text-[#d4d4da]">
          {footerBits}
        </div>
      </div>
    </a>
  );
}

function fmtVotes(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
}
