import type { Database } from '@/domain/db/client';
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

/** Resolve a `tmdb_genre_ids` JSON array to genre display names. */
function genreNames(raw: string | null, lookup: Map<number, string>): string[] {
  if (raw === null) {
    return [];
  }
  try {
    const ids = JSON.parse(raw) as number[];
    return ids.map((id) => lookup.get(id) ?? `#${id}`);
  } catch {
    return [];
  }
}

/** Parse a `top_cast` JSON array to the list of billed names. */
function castNames(raw: string | null): string[] {
  if (raw === null) {
    return [];
  }
  try {
    const items = JSON.parse(raw) as { name?: string }[];
    return items.map((castMember) => castMember.name ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

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
 * Construct with {@link CatalogService.fromDatabase} in production. Unit tests
 * pass a stub {@link CatalogReader} straight to the constructor.
 *
 * @public
 */
export class CatalogService {
  public constructor(private readonly reader: CatalogReader) {}

  /** Production factory: bind the service to a live database. */
  public static fromDatabase(db: Database): CatalogService {
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
    const [rows, genreLookup] = await Promise.all([
      this.reader.loadMovies(opts.lang, opts.sort, opts.view),
      this.reader.loadGenres(),
    ]);
    const isPlan = opts.view === 'plan';

    const movies: readonly ScoredMovie[] = rows.map((scoredRow) => ({
      row: scoredRow,
      studios: labelsForPrestigeIds(scoredRow.prestige_ids),
      genres: genreNames(scoredRow.tmdb_genre_ids, genreLookup),
      cast: castNames(scoredRow.top_cast),
      score: scoredRow.score,
      tier: scoredRow.tier,
      // The SQL running total (in the requested sort order) — used by the
      // page's plan view and the feed's ?budgetGb= disk gate alike, so
      // the cumulative sum never has to be re-done in JS.
      cumBytes: scoredRow.cum_size_bytes ?? 0,
      fits: isPlan ? scoredRow.fits === 1 : true,
    }));

    if (!isPlan) {
      return { movies };
    }

    // Tally the SQL-computed fits flags. The cumulative total is
    // monotonic, so the fitting rows form a prefix and bytesFits ends as
    // the running total of the last row that fit.
    const plan: PlanSummary = movies.reduce<PlanSummary>(
      (summary, movie) =>
        movie.fits
          ? {
              fits: summary.fits + 1,
              skipped: summary.skipped,
              bytesFits: movie.cumBytes,
            }
          : {
              fits: summary.fits,
              skipped: summary.skipped + 1,
              bytesFits: summary.bytesFits,
            },
      { fits: 0, skipped: 0, bytesFits: 0 },
    );
    return { movies, plan };
  }
}
