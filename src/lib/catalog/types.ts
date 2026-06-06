/**
 * Storage budget for the {@link buildView} plan mode, in bytes (1 TB).
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
export type Tier = "A" | "B" | "C" | "?";

/**
 * Movie + everything the view layer needs to render it.
 *
 * Note: `cumBytes` and `fits` are populated by the plan-view loop and
 * are therefore mutable; everything else is immutable.
 *
 * @public
 */
export interface ScoredMovie {
  readonly row: MovieRow;
  readonly studios: readonly string[];
  readonly score: number;
  readonly tier: Tier;
  cumBytes: number;
  fits: boolean;
}

/** Aggregate stats for plan view. @public */
export interface PlanSummary {
  readonly fits: number;
  readonly skipped: number;
  readonly bytesFits: number;
}

/** End-to-end output of {@link ViewBuilder}. @public */
export interface ViewResult {
  readonly movies: readonly ScoredMovie[];
  /** Bayesian centroid used in scoring. */
  readonly C: number;
  /** Bayesian min-vote threshold used in scoring. */
  readonly M: number;
  /** Populated only when view='plan'. */
  readonly plan?: PlanSummary;
}

/** Options accepted by {@link ViewBuilder#build}. @public */
export interface ViewOptions {
  /** ISO 639-1 code or 'all'. */
  readonly lang: string;
  /** 'score' (default) or 'date'. */
  readonly sort: string;
  /** 'catalog' (default) or 'plan'. */
  readonly view: string;
}
