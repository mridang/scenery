import type { CatalogStats, LangCount, LastUpdate, MovieRow } from './types';

/**
 * Read-only access to the catalog tables. Every SQL query the UI
 * touches lives here, so consumers (page.tsx, feed.xml/route.ts,
 * Workflow status endpoints) never see raw SQL.
 *
 * @public
 */
export class CatalogRepository {
  public constructor(private readonly db: D1Database) {}

  /**
   * Load movies + their best-pick torrent, filtered by language code
   * (`'all'` skips the filter), capped at 500 rows.
   */
  public async loadMovies(lang: string): Promise<MovieRow[]> {
    const langClause = lang === 'all' ? '' : `WHERE t.original_language = ?`;
    const stmt = this.db.prepare(MOVIE_QUERY.replace('__LANG__', langClause));
    const res =
      lang === 'all'
        ? await stmt.all<MovieRow>()
        : await stmt.bind(lang).all<MovieRow>();
    return res.results ?? [];
  }

  public async loadLanguageCounts(): Promise<LangCount[]> {
    const res = await this.db
      .prepare(
        `SELECT COALESCE(t.original_language, '?') AS code, COUNT(*) AS count
           FROM movies m
           LEFT JOIN tmdb_movies t ON t.imdb_id = m.imdb_id
          GROUP BY code
          ORDER BY count DESC`,
      )
      .all<LangCount>();
    return res.results ?? [];
  }

  public async loadGenres(): Promise<Map<number, string>> {
    const res = await this.db
      .prepare(`SELECT id, name FROM tmdb_genres`)
      .all<{ id: number; name: string }>();
    return new Map((res.results ?? []).map((g) => [g.id, g.name]));
  }

  public async loadStats(): Promise<CatalogStats> {
    const r = await this.db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM releases)                                  AS releases,
           (SELECT COUNT(*) FROM movies)                                    AS movies,
           (SELECT COUNT(*) FROM page_snapshots)                            AS snapshots,
           (SELECT COUNT(*) FROM fetch_attempts WHERE status='failed')      AS failed_attempts,
           (SELECT COUNT(*) FROM tmdb_movies WHERE status='found')          AS tmdb_found,
           (SELECT COUNT(*) FROM tmdb_movies WHERE status='not_found')      AS tmdb_not_found,
           (SELECT COUNT(*) FROM movies m
              LEFT JOIN tmdb_movies t ON t.imdb_id = m.imdb_id
              WHERE t.imdb_id IS NULL)                                      AS tmdb_pending`,
      )
      .first<CatalogStats>();
    return (
      r ?? {
        releases: 0,
        movies: 0,
        snapshots: 0,
        failed_attempts: 0,
        tmdb_found: 0,
        tmdb_not_found: 0,
        tmdb_pending: 0,
      }
    );
  }

  public async loadLastUpdate(): Promise<LastUpdate> {
    const scrape = await this.db
      .prepare(
        `SELECT ps.fetched_at AS at, s.slug AS slug
           FROM page_snapshots ps
           JOIN sources s ON s.id = ps.source_id
          ORDER BY ps.fetched_at DESC LIMIT 1`,
      )
      .first<{ at: string; slug: string }>();
    const enrich = await this.db
      .prepare(`SELECT MAX(fetched_at) AS at FROM tmdb_movies`)
      .first<{ at: string | null }>();
    const torrents = await this.db
      .prepare(
        `SELECT searched_at AS at, provider AS provider FROM torrent_lookups
          ORDER BY searched_at DESC LIMIT 1`,
      )
      .first<{ at: string | null; provider: string | null }>();
    return {
      scrapeAt: scrape?.at ?? null,
      scrapeSource: scrape?.slug ?? null,
      enrichAt: enrich?.at ?? null,
      torrentsAt: torrents?.at ?? null,
      torrentsProvider: torrents?.provider ?? null,
    };
  }
}

// Big SQL is kept at module scope to avoid building it every call. The
// __LANG__ placeholder is substituted at runtime depending on whether a
// language filter is wanted.
const MOVIE_QUERY = `SELECT
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
        WHERE r.imdb_id = m.imdb_id)            AS first_posted_at
   FROM movies m
   LEFT JOIN tmdb_movies t ON t.imdb_id = m.imdb_id
   LEFT JOIN torrent_lookups tl ON tl.imdb_id = m.imdb_id
   __LANG__
   -- Order by FIRST appearance on the source (a re-listed/repacked post
   -- must not bump an older movie to the top), newest arrivals first.
   -- Source dates are day-granular, so break same-day ties by the post
   -- id (a monotonic WordPress id: higher = posted later that day) for a
   -- stable, posting-order-faithful result.
   ORDER BY (SELECT MIN(COALESCE(r.posted_at, r.first_seen_at))
               FROM releases r WHERE r.imdb_id = m.imdb_id) DESC,
            (SELECT MIN(CAST(r.external_id AS INTEGER))
               FROM releases r WHERE r.imdb_id = m.imdb_id) DESC
   LIMIT 500`;
