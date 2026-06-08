import { CatalogRepository } from './repository';
import { ScoringEngine } from './scoring';
import type {
  CatalogReader,
  CatalogStats,
  LangCount,
  LastUpdate,
  MovieRow,
  ScoredMovie,
  ViewOptions,
  ViewResult,
} from './types';
import { BUDGET_BYTES } from './types';

/**
 * The single entry point for every catalog read the UI performs. It
 * wraps the data layer ({@link CatalogReader}) and the
 * {@link ScoringEngine} so consumers — the home page, the RSS feed and
 * the health endpoint — never touch raw queries or scoring math
 * directly. There is exactly one "catalog thing" the UI talks to.
 *
 * Construct with {@link CatalogService.fromD1} in production. Unit tests
 * pass a stub {@link CatalogReader} straight to the constructor, so the
 * scoring / sorting / plan-trimming composition can be verified without
 * a database.
 *
 * @public
 */
export class CatalogService {
  public constructor(private readonly reader: CatalogReader) {}

  /** Production factory: bind the service to a live D1 database. */
  public static fromD1(db: D1Database): CatalogService {
    return new CatalogService(new CatalogRepository(db));
  }

  /** Header counters (movies, releases, TMDB coverage, …). */
  public stats(): Promise<CatalogStats> {
    return this.reader.loadStats();
  }

  /** TMDB genre id → name lookup. */
  public genres(): Promise<Map<number, string>> {
    return this.reader.loadGenres();
  }

  /** Per-language movie tallies for the language filter. */
  public languageCounts(): Promise<LangCount[]> {
    return this.reader.loadLanguageCounts();
  }

  /** Most-recent scrape / enrich / torrent activity timestamps. */
  public lastUpdate(): Promise<LastUpdate> {
    return this.reader.loadLastUpdate();
  }

  /**
   * Resolve a view by selection strategy:
   *
   * - `sort='date'` — most-recently-posted first (the DB already orders
   *   rows by first appearance on the source).
   * - `sort='score'` — top-ranked first, using the Bayesian-weighted
   *   {@link ScoringEngine} score.
   * - `view='plan'` — additionally walk the result in order and tag each
   *   movie with its cumulative byte cost against the 1 TB budget.
   */
  public async view(opts: ViewOptions): Promise<ViewResult> {
    const rows = await this.reader.loadMovies(opts.lang);
    return CatalogService.compose(rows, opts);
  }

  /**
   * Pure composition: score every row, sort by the requested strategy
   * and, in plan view, trim to the storage budget. Side-effect free, so
   * it is unit-tested directly against fixture rows.
   */
  private static compose(rows: MovieRow[], opts: ViewOptions): ViewResult {
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
