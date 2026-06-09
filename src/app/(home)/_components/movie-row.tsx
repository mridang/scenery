import { Fragment } from 'react';
import Link from 'next/link';

import type { ScoredMovie } from '@/lib/catalog';
import { magnetPath } from '@/lib/magnet';

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
    row: m,
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
  const runtime = formatRuntime(m.runtime);
  const poster = m.poster_path
    ? `https://image.tmdb.org/t/p/w92${m.poster_path}`
    : null;
  const title = m.tmdb_title ?? m.latest_release_title ?? m.imdb_id;
  const fresh = isFresh(m.first_posted_at, nowMs);
  const budget = fmtMoney(m.budget);
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
    m.torrent_status,
    m.latest_release_at,
    nowMs,
    m.torrent_count,
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
              href={`https://www.imdb.com/title/${m.imdb_id}/`}
              target="_blank"
              className="truncate font-semibold hover:underline"
            >
              {title}
            </Link>
            {m.tmdb_year ? (
              <span className="text-gray-500">({m.tmdb_year})</span>
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
            {m.tmdb_status === 'not_found' ? (
              <span className="text-xs text-red-500 uppercase">
                no tmdb match
              </span>
            ) : null}
          </div>
          <div className="text-xs text-gray-500">
            {names.length ? names.join(', ') : '—'}
            {runtime ? ` · ${runtime}` : ''}
            {m.vote_average != null
              ? ` · ★ ${m.vote_average.toFixed(1)}${m.vote_count != null ? ` (${m.vote_count})` : ''}`
              : ''}
            {budget ? ` · ${budget} budget` : ''}
            {m.talent_score != null && m.talent_score > 0
              ? ` · talent ${m.talent_score.toFixed(1)}`
              : ''}
            {' · '}
            <Link
              href={`https://www.imdb.com/title/${m.imdb_id}/`}
              target="_blank"
              className="hover:underline"
            >
              {m.imdb_id}
            </Link>
            {' · '}
            {m.release_count} release{m.release_count === 1 ? '' : 's'}
          </div>
          {m.director || cast.length ? (
            <div className="text-xs text-gray-700">
              {m.director ? (
                <span>
                  <span className="text-gray-500">Dir:</span> {m.director}
                </span>
              ) : null}
              {m.director && cast.length ? (
                <span className="text-gray-400"> · </span>
              ) : null}
              {cast.length ? (
                <span>
                  <span className="text-gray-500">With:</span> {cast.join(', ')}
                </span>
              ) : null}
            </div>
          ) : null}
          {m.best_info_hash ? (
            <div className="text-xs text-emerald-700">
              <a
                href={magnetPath(m.best_info_hash, m.best_torrent_title)}
                className="font-medium hover:underline"
              >
                magnet ↗
              </a>
              {m.best_quality ? ` · ${m.best_quality}` : ''}
              {m.best_size_bytes ? ` · ${fmtSize(m.best_size_bytes)}` : ''}
              {m.best_seeders != null ? ` · 👤 ${m.best_seeders}` : ''}
              {m.best_source ? ` · ${m.best_source}` : ''}
              {(m.torrent_count ?? 0) > 1
                ? ` · +${(m.torrent_count ?? 0) - 1} more`
                : ''}
            </div>
          ) : null}
          {m.latest_release_title ? (
            <div className="truncate text-xs text-gray-400">
              {m.latest_release_title}
            </div>
          ) : null}
        </div>
      </li>
    </Fragment>
  );
}
