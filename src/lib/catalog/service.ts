import { CatalogRepository } from './repository';
import { labelsForPrestigeIds } from './prestige';
import type {
  CatalogReader,
  CatalogStats,
  LangCount,
  LastUpdate,
  PlanSummary,
  ScoredMovie,
  ViewOptions,
  ViewResult,
} from './types';

/**
 * The single entry point for every catalog read the UI performs. It
 * wraps the data layer ({@link CatalogReader}) so consumers — the home
 * page, the RSS feed and the health endpoint — never touch raw queries.
 * There is exactly one "catalog thing" the UI talks to.
 *
 * All ranking, ordering and budgeting now happen in SQL (see
 * {@link CatalogRepository.loadMovies}); this class only adapts the
 * scored rows into the {@link ScoredMovie} shape the views render —
 * mapping prestige-studio ids to labels and tallying the plan summary.
 *
 * Construct with {@link CatalogService.fromD1} in production. Unit tests
 * pass a stub {@link CatalogReader} straight to the constructor.
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
   * Resolve a view. The database does the work — scoring, the
   * `sort='date'` (recent-first) / `sort='score'` (top-ranked) strategy,
   * and, in plan view, the cumulative 1 TB budget. Here we only shape
   * the rows for rendering.
   */
  public async view(opts: ViewOptions): Promise<ViewResult> {
    const rows = await this.reader.loadMovies(opts.lang, opts.sort, opts.view);
    const isPlan = opts.view === 'plan';

    const movies: readonly ScoredMovie[] = rows.map((r) => ({
      row: r,
      studios: labelsForPrestigeIds(r.prestige_ids),
      score: r.score,
      tier: r.tier,
      cumBytes: isPlan ? (r.cum_size_bytes ?? 0) : 0,
      fits: isPlan ? r.fits === 1 : true,
    }));

    if (!isPlan) {
      return { movies };
    }

    // Tally the SQL-computed fits flags. The cumulative total is
    // monotonic, so the fitting rows form a prefix and bytesFits ends as
    // the running total of the last row that fit.
    const plan: PlanSummary = movies.reduce<PlanSummary>(
      (p, m) =>
        m.fits
          ? { fits: p.fits + 1, skipped: p.skipped, bytesFits: m.cumBytes }
          : { fits: p.fits, skipped: p.skipped + 1, bytesFits: p.bytesFits },
      { fits: 0, skipped: 0, bytesFits: 0 },
    );
    return { movies, plan };
  }
}
