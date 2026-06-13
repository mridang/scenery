import type { CatalogStats } from '../../../lib/catalog';

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border px-2 py-1 sm:py-2 ${highlight ? 'border-red-500 text-red-600' : ''}`}
    >
      <div className="text-sm font-semibold sm:text-base">{value}</div>
      <div className="text-[9px] text-gray-500 uppercase sm:text-[10px]">
        {label}
      </div>
    </div>
  );
}

/** The catalog counters strip (releases, movies, TMDB coverage, …). */
export function StatsGrid({ stats }: { stats: CatalogStats }) {
  return (
    <section className="mb-6 grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
      <Stat label="releases" value={stats.releases} />
      <Stat label="movies" value={stats.movies} />
      <Stat label="snapshots" value={stats.snapshots} />
      <Stat
        label="failed"
        value={stats.failed_attempts}
        highlight={stats.failed_attempts > 0}
      />
      <Stat label="tmdb ✓" value={stats.tmdb_found} />
      <Stat label="tmdb ✗" value={stats.tmdb_not_found} />
      <Stat
        label="pending"
        value={stats.tmdb_pending}
        highlight={stats.tmdb_pending > 0}
      />
    </section>
  );
}
