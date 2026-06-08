/**
 * Storage budget for {@link CatalogService} plan view, in bytes (1 TB).
 *
 * @public
 */
export const BUDGET_BYTES = 1_000_000_000_000;

/**
 * Wide row joining `movies`, `tmdb_movies` and `torrent_lookups`. Powers
 * both the HTML view and the RSS feed.
 *
 * @public
 */
export interface MovieRow {
  readonly imdb_id: string;
  readonly tmdb_id: number | null;
  readonly tmdb_status: string | null;
  readonly tmdb_title: string | null;
  readonly tmdb_year: number | null;
  readonly release_date: string | null;
  readonly tmdb_genre_ids: string | null;
  readonly poster_path: string | null;
  readonly vote_average: number | null;
  readonly vote_count: number | null;
  readonly popularity: number | null;
  readonly runtime: number | null;
  readonly budget: number | null;
  readonly talent_score: number | null;
  readonly original_language: string | null;
  readonly director: string | null;
  readonly top_cast: string | null;
  readonly production_companies: string | null;
  readonly first_seen_at: string;
  readonly release_count: number;
  readonly latest_release_title: string | null;
  readonly latest_release_at: string | null;
  /** Earliest time this movie appeared on any source — its "actual" date. */
  readonly first_posted_at: string | null;
  readonly torrent_status: string | null;
  readonly torrent_count: number | null;
  readonly best_info_hash: string | null;
  readonly best_torrent_title: string | null;
  readonly best_source: string | null;
  readonly best_size_bytes: number | null;
  readonly best_seeders: number | null;
  readonly best_quality: string | null;
}

/** Per-language tally. @public */
export interface LangCount {
  readonly code: string;
  readonly count: number;
}

/** Counters surfaced on the home page header. @public */
export interface CatalogStats {
  readonly releases: number;
  readonly movies: number;
  readonly snapshots: number;
  readonly failed_attempts: number;
  readonly tmdb_found: number;
  readonly tmdb_not_found: number;
  readonly tmdb_pending: number;
}

/** Most-recent activity timestamps. @public */
export interface LastUpdate {
  readonly scrapeAt: string | null;
  readonly scrapeSource: string | null;
  readonly enrichAt: string | null;
  readonly torrentsAt: string | null;
  readonly torrentsProvider: string | null;
}

/** Tier badge a movie is assigned. @public */
export type Tier = 'A' | 'B' | 'C' | '?';

/**
 * Movie + everything the view layer needs to render it.
 *
 * `cumBytes` and `fits` are populated by {@link CatalogService} in plan
 * view (zero / `true` otherwise).
 *
 * @public
 */
export interface ScoredMovie {
  readonly row: MovieRow;
  /** Prestige-studio display labels (resolved from the matched ids). */
  readonly studios: readonly string[];
  /** Genre display names (resolved from `tmdb_genre_ids`). */
  readonly genres: readonly string[];
  /** Top-billed cast names (parsed from `top_cast`). */
  readonly cast: readonly string[];
  readonly score: number;
  readonly tier: Tier;
  readonly cumBytes: number;
  readonly fits: boolean;
}

/** Aggregate stats for plan view. @public */
export interface PlanSummary {
  readonly fits: number;
  readonly skipped: number;
  readonly bytesFits: number;
}

/** End-to-end output of {@link CatalogService#view}. @public */
export interface ViewResult {
  readonly movies: readonly ScoredMovie[];
  /** Populated only when view='plan'. */
  readonly plan?: PlanSummary;
}

/**
 * A {@link MovieRow} with the scoring columns the catalog query computes
 * in SQL: the composite {@link CatalogService#view | score}, the
 * download-priority {@link Tier}, the matched prestige-studio ids (a
 * `json_group_array` string), and — in plan view — the running storage
 * total and whether the row fits the 1 TB budget.
 *
 * @public
 */
export interface ScoredRow extends MovieRow {
  readonly score: number;
  readonly tier: Tier;
  /** JSON array of matched prestige-studio ids, e.g. `"[210099]"`. */
  readonly prestige_ids: string | null;
  /** Cumulative bytes up to and including this row (plan view). */
  readonly cum_size_bytes: number | null;
  /** 1 when the cumulative total is within the budget, else 0. */
  readonly fits: number;
}

/** Options accepted by {@link CatalogService#view}. @public */
export interface ViewOptions {
  /** ISO 639-1 code or 'all'. */
  readonly lang: string;
  /** 'score' (default) or 'date'. */
  readonly sort: string;
  /** 'catalog' (default) or 'plan'. */
  readonly view: string;
}

/**
 * The read surface the catalog UI depends on. {@link CatalogRepository}
 * is the production implementation (backed by D1); unit tests supply a
 * lightweight stub so {@link CatalogService} can be exercised without a
 * database. Depending on this interface — rather than the concrete
 * repository — is what keeps the service loosely coupled and testable.
 *
 * @public
 */
export interface CatalogReader {
  loadMovies(lang: string, sort: string, view: string): Promise<ScoredRow[]>;
  loadGenres(): Promise<Map<number, string>>;
  loadStats(): Promise<CatalogStats>;
  loadLanguageCounts(): Promise<LangCount[]>;
  loadLastUpdate(): Promise<LastUpdate>;
}
