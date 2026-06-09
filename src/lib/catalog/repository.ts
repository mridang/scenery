import { count, desc, eq, isNull, max, sql, type SQL } from 'drizzle-orm';

import {
  createDatabase,
  type Database,
  fetch_attempts,
  movies,
  page_snapshots,
  releases,
  sources,
  tmdb_genres,
  tmdb_movies,
  torrent_lookups,
} from '../db';

import { PRESTIGE_IDS } from './prestige';
import type { CatalogStats, LangCount, LastUpdate, ScoredRow } from './types';
import { BUDGET_BYTES } from './types';

/** Bayesian minimum-vote threshold (M) used to weight ratings. */
const VOTE_PRIOR = 50;
/** Half-life of the recency boost, in days. */
const RECENCY_HALF_LIFE_DAYS = 180;
/** Maximum points the recency boost can contribute. */
const RECENCY_MAX_PTS = 20;

/**
 * Read-only access to the catalog tables. Every SQL query the UI
 * touches lives here, so consumers (page.tsx, feed.xml/route.ts,
 * Workflow status endpoints) never see raw SQL.
 *
 * @public
 */
export class CatalogRepository {
  private readonly db: Database;

  public constructor(d1: D1Database) {
    this.db = createDatabase(d1);
  }

  /**
   * Load movies for a view, fully scored and ordered in SQL.
   *
   * Everything the old in-memory pass did now happens in the database:
   * the Bayesian-weighted composite {@link ScoredRow.score | score}
   * (D1's SQLite authorises `log`, `ln` and `exp`, so the formula ports
   * verbatim), the download {@link ScoredRow.tier | tier}, the matched
   * prestige-studio ids, and — in plan view — the running storage total
   * (a `SUM(...) OVER (...)` window) plus a 1 TB
   * {@link ScoredRow.fits | fits} flag.
   *
   * - `sort='date'` → most-recently-posted first (the default).
   * - `sort='score'` → highest composite score first.
   * - `view='plan'` → restrict to rows with a measured torrent size and
   *   carry the cumulative byte cost.
   *
   * Capped at 500 rows. Language `'all'` skips the language filter.
   */
  public async loadMovies(
    lang: string,
    sort: string,
    view: string,
  ): Promise<ScoredRow[]> {
    const langClause =
      lang === 'all' ? sql`` : sql`WHERE t.original_language = ${lang}`;
    // Integer constants, inlined as raw SQL text (never user input).
    const M = sql.raw(String(VOTE_PRIOR));
    const halfLife = sql.raw(String(RECENCY_HALF_LIFE_DAYS));
    const maxPts = sql.raw(String(RECENCY_MAX_PTS));
    const budget = sql.raw(String(BUDGET_BYTES));
    const prestigeIds = sql.raw(PRESTIGE_IDS.join(', '));

    // True when the movie lists at least one recognised prestige studio.
    const hasPrestige = sql`(b.production_companies IS NOT NULL AND EXISTS (
      SELECT 1 FROM json_each(b.production_companies) je
       WHERE CAST(json_extract(je.value, '$.id') AS INTEGER) IN (${prestigeIds})))`;

    // Bayesian-weighted rating (no confidence factor); NULL when unrated.
    const weighted = sql`(CASE
        WHEN b.vote_average IS NULL OR b.vote_count IS NULL THEN NULL
        ELSE (b.vote_count * 1.0 / (b.vote_count + ${M}.0)) * b.vote_average
             + (${M}.0 / (b.vote_count + ${M}.0)) * (SELECT c FROM centroid)
      END)`;

    // The composite score — a verbatim port of the old ScoringEngine.
    const scoreExpr = sql`(CASE
        WHEN b.tmdb_status != 'found' OR b.tmdb_status IS NULL THEN 0.0
        ELSE (
          ((COALESCE(b.vote_count, 0) * 1.0 / (COALESCE(b.vote_count, 0) + ${M}.0)) * COALESCE(b.vote_average, 0)
            + (${M}.0 / (COALESCE(b.vote_count, 0) + ${M}.0)) * (SELECT c FROM centroid))
            * 5 * MIN(1.0, log(COALESCE(b.vote_count, 0) + 1) / 2.0)
          + MIN(COALESCE(b.talent_score, 0), 8.0) * 4
          + (CASE WHEN COALESCE(b.budget, 0) / 1000000.0 > 0
                  THEN log(COALESCE(b.budget, 0) / 1000000.0 + 1) * 8 ELSE 0 END)
          + (CASE WHEN ${hasPrestige} THEN 10 ELSE 0 END)
          + (CASE
               WHEN b.first_posted_at IS NULL OR julianday(b.first_posted_at) IS NULL THEN 0
               WHEN (julianday('now') - julianday(b.first_posted_at)) <= 0 THEN ${maxPts}.0
               ELSE ${maxPts}.0 * exp(-(ln(2.0) * (julianday('now') - julianday(b.first_posted_at))) / ${halfLife}.0)
             END)
        )
      END)`;

    // Download-priority tier — a verbatim port of ScoringEngine.tier.
    const tierExpr = sql`(CASE
        WHEN b.tmdb_status != 'found' OR b.tmdb_status IS NULL THEN '?'
        WHEN ${hasPrestige} THEN 'A'
        WHEN COALESCE(b.budget, 0) >= 30000000 THEN 'A'
        WHEN COALESCE(b.talent_score, 0) >= 5.5 THEN 'A'
        WHEN ${weighted} IS NOT NULL AND ${weighted} >= 6.5 AND COALESCE(b.vote_count, 0) >= 100 THEN 'A'
        WHEN COALESCE(b.vote_count, 0) < 5 AND COALESCE(b.talent_score, 0) < 1 AND COALESCE(b.budget, 0) = 0 THEN '?'
        WHEN ${weighted} IS NOT NULL AND ${weighted} < 5.0 AND COALESCE(b.vote_count, 0) >= 30
             AND COALESCE(b.talent_score, 0) < 2 AND COALESCE(b.budget, 0) < 5000000 THEN 'C'
        ELSE 'B'
      END)`;

    // The matched prestige-studio ids, for the UI to map back to labels.
    const prestigeIdsExpr = sql`(CASE WHEN b.production_companies IS NULL THEN NULL ELSE (
        SELECT json_group_array(DISTINCT CAST(json_extract(je.value, '$.id') AS INTEGER))
          FROM json_each(b.production_companies) je
         WHERE CAST(json_extract(je.value, '$.id') AS INTEGER) IN (${prestigeIds})) END)`;

    // Selection strategy: recent-first (default) or highest score first.
    const orderExpr: SQL =
      sort === 'score'
        ? sql`score DESC`
        : sql`first_posted_at DESC, first_post_id DESC`;
    // Plan view budgets disk space, so only sized rows participate.
    const planWhere = view === 'plan' ? sql`WHERE best_size_bytes > 0` : sql``;

    const rows = await this.db.all<ScoredRow>(sql`
   WITH base AS (
     SELECT
     m.imdb_id                                  AS imdb_id,
     t.tmdb_id                                  AS tmdb_id,
     t.status                                   AS tmdb_status,
     t.title                                    AS tmdb_title,
     t.release_year                             AS tmdb_year,
     t.release_date                             AS release_date,
     t.genre_ids                                AS tmdb_genre_ids,
     t.poster_path                              AS poster_path,
     t.vote_average                             AS vote_average,
     t.vote_count                               AS vote_count,
     t.popularity                               AS popularity,
     t.runtime                                  AS runtime,
     t.budget                                   AS budget,
     t.talent_score                             AS talent_score,
     t.original_language                        AS original_language,
     t.director                                 AS director,
     t.top_cast                                 AS top_cast,
     t.production_companies                     AS production_companies,
     m.first_seen_at                            AS first_seen_at,
     tl.status                                  AS torrent_status,
     (SELECT COUNT(*) FROM torrents tr
        WHERE tr.imdb_id = m.imdb_id)           AS torrent_count,
     (SELECT info_hash FROM torrents tr
        WHERE tr.imdb_id = m.imdb_id
        ORDER BY (CASE WHEN size_bytes BETWEEN 3000000000 AND 7000000000 THEN 0
                      WHEN size_bytes BETWEEN 2000000000 AND 10000000000 THEN 1
                      ELSE 2 END),
                 -COALESCE(seeders, 0),
                 ABS(COALESCE(size_bytes, 0) - 5000000000)
        LIMIT 1)                                AS best_info_hash,
     (SELECT title FROM torrents tr
        WHERE tr.imdb_id = m.imdb_id
        ORDER BY (CASE WHEN size_bytes BETWEEN 3000000000 AND 7000000000 THEN 0
                      WHEN size_bytes BETWEEN 2000000000 AND 10000000000 THEN 1
                      ELSE 2 END),
                 -COALESCE(seeders, 0),
                 ABS(COALESCE(size_bytes, 0) - 5000000000)
        LIMIT 1)                                AS best_torrent_title,
     (SELECT source FROM torrents tr
        WHERE tr.imdb_id = m.imdb_id
        ORDER BY (CASE WHEN size_bytes BETWEEN 3000000000 AND 7000000000 THEN 0
                      WHEN size_bytes BETWEEN 2000000000 AND 10000000000 THEN 1
                      ELSE 2 END),
                 -COALESCE(seeders, 0),
                 ABS(COALESCE(size_bytes, 0) - 5000000000)
        LIMIT 1)                                AS best_source,
     (SELECT size_bytes FROM torrents tr
        WHERE tr.imdb_id = m.imdb_id
        ORDER BY (CASE WHEN size_bytes BETWEEN 3000000000 AND 7000000000 THEN 0
                      WHEN size_bytes BETWEEN 2000000000 AND 10000000000 THEN 1
                      ELSE 2 END),
                 -COALESCE(seeders, 0),
                 ABS(COALESCE(size_bytes, 0) - 5000000000)
        LIMIT 1)                                AS best_size_bytes,
     (SELECT seeders FROM torrents tr
        WHERE tr.imdb_id = m.imdb_id
        ORDER BY (CASE WHEN size_bytes BETWEEN 3000000000 AND 7000000000 THEN 0
                      WHEN size_bytes BETWEEN 2000000000 AND 10000000000 THEN 1
                      ELSE 2 END),
                 -COALESCE(seeders, 0),
                 ABS(COALESCE(size_bytes, 0) - 5000000000)
        LIMIT 1)                                AS best_seeders,
     (SELECT quality FROM torrents tr
        WHERE tr.imdb_id = m.imdb_id
        ORDER BY (CASE WHEN size_bytes BETWEEN 3000000000 AND 7000000000 THEN 0
                      WHEN size_bytes BETWEEN 2000000000 AND 10000000000 THEN 1
                      ELSE 2 END),
                 -COALESCE(seeders, 0),
                 ABS(COALESCE(size_bytes, 0) - 5000000000)
        LIMIT 1)                                AS best_quality,
     (SELECT COUNT(*) FROM releases r
        WHERE r.imdb_id = m.imdb_id)            AS release_count,
     (SELECT r.title FROM releases r
        WHERE r.imdb_id = m.imdb_id
        ORDER BY COALESCE(r.posted_at, r.first_seen_at) DESC
        LIMIT 1)                                AS latest_release_title,
     (SELECT COALESCE(r.posted_at, r.first_seen_at) FROM releases r
        WHERE r.imdb_id = m.imdb_id
        ORDER BY COALESCE(r.posted_at, r.first_seen_at) DESC
        LIMIT 1)                                AS latest_release_at,
     (SELECT MIN(COALESCE(r.posted_at, r.first_seen_at)) FROM releases r
        WHERE r.imdb_id = m.imdb_id)            AS first_posted_at,
     -- Monotonic WordPress post id of the first appearance, used only to
     -- break same-day ties so recent-first ordering stays stable.
     (SELECT MIN(CAST(r.external_id AS INTEGER)) FROM releases r
        WHERE r.imdb_id = m.imdb_id)            AS first_post_id
   FROM movies m
   LEFT JOIN tmdb_movies t ON t.imdb_id = m.imdb_id
   LEFT JOIN torrent_lookups tl ON tl.imdb_id = m.imdb_id
   ${langClause}
   ),
   centroid AS (
     SELECT COALESCE(AVG(vote_average), 6.0) AS c
       FROM base
      WHERE vote_average IS NOT NULL AND vote_count >= 5
   ),
   scored AS (
     SELECT b.*, ${scoreExpr} AS score, ${tierExpr} AS tier,
            ${prestigeIdsExpr} AS prestige_ids
       FROM base b
   ),
   windowed AS (
     SELECT scored.*,
            SUM(COALESCE(best_size_bytes, 0)) OVER (
              ORDER BY ${orderExpr}
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS cum_size_bytes
       FROM scored
       ${planWhere}
   )
   SELECT windowed.*,
          CASE WHEN cum_size_bytes <= ${budget} THEN 1 ELSE 0 END AS fits
     FROM windowed
    ORDER BY ${orderExpr}
    LIMIT 500`);
    return rows;
  }

  public async loadLanguageCounts(): Promise<LangCount[]> {
    const code = sql<string>`COALESCE(${tmdb_movies.original_language}, '?')`;
    const rows = await this.db
      .select({ code, count: count() })
      .from(movies)
      .leftJoin(tmdb_movies, eq(tmdb_movies.imdb_id, movies.imdb_id))
      .groupBy(code)
      .orderBy(desc(count()));
    return rows.map((row) => ({ code: row.code, count: Number(row.count) }));
  }

  public async loadGenres(): Promise<Map<number, string>> {
    const rows = await this.db
      .select({ id: tmdb_genres.id, name: tmdb_genres.name })
      .from(tmdb_genres);
    return new Map(rows.map((genre) => [genre.id, genre.name]));
  }

  public async loadStats(): Promise<CatalogStats> {
    const scalar = async (query: Promise<{ n: number }[]>): Promise<number> => {
      const [row] = await query;
      return Number(row?.n ?? 0);
    };
    const [
      releaseCount,
      movieCount,
      snapshotCount,
      failedAttempts,
      tmdbFound,
      tmdbNotFound,
      tmdbPending,
    ] = await Promise.all([
      scalar(this.db.select({ n: count() }).from(releases)),
      scalar(this.db.select({ n: count() }).from(movies)),
      scalar(this.db.select({ n: count() }).from(page_snapshots)),
      scalar(
        this.db
          .select({ n: count() })
          .from(fetch_attempts)
          .where(eq(fetch_attempts.status, 'failed')),
      ),
      scalar(
        this.db
          .select({ n: count() })
          .from(tmdb_movies)
          .where(eq(tmdb_movies.status, 'found')),
      ),
      scalar(
        this.db
          .select({ n: count() })
          .from(tmdb_movies)
          .where(eq(tmdb_movies.status, 'not_found')),
      ),
      scalar(
        this.db
          .select({ n: count() })
          .from(movies)
          .leftJoin(tmdb_movies, eq(tmdb_movies.imdb_id, movies.imdb_id))
          .where(isNull(tmdb_movies.imdb_id)),
      ),
    ]);
    return {
      releases: releaseCount,
      movies: movieCount,
      snapshots: snapshotCount,
      failed_attempts: failedAttempts,
      tmdb_found: tmdbFound,
      tmdb_not_found: tmdbNotFound,
      tmdb_pending: tmdbPending,
    };
  }

  public async loadLastUpdate(): Promise<LastUpdate> {
    const [scrape] = await this.db
      .select({ at: page_snapshots.fetched_at, slug: sources.slug })
      .from(page_snapshots)
      .innerJoin(sources, eq(sources.id, page_snapshots.source_id))
      .orderBy(desc(page_snapshots.fetched_at))
      .limit(1);
    const [enrich] = await this.db
      .select({ at: max(tmdb_movies.fetched_at) })
      .from(tmdb_movies);
    const [torrents] = await this.db
      .select({
        at: torrent_lookups.searched_at,
        provider: torrent_lookups.provider,
      })
      .from(torrent_lookups)
      .orderBy(desc(torrent_lookups.searched_at))
      .limit(1);
    return {
      scrapeAt: scrape?.at ?? null,
      scrapeSource: scrape?.slug ?? null,
      enrichAt: enrich?.at ?? null,
      torrentsAt: torrents?.at ?? null,
      torrentsProvider: torrents?.provider ?? null,
    };
  }
}
