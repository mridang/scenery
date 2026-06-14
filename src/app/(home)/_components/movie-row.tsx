import { Fragment } from 'react';
import Link from 'next/link';

import type { ScoredMovie } from '@/lib/catalog';
import { magnetPath } from '@/lib/magnet';

import { TIER_BADGE, prestigeCls, torrentBadge } from '../_lib/badges';
import { fmtMoney, fmtSize, formatRuntime, isFresh } from '../_lib/format';

/**
 * One movie card in the list. In plan view, when this card is the first
 * that doesn't fit (the previous one did), a "1 TB cutoff" divider is
 * rendered above it.
 */
export function MovieRow({
  movie,
  prev,
  view,
  nowMs,
}: {
  movie: ScoredMovie;
  prev: ScoredMovie | null;
  view: string;
  nowMs: number;
}) {
  const {
    row,
    studios,
    genres: names,
    cast,
    score,
    tier,
    cumBytes,
    fits,
  } = movie;
  const planMode = view === 'plan';
  const cutoffHere = planMode && prev !== null && prev.fits && !fits;
  const runtime = formatRuntime(row.runtime);
  const poster = row.poster_path
    ? `https://image.tmdb.org/t/p/w185${row.poster_path}`
    : null;
  const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
  const fresh = isFresh(row.first_posted_at, nowMs);
  const budget = fmtMoney(row.budget);
  const planCumGb = planMode ? (cumBytes / 1_000_000_000).toFixed(1) : null;
  const badge = torrentBadge(
    row.torrent_status,
    row.latest_release_at,
    nowMs,
    row.torrent_count,
  );

  // Card chrome: subtle border, slight elevation on hover, a left-edge
  // accent rail for fresh/plan-skipped/A-tier states. The accent comes
  // from a vertical strip rather than the whole-row tint we had before —
  // calmer in a list of 80 cards.
  const accentClass = planMode
    ? !fits
      ? 'before:bg-gray-300'
      : ''
    : fresh
      ? 'before:bg-amber-400'
      : tier === 'A'
        ? 'before:bg-emerald-500'
        : tier === '?'
          ? 'before:bg-sky-400'
          : '';
  const dimmed = planMode && !fits ? 'opacity-60' : '';

  return (
    <Fragment>
      {cutoffHere ? (
        <li className="my-2 flex items-center justify-center rounded-md border border-dashed border-purple-300 bg-purple-50/60 px-3 py-2 text-xs font-semibold tracking-wide text-purple-700 uppercase">
          1 TB cutoff · everything below won&apos;t fit
        </li>
      ) : null}
      <li
        className={`relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-sm ${dimmed} before:absolute before:inset-y-0 before:left-0 before:w-1 ${accentClass}`}
      >
        <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
          {poster ? (
            <img
              src={poster}
              alt=""
              loading="lazy"
              className="h-28 w-20 flex-none rounded bg-slate-100 object-cover sm:h-36 sm:w-24"
            />
          ) : (
            <div className="h-32 w-22 flex-none rounded bg-slate-100 sm:h-36 sm:w-24" />
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top row: tier · score · plan-cum · badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:gap-2">
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${TIER_BADGE[tier]}`}
              >
                {tier}
              </span>
              <span className="font-mono text-slate-500">
                {score.toFixed(1)}
              </span>
              {planMode ? (
                <span
                  className={`font-mono ${fits ? 'text-purple-700' : 'text-slate-400'}`}
                >
                  {planCumGb} GB
                </span>
              ) : null}
              {studios.map((label) => (
                <span
                  key={label}
                  className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${prestigeCls(label)}`}
                >
                  {label}
                </span>
              ))}
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${badge.cls}`}
              >
                {badge.label}
              </span>
              {fresh ? (
                <span className="rounded-sm bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                  new
                </span>
              ) : null}
              {row.tmdb_status === 'not_found' ? (
                <span className="text-[11px] tracking-wide text-red-500 uppercase">
                  no tmdb match
                </span>
              ) : null}
            </div>

            {/* Title */}
            <h3 className="mt-1.5 text-base leading-snug font-semibold text-slate-900 sm:text-[17px]">
              <Link
                href={`https://www.imdb.com/title/${row.imdb_id}/`}
                target="_blank"
                className="hover:underline"
              >
                {title}
              </Link>
              {row.tmdb_year ? (
                <span className="ml-1.5 font-normal text-slate-400">
                  ({row.tmdb_year})
                </span>
              ) : null}
            </h3>

            {/* Meta line: genres · runtime · rating · budget · talent */}
            <div className="mt-1 text-[13px] leading-snug text-slate-500">
              {names.length ? names.join(', ') : '—'}
              {runtime ? ` · ${runtime}` : ''}
              {row.vote_average != null
                ? ` · ★ ${row.vote_average.toFixed(1)}${row.vote_count != null ? ` (${row.vote_count})` : ''}`
                : ''}
              {budget ? ` · ${budget} budget` : ''}
              {row.talent_score != null && row.talent_score > 0
                ? ` · talent ${row.talent_score.toFixed(1)}`
                : ''}
            </div>

            {/* People line */}
            {row.director || cast.length ? (
              <div className="mt-1.5 text-[13px] leading-snug text-slate-600">
                {row.director ? (
                  <div>
                    <span className="text-slate-400">Dir</span> {row.director}
                  </div>
                ) : null}
                {cast.length ? (
                  <div>
                    <span className="text-slate-400">With</span>{' '}
                    <span className="sm:hidden">
                      {cast.slice(0, 3).join(', ')}
                      {cast.length > 3 ? `, +${cast.length - 3}` : ''}
                    </span>
                    <span className="hidden sm:inline">{cast.join(', ')}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Push the magnet row to the bottom on tall cards */}
            <div className="flex-1" />

            {/* Magnet CTA row */}
            {row.best_info_hash ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] sm:text-[13px]">
                <a
                  href={magnetPath(row.best_info_hash, row.best_torrent_title)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset transition hover:bg-emerald-100"
                >
                  <span aria-hidden>↓</span> Magnet
                </a>
                <span className="text-slate-500">
                  {row.best_quality ? row.best_quality : ''}
                  {row.best_size_bytes
                    ? ` · ${fmtSize(row.best_size_bytes)}`
                    : ''}
                  {row.best_seeders != null ? ` · 👤 ${row.best_seeders}` : ''}
                  {row.best_source ? ` · ${row.best_source}` : ''}
                  {(row.torrent_count ?? 0) > 1
                    ? ` · +${(row.torrent_count ?? 0) - 1}`
                    : ''}
                </span>
              </div>
            ) : null}

            {/* Tiny footer line: imdb id · release count · raw filename */}
            <div className="mt-2 truncate text-[11px] text-slate-400">
              <Link
                href={`https://www.imdb.com/title/${row.imdb_id}/`}
                target="_blank"
                className="hover:underline"
              >
                {row.imdb_id}
              </Link>
              {' · '}
              {row.release_count} release{row.release_count === 1 ? '' : 's'}
              {row.latest_release_title ? ` · ${row.latest_release_title}` : ''}
            </div>
          </div>
        </div>
      </li>
    </Fragment>
  );
}
