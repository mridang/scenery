import type { ScoredMovie } from '@/domain/catalog';
import { magnetPath } from '@/lib/magnet';

import { formatRuntime } from '../_lib/format';
import {
  qualityIconPath,
  statusColor,
  topRightLabel,
  torrentState,
} from '../_lib/movie-style';
import { posterUrl } from '../_lib/tmdb-image';

import { RatingsRow } from './ratings';

/** Compact "1.2 GB" / "640 MB"; null when the torrent has no measured size. */
function fmtSizeShort(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) {
    return null;
  }
  const gb = bytes / 1_000_000_000;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1_000_000)} MB`;
}

interface CardProps {
  movie: ScoredMovie;
  /** When true, render the larger 2×2 mosaic variant (top-by-votes). */
  big?: boolean;
}

/**
 * The uniform-grid variant: bordered card with a 2:3 poster on top and
 * a metadata block below (score badge, status, title, genres, director,
 * cast, ratings, and the torrent line when one's available).
 *
 * Mirrors the mockup pixel-for-pixel; status colours and score tiers
 * come from {@link movieStyle}.
 */
export function MovieCardUniform({ movie }: CardProps) {
  const { row, genres, cast, score, tier, studios } = movie;
  const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
  const state = torrentState(movie);
  // Uniform cards render at ~200 CSS px wide; w500 keeps them sharp on
  // 2× displays (~400 device px) with headroom for the wider columns that
  // appear at large viewports.
  const poster = posterUrl(row.poster_path, 'w500');
  const stColor = statusColor(state);
  const topRight = topRightLabel(state, row.best_quality);
  const runtime = formatRuntime(row.runtime);
  const metaLine = [...genres, runtime].filter(Boolean).join('  ·  ');
  const dirText = row.director ? `Dir. ${row.director}` : null;
  const castLine = cast.length ? `With ${cast.slice(0, 3).join(', ')}` : null;
  const torrentBits =
    state === 'torrent'
      ? [
          row.best_quality,
          fmtSizeShort(row.best_size_bytes),
          row.best_seeders !== null ? `${row.best_seeders} peers` : null,
          row.best_source,
        ]
          .filter(Boolean)
          .join('  ·  ')
      : '';
  const grayscale = state !== 'torrent';
  const qualityIcon = qualityIconPath(row.best_quality);
  const imdbHref = `https://www.imdb.com/title/${row.imdb_id}/`;
  const magnetHref = row.best_info_hash
    ? magnetPath(row.best_info_hash, row.best_torrent_title)
    : null;

  return (
    <article className="relative flex flex-col gap-[11px] rounded-[14px] border border-transparent bg-[#2a2a2e] p-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[box-shadow,transform] duration-200 hover:translate-y-[-4px] hover:shadow-[0_14px_30px_-14px_rgba(0,0,0,0.6)]">
      {/* Stretched IMDb link: covers the whole card so any non-anchor
          element (title, ratings, etc.) routes there. The magnet badge
          below sits on a higher z-index and intercepts its own clicks. */}
      <a
        href={imdbHref}
        target="_blank"
        rel="noreferrer"
        aria-label={title}
        className="absolute inset-0 z-10 rounded-[14px]"
      />

      <div className="relative aspect-2/3 overflow-hidden rounded bg-[#1c1c22]">
        {poster ? (
          <img
            src={poster}
            loading="lazy"
            alt=""
            className={`block size-full object-cover ${grayscale ? 'grayscale' : ''}`}
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(9,9,11,0.88)_0%,rgba(9,9,11,0.12)_32%,rgba(9,9,11,0)_54%)]" />

        {qualityIcon ? (
          magnetHref ? (
            <a
              href={magnetHref}
              aria-label={`Download ${row.best_quality ?? ''} magnet`}
              title="Download magnet"
              className="absolute top-[10px] right-[10px] z-20 block rounded-[4px] shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-transform hover:scale-105"
            >
              <img
                src={qualityIcon}
                alt={row.best_quality ?? ''}
                width={48}
                height={35}
                className="block h-[26px] w-auto"
              />
            </a>
          ) : (
            <img
              src={qualityIcon}
              alt={row.best_quality ?? ''}
              width={48}
              height={35}
              className="absolute top-[10px] right-[10px] block h-[26px] w-auto rounded-[4px] shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            />
          )
        ) : (
          <div className="absolute top-[10px] right-[10px] flex items-center gap-[6px] rounded-[8px] border border-transparent bg-[rgba(9,9,11,0.66)] px-[9px] py-[5px] font-mono text-[10px] font-medium text-[#d4d4d8] backdrop-blur">
            <span
              className="inline-block size-[6px] rounded-full"
              style={{ background: stColor }}
            />
            {topRight}
          </div>
        )}

        {studios.length > 0 ? (
          <div className="absolute inset-x-[10px] bottom-[10px] flex flex-wrap gap-[5px]">
            {studios.map((label) => (
              <span
                key={label}
                className="rounded-[6px] border border-white/20 bg-white/15 px-[7px] py-[3px] font-mono text-[9.5px] font-semibold tracking-[0.06em] text-[#fafafa] uppercase backdrop-blur"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-[4px] px-[3px] pb-[2px]">
        <div className="flex items-baseline gap-[7px]">
          <span className="truncate text-[14.5px] leading-tight font-semibold tracking-[-0.01em]">
            {title}
          </span>
          {row.tmdb_year !== null ? (
            <span className="ml-auto flex-none font-mono text-[11px] text-[#71717a]">
              {row.tmdb_year}
            </span>
          ) : null}
        </div>
        {metaLine ? (
          <div className="truncate font-mono text-[10.5px] text-[#8a8a94]">
            {metaLine}
          </div>
        ) : null}
        {dirText ? (
          <div className="truncate font-mono text-[10.5px] text-[#c7c7cf]">
            {dirText}
          </div>
        ) : null}
        {castLine ? (
          <div className="truncate text-[11px] text-[#8a8a94]">{castLine}</div>
        ) : null}
        <RatingsRow
          sceneryScore={score}
          sceneryTier={tier}
          imdbRating={row.imdb_rating ?? row.vote_average}
          imdbVotes={row.imdb_votes ?? row.vote_count}
          mcScore={row.metacritic_score}
          rtScore={row.rt_score}
          size="sm"
        />
        {torrentBits ? (
          <div className="mt-px truncate font-mono text-[10px] text-[#6e6e78]">
            {torrentBits}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The mosaic-grid variant: a full-bleed poster tile with all the same
 * signals (score, status, studios, title, meta, ratings) overlaid at
 * the bottom against a gradient. `big` upgrades it to a 2×2 hero tile
 * for the top-by-votes titles {@link MovieGrid} distributes through
 * the layout.
 */
export function MovieCardMosaic({ movie, big = false }: CardProps) {
  const { row, genres, cast, score, tier, studios } = movie;
  const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
  const state = torrentState(movie);
  // Mosaic tiles are ~168 CSS px (small) and ~336 CSS px (big). Pick the
  // next-larger TMDB step so 2× / 3× displays don't have to upscale.
  const poster = posterUrl(row.poster_path, big ? 'w780' : 'w500');
  const stColor = statusColor(state);
  const topRight = topRightLabel(state, row.best_quality);
  const runtime = formatRuntime(row.runtime);
  const metaLine = [...genres, runtime].filter(Boolean).join('  ·  ');
  const credit = [
    row.director ? `Dir. ${row.director}` : null,
    cast.length ? cast.slice(0, 3).join(', ') : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  const grayscale = state !== 'torrent';
  const qualityIcon = qualityIconPath(row.best_quality);
  const imdbHref = `https://www.imdb.com/title/${row.imdb_id}/`;
  const magnetHref = row.best_info_hash
    ? magnetPath(row.best_info_hash, row.best_torrent_title)
    : null;

  return (
    <div
      className={`scn-tile ${big ? 'scn-big' : ''} block overflow-hidden rounded text-[#f4f4f5] shadow-[0_6px_18px_-10px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:scale-[1.012]`}
      style={{ background: '#2a2a2e' }}
    >
      {/* Stretched IMDb link covers the whole tile; the magnet badge
          sits on a higher z-index and intercepts its own clicks. */}
      <a
        href={imdbHref}
        target="_blank"
        rel="noreferrer"
        aria-label={title}
        className="absolute inset-0 z-10"
      />
      {poster ? (
        <img
          src={poster}
          loading="lazy"
          alt=""
          className={`absolute inset-0 size-full object-cover ${grayscale ? 'grayscale' : ''}`}
        />
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(9,9,11,0.97)_0%,rgba(9,9,11,0.88)_30%,rgba(9,9,11,0.5)_56%,rgba(9,9,11,0)_82%)]" />

      {qualityIcon ? (
        magnetHref ? (
          <a
            href={magnetHref}
            aria-label={`Download ${row.best_quality ?? ''} magnet`}
            title="Download magnet"
            className="absolute top-[9px] right-[9px] z-20 block rounded-[4px] shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-transform hover:scale-105"
          >
            <img
              src={qualityIcon}
              alt={row.best_quality ?? ''}
              width={big ? 60 : 44}
              height={big ? 44 : 32}
              className={`block w-auto ${big ? 'h-[32px]' : 'h-[24px]'}`}
            />
          </a>
        ) : (
          <img
            src={qualityIcon}
            alt={row.best_quality ?? ''}
            width={big ? 60 : 44}
            height={big ? 44 : 32}
            className={`absolute top-[9px] right-[9px] block w-auto rounded-[4px] shadow-[0_2px_6px_rgba(0,0,0,0.5)] ${big ? 'h-[32px]' : 'h-[24px]'}`}
          />
        )
      ) : (
        <div className="absolute top-[9px] right-[9px] flex items-center gap-[5px] rounded-[8px] bg-[rgba(9,9,11,0.6)] px-2 py-1 font-mono text-[9.5px] text-[#d4d4d8] backdrop-blur">
          <span
            className="inline-block size-[6px] rounded-full"
            style={{ background: stColor }}
          />
          {topRight}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[4px] p-[13px]">
        {studios.length > 0 ? (
          <div className="mb-px flex flex-wrap gap-[5px]">
            {studios.map((label) => (
              <span
                key={label}
                className="rounded-[5px] border border-white/20 bg-white/15 px-[6px] py-[2px] font-mono text-[9px] font-semibold tracking-wider text-[#fafafa] uppercase backdrop-blur"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
        <div
          className="truncate leading-[1.2] font-semibold tracking-[-0.01em]"
          style={{ fontSize: big ? '20px' : '13px' }}
        >
          {title}
        </div>
        {metaLine ? (
          <div className="truncate font-mono text-[10px] text-[#c4c4c8]">
            {metaLine}
          </div>
        ) : null}
        {credit ? (
          <div className="truncate font-mono text-[9.5px] text-[#9a9aa2]">
            {credit}
          </div>
        ) : null}
        <RatingsRow
          sceneryScore={score}
          sceneryTier={tier}
          imdbRating={row.imdb_rating ?? row.vote_average}
          imdbVotes={row.imdb_votes ?? row.vote_count}
          mcScore={row.metacritic_score}
          rtScore={row.rt_score}
          size="sm"
        />
      </div>
    </div>
  );
}
