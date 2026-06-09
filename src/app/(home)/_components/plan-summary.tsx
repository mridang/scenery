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
    <section className="mb-4 rounded border border-purple-200 bg-purple-50/50 p-3">
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <div>
          <span className="font-semibold">{fits.toLocaleString()}</span> movies
          fit in 1 TB ·{' '}
          <span className="font-semibold">{usedGb.toFixed(1)} GB</span> used ·{' '}
          <span className="text-gray-600">{freeGb.toFixed(1)} GB headroom</span>
        </div>
        <div className="text-gray-500">
          {skipped.toLocaleString()} won&apos;t fit · budget{' '}
          {budgetGb.toFixed(0)} GB
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-purple-100">
        <div className="h-full bg-purple-500" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
