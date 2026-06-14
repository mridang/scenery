import type { CatalogStats } from '@/lib/catalog';

function Stat({
  label,
  value,
  highlight,
  hideOnMobile,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  hideOnMobile?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white px-3 py-2 ${
        hideOnMobile ? 'hidden sm:block' : ''
      } ${highlight ? 'border-red-300 text-red-600' : ''}`}
    >
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-[10px] font-medium tracking-wider text-slate-400 uppercase">
        {label}
      </div>
    </div>
  );
}

/**
 * The catalog counters strip. On mobile we show just the four headline
 * stats (releases / movies / snapshots / TMDB ✓) in a 4-col grid with
 * legible numbers; the diagnostic counters (failed / tmdb-x / pending)
 * are hidden until the wider sm: layout.
 */
export function StatsGrid({ stats }: { stats: CatalogStats }) {
  return (
    <section className="mb-5 grid grid-cols-4 gap-2 text-center sm:mb-6 sm:grid-cols-7">
      <Stat label="releases" value={stats.releases} />
      <Stat label="movies" value={stats.movies} />
      <Stat label="snapshots" value={stats.snapshots} />
      <Stat label="tmdb ✓" value={stats.tmdb_found} />
      <Stat
        hideOnMobile
        label="failed"
        value={stats.failed_attempts}
        highlight={stats.failed_attempts > 0}
      />
      <Stat hideOnMobile label="tmdb ✗" value={stats.tmdb_not_found} />
      <Stat
        hideOnMobile
        label="pending"
        value={stats.tmdb_pending}
        highlight={stats.tmdb_pending > 0}
      />
    </section>
  );
}
