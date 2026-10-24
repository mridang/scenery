import type { ScoredMovie } from '@/domain/catalog';

import { posterUrl } from '../_lib/tmdb-image';
import { scoreColor } from '../_lib/movie-style';

/** Compact size formatter used by the plan rows. */
function fmtSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) {
    return '';
  }
  const gb = bytes / 1_000_000_000;
  return `${gb.toFixed(1)} GB`;
}

/**
 * The 1 TB Plan view: a sticky progress header showing how much of the
 * budget the selected titles fill, followed by a tight ranked list of
 * every movie that fits, in score order. Mirrors the mockup directly —
 * one row per movie, rank · score · poster · title · torrent · size.
 */
export function PlanView({
  movies,
  budgetBytes,
}: {
  movies: readonly ScoredMovie[];
  budgetBytes: number;
}) {
  const eligible = movies.filter((movie) => movie.fits);
  const used = eligible.reduce(
    (sum, movie) => sum + (movie.row.best_size_bytes ?? 0),
    0,
  );
  const usedGb = used / 1_000_000_000;
  const budgetGb = budgetBytes / 1_000_000_000;
  const pct = Math.min(100, (used / budgetBytes) * 100);

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-[980px] px-4 pt-[34px] pb-[60px] sm:px-7"
    >
      <div className="mb-6">
        <h1 className="m-0 mb-[7px] text-[27px] font-semibold tracking-[-0.02em]">
          1 TB download plan
        </h1>
        <p className="m-0 max-w-[560px] text-[13.5px] leading-normal text-[#a1a1aa]">
          Highest-scored releases with available torrents, packed greedily
          against a 1&nbsp;TB budget — your priority queue, ranked.
        </p>
      </div>

      <div className="sticky top-[118px] z-10 mb-[22px] rounded-[14px] border border-transparent bg-[#2a2a2e] px-5 py-[18px] shadow-[0_16px_38px_-22px_rgba(0,0,0,0.7)]">
        <div className="mb-3 flex items-end justify-between">
          <div className="font-mono text-[13px] text-[#c7c7cf]">
            <span className="text-[22px] font-semibold text-[#f3f3f6]">
              {usedGb.toFixed(0)} GB
            </span>{' '}
            <span className="text-[#8a8a94]">/ {budgetGb.toFixed(0)} GB</span>
          </div>
          <div className="font-mono text-[12px] text-[#8a8a94]">
            {eligible.length} titles · {pct.toFixed(0)}% of budget
          </div>
        </div>
        <div className="h-[9px] overflow-hidden rounded-[6px] bg-[#26262d]">
          <div
            className="h-full rounded-[6px] transition-[width] duration-500"
            style={{ width: `${pct}%`, background: 'var(--accent)' }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-px overflow-hidden rounded-[14px] border border-transparent bg-white/5">
        {eligible.map((movie, idx) => (
          <PlanRow
            key={movie.row.imdb_id}
            movie={movie}
            rank={idx + 1}
            cumGb={movie.cumBytes / 1_000_000_000}
          />
        ))}
      </div>
    </main>
  );
}

function PlanRow({
  movie,
  rank,
  cumGb,
}: {
  movie: ScoredMovie;
  rank: number;
  cumGb: number;
}) {
  const { row, score, tier } = movie;
  const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
  // Plan rows have a 34 CSS-px thumb — w185 keeps it sharp on 3× phones
  // and 2× desktops (the next step up from the previous w92).
  const poster = posterUrl(row.poster_path, 'w185');
  const sColor = scoreColor(score, tier);
  const torrentLine = [
    row.best_quality,
    row.best_seeders !== null ? `${row.best_seeders} peers` : null,
    row.best_source,
  ]
    .filter(Boolean)
    .join('  ·  ');
  return (
    <a
      href={`https://www.imdb.com/title/${row.imdb_id}/`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 bg-[#232329] px-[18px] py-[13px] text-inherit no-underline transition-colors hover:bg-[#2f2f36]"
    >
      <span className="w-[26px] flex-none text-right font-mono text-[13px] text-[#6e6e78]">
        {rank}
      </span>
      <span
        className="w-[36px] flex-none font-mono text-[14px] font-semibold"
        style={{ color: sColor }}
      >
        {Math.round(score)}
      </span>
      {poster ? (
        <img
          src={poster}
          loading="lazy"
          alt=""
          className="h-[51px] w-[34px] flex-none rounded bg-[#1c1c22] object-cover"
        />
      ) : (
        <div className="h-[51px] w-[34px] flex-none rounded bg-[#1c1c22]" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[14.5px] font-semibold">{title}</span>
          {row.tmdb_year !== null ? (
            <span className="flex-none font-mono text-[11px] text-[#8a8a94]">
              {row.tmdb_year}
            </span>
          ) : null}
        </div>
        {torrentLine ? (
          <div className="truncate font-mono text-[10.5px] text-[#8a8a94]">
            {torrentLine}
          </div>
        ) : null}
      </div>
      <div className="flex-none text-right font-mono">
        <div className="text-[13px] text-[#c7c7cf]">
          {fmtSize(row.best_size_bytes)}
        </div>
        <div className="text-[10px] text-[#6e6e78]">
          Σ {cumGb.toFixed(1)} GB
        </div>
      </div>
    </a>
  );
}
