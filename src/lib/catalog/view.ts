import type { CatalogRepository } from './repository';
import { ScoringEngine } from './scoring';
import type { ScoredMovie, ViewOptions, ViewResult } from './types';
import { BUDGET_BYTES } from './types';

/**
 * Composes the catalog repository and the scoring engine into the
 * {@link ViewResult} the UI renders. Cleanly separates "what we want
 * to show" from "how we shape it on screen".
 *
 * @public
 */
export class ViewBuilder {
  public constructor(private readonly repo: CatalogRepository) {}

  /** Pure composition. Run a query, score, sort, plan-trim if needed. */
  public async build(opts: ViewOptions): Promise<ViewResult> {
    const rows = await this.repo.loadMovies(opts.lang);
    const C = ScoringEngine.computeCentroid(rows);
    const engine = new ScoringEngine(C);

    const scored: readonly ScoredMovie[] = rows.map((row) => {
      const studios = engine.prestigeStudios(row.production_companies);
      const hasPrestige = studios.length > 0;
      return {
        row,
        studios,
        score: engine.score(row, hasPrestige),
        tier: engine.tier(row, hasPrestige),
        cumBytes: 0,
        fits: true,
      };
    });

    const sorted =
      opts.sort === 'date'
        ? scored
        : scored.toSorted((a, b) => b.score - a.score);

    if (opts.view !== 'plan') {
      return { movies: sorted, C: engine.C, M: engine.M };
    }

    const withSize = sorted.filter((r) => (r.row.best_size_bytes ?? 0) > 0);
    const planned = withSize.reduce<readonly ScoredMovie[]>((acc, r) => {
      const cum = acc.at(-1)?.cumBytes ?? 0;
      const next = cum + (r.row.best_size_bytes ?? 0);
      return [...acc, { ...r, cumBytes: next, fits: next <= BUDGET_BYTES }];
    }, []);
    const plan = planned.reduce(
      (p, r) =>
        r.fits
          ? { ...p, fits: p.fits + 1, bytesFits: r.cumBytes }
          : { ...p, skipped: p.skipped + 1 },
      { fits: 0, skipped: 0, bytesFits: 0 },
    );
    return { movies: planned, C: engine.C, M: engine.M, plan };
  }
}
