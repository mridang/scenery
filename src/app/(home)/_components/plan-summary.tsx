/** The 1 TB plan headline: how many movies fit, GB used, and a fill bar. */
export function PlanSummary({
  fits,
  skipped,
  bytesFits,
  budget,
}: {
  fits: number;
  skipped: number;
  bytesFits: number;
  budget: number;
}) {
  const pct = Math.min(100, (bytesFits / budget) * 100);
  const usedGb = bytesFits / 1_000_000_000;
  const budgetGb = budget / 1_000_000_000;
  const freeGb = Math.max(0, budgetGb - usedGb);
  return (
    <section className="mb-5 rounded-lg border border-purple-200 bg-purple-50/60 p-4">
      <div className="mb-3 flex flex-col gap-1 text-xs sm:flex-row sm:items-baseline sm:justify-between">
        <div className="text-slate-700">
          <span className="font-semibold tabular-nums">
            {fits.toLocaleString()}
          </span>{' '}
          movies fit in 1 TB ·{' '}
          <span className="font-semibold tabular-nums">
            {usedGb.toFixed(1)} GB
          </span>{' '}
          used ·{' '}
          <span className="text-slate-500 tabular-nums">
            {freeGb.toFixed(1)} GB headroom
          </span>
        </div>
        <div className="text-slate-500 tabular-nums">
          {skipped.toLocaleString()} won&apos;t fit · budget{' '}
          {budgetGb.toFixed(0)} GB
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-purple-100">
        <div
          className="h-full rounded-full bg-purple-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
