import { Fragment } from 'react';
import Link from 'next/link';

import type { ScoredMovie } from '../../../lib/catalog';
import { magnetPath } from '../../../lib/magnet';

import {
  TIER_BADGE,
  TIER_STYLE,
  prestigeCls,
  torrentBadge,
} from '../_lib/badges';
import { fmtMoney, fmtSize, formatRuntime, isFresh } from '../_lib/format';

/**
 * One movie in the list. In plan view, when this row is the first that
 * doesn't fit (the previous one did), a "1 TB cutoff" divider is rendered
 * above it.
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
    ? `https://image.tmdb.org/t/p/w92${row.poster_path}`
    : null;
  const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
  const fresh = isFresh(row.first_posted_at, nowMs);
  const budget = fmtMoney(row.budget);
  const planCumGb = planMode ? (cumBytes / 1_000_000_000).toFixed(1) : null;
  const tierClass = TIER_STYLE[tier];
  const freshClass = planMode
    ? !fits
      ? 'border-l-4 border-gray-300 bg-gray-50/60 opacity-60'
      : ''
    : fresh
      ? 'border-l-4 border-amber-400 bg-amber-50/60'
      : tierClass
        ? `border-l-4 ${tierClass}`
        : '';
  const badge = torrentBadge(
    row.torrent_status,
    row.latest_release_at,
    nowMs,
    row.torrent_count,
  );

  return (
    <Fragment>
      {cutoffHere ? (
        <li className="my-2 flex items-center gap-2 border-y border-dashed border-purple-500 bg-purple-50 px-2 py-2 text-xs font-semibold text-purple-700 uppercase">
          ── 1 TB cutoff ── everything below won&apos;t fit
        </li>
      ) : null}
      <li className={`flex items-start gap-2 px-2 py-3 sm:gap-3 ${freshClass}`}>
        {poster ? (
          <img
            src={poster}
            alt=""
            className="h-16 w-11 flex-none bg-gray-100 object-cover sm:h-20 sm:w-14"
          />
        ) : (
          <div className="h-20 w-14 flex-none bg-gray-100" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_BADGE[tier]}`}
            >
              {tier}
            </span>
            <span className="font-mono text-[11px] text-gray-500">
              {score.toFixed(1)}
            </span>
            {planMode ? (
              <span
                className={`font-mono text-[11px] ${fits ? 'text-purple-700' : 'text-gray-400'}`}
              >
                {planCumGb} GB
              </span>
            ) : null}
            <Link
              href={`https://www.imdb.com/title/${row.imdb_id}/`}
              target="_blank"
              className="truncate font-semibold hover:underline"
            >
              {title}
            </Link>
            {row.tmdb_year ? (
              <span className="text-gray-500">({row.tmdb_year})</span>
            ) : null}
            {studios.map((label) => (
              <span
                key={label}
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${prestigeCls(label)}`}
              >
                {label}
              </span>
            ))}
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}
            >
              {badge.label}
            </span>
            {fresh ? (
              <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                new
              </span>
            ) : null}
            {row.tmdb_status === 'not_found' ? (
              <span className="text-xs text-red-500 uppercase">
                no tmdb match
              </span>
            ) : null}
          </div>
          <div className="text-xs text-gray-500">
            {names.length ? names.join(', ') : '—'}
            {runtime ? ` · ${runtime}` : ''}
            {row.vote_average != null
              ? ` · ★ ${row.vote_average.toFixed(1)}${row.vote_count != null ? ` (${row.vote_count})` : ''}`
              : ''}
            {budget ? ` · ${budget} budget` : ''}
            {row.talent_score != null && row.talent_score > 0
              ? ` · talent ${row.talent_score.toFixed(1)}`
              : ''}
            {' · '}
            <Link
              href={`https://www.imdb.com/title/${row.imdb_id}/`}
              target="_blank"
              className="hover:underline"
            >
              {row.imdb_id}
            </Link>
            {' · '}
            {row.release_count} release{row.release_count === 1 ? '' : 's'}
          </div>
          {row.director || cast.length ? (
            <div className="text-xs text-gray-700">
              {row.director ? (
                <span>
                  <span className="text-gray-500">Dir:</span> {row.director}
                </span>
              ) : null}
              {row.director && cast.length ? (
                <span className="text-gray-400"> · </span>
              ) : null}
              {cast.length ? (
                <span>
                  <span className="text-gray-500">With:</span> {cast.join(', ')}
                </span>
              ) : null}
            </div>
          ) : null}
          {row.best_info_hash ? (
            <div className="text-xs text-emerald-700">
              <a
                href={magnetPath(row.best_info_hash, row.best_torrent_title)}
                className="font-medium hover:underline"
              >
                magnet ↗
              </a>
              {row.best_quality ? ` · ${row.best_quality}` : ''}
              {row.best_size_bytes ? ` · ${fmtSize(row.best_size_bytes)}` : ''}
              {row.best_seeders != null ? ` · 👤 ${row.best_seeders}` : ''}
              {row.best_source ? ` · ${row.best_source}` : ''}
              {(row.torrent_count ?? 0) > 1
                ? ` · +${(row.torrent_count ?? 0) - 1} more`
                : ''}
            </div>
          ) : null}
          {row.latest_release_title ? (
            <div className="truncate text-xs text-gray-400">
              {row.latest_release_title}
            </div>
          ) : null}
        </div>
      </li>
    </Fragment>
  );
}
