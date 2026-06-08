import type {
  TmdbCastEntry,
  TmdbCrewEntry,
  TmdbFindMovie,
  TmdbGenre,
  TmdbMovieResponse,
  TmdbPersonResponse,
} from './types';

/**
 * Database access for TMDB enrichment. The enricher orchestrates calls
 * against this class; the underlying schema is invisible to it.
 *
 * @public
 */
export class TmdbRepository {
  public constructor(private readonly db: D1Database) {}

  /** Number of rows currently in {@link tmdb_genres}. */
  public async countGenres(): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM tmdb_genres`)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  /** Upsert one TMDB genre. */
  public async upsertGenre(genre: TmdbGenre): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO tmdb_genres (id, name) VALUES (?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
      )
      .bind(genre.id, genre.name)
      .run();
  }

  /**
   * Imdb ids that still need a /find lookup: either no tmdb_movies row
   * yet, or a prior attempt that errored (e.g. hit the per-invocation
   * subrequest cap). 'not_found' rows are intentionally excluded — those
   * are a settled verdict, not a transient failure.
   */
  public async pendingMovieIds(limit: number): Promise<string[]> {
    const res = await this.db
      .prepare(
        `SELECT m.imdb_id
           FROM movies m
           LEFT JOIN tmdb_movies t ON t.imdb_id = m.imdb_id
          WHERE t.imdb_id IS NULL OR t.status = 'error'
          LIMIT ?`,
      )
      .bind(limit)
      .all<{ imdb_id: string }>();
    return (res.results ?? []).map((r) => r.imdb_id);
  }

  /** Imdb ids already found but missing credit data. */
  public async pendingCreditIds(
    limit: number,
  ): Promise<{ imdb_id: string; tmdb_id: number }[]> {
    const res = await this.db
      .prepare(
        `SELECT imdb_id, tmdb_id FROM tmdb_movies
          WHERE status = 'found'
            AND tmdb_id IS NOT NULL
            AND credits_fetched_at IS NULL
          LIMIT ?`,
      )
      .bind(limit)
      .all<{ imdb_id: string; tmdb_id: number }>();
    return res.results ?? [];
  }

  /** Persist an HTTP error against a movie's tmdb_movies row. */
  public async recordMovieError(
    imdbId: string,
    raw: string,
    errorMessage: string,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO tmdb_movies (imdb_id, status, raw_response, fetched_at, error)
              VALUES (?, 'error', ?, ?, ?)
            ON CONFLICT(imdb_id) DO UPDATE SET
              status = excluded.status,
              raw_response = excluded.raw_response,
              fetched_at = excluded.fetched_at,
              error = excluded.error`,
      )
      .bind(imdbId, raw, now, errorMessage)
      .run();
  }

  /** Persist a 'not_found' verdict against a movie's tmdb_movies row. */
  public async recordMovieNotFound(
    imdbId: string,
    raw: string,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO tmdb_movies (imdb_id, status, raw_response, fetched_at)
              VALUES (?, 'not_found', ?, ?)
            ON CONFLICT(imdb_id) DO UPDATE SET
              status = excluded.status,
              raw_response = excluded.raw_response,
              fetched_at = excluded.fetched_at`,
      )
      .bind(imdbId, raw, now)
      .run();
  }

  /** Persist a successful /find lookup. */
  public async upsertFoundMovie(
    imdbId: string,
    movie: TmdbFindMovie,
    raw: string,
    now: string,
  ): Promise<void> {
    const year =
      movie.release_date !== undefined && /^\d{4}/.test(movie.release_date)
        ? Number(movie.release_date.slice(0, 4))
        : null;
    await this.db
      .prepare(
        `INSERT INTO tmdb_movies
            (imdb_id, tmdb_id, status, title, original_title, release_date,
             release_year, overview, poster_path, backdrop_path, genre_ids,
             popularity, vote_average, vote_count, raw_response, fetched_at)
          VALUES (?, ?, 'found', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(imdb_id) DO UPDATE SET
            tmdb_id        = excluded.tmdb_id,
            status         = excluded.status,
            title          = excluded.title,
            original_title = excluded.original_title,
            release_date   = excluded.release_date,
            release_year   = excluded.release_year,
            overview       = excluded.overview,
            poster_path    = excluded.poster_path,
            backdrop_path  = excluded.backdrop_path,
            genre_ids      = excluded.genre_ids,
            popularity     = excluded.popularity,
            vote_average   = excluded.vote_average,
            vote_count     = excluded.vote_count,
            raw_response   = excluded.raw_response,
            fetched_at     = excluded.fetched_at,
            error          = NULL`,
      )
      .bind(
        imdbId,
        movie.id,
        movie.title ?? null,
        movie.original_title ?? null,
        movie.release_date ?? null,
        year,
        movie.overview ?? null,
        movie.poster_path ?? null,
        movie.backdrop_path ?? null,
        JSON.stringify(movie.genre_ids ?? []),
        movie.popularity ?? null,
        movie.vote_average ?? null,
        movie.vote_count ?? null,
        raw,
        now,
      )
      .run();
  }

  /**
   * Persist the movie+credits payload (runtime, budget, language,
   * production companies, director, top cast, plus the raw response).
   */
  public async updateMovieCredits(
    imdbId: string,
    movie: TmdbMovieResponse,
    raw: string,
    now: string,
  ): Promise<void> {
    const crew = movie.credits?.crew ?? [];
    const cast = (movie.credits?.cast ?? []).slice(0, 5);
    const directorRows: readonly TmdbCrewEntry[] = crew.filter(
      (c) => c.job === 'Director',
    );
    const directors = directorRows.map((c) => c.name).filter(Boolean);
    const directorIds = directorRows
      .map((c) => c.id)
      .filter((x): x is number => typeof x === 'number');
    const castIds = cast
      .map((c: TmdbCastEntry) => c.id)
      .filter((x): x is number => typeof x === 'number');
    const companies = (movie.production_companies ?? [])
      .filter((c) => c.id !== undefined)
      .map((c) => ({ id: c.id, name: c.name }));

    await this.db
      .prepare(
        `UPDATE tmdb_movies
            SET runtime = ?,
                budget = ?,
                revenue = ?,
                original_language = ?,
                director = ?,
                top_cast = ?,
                cast_ids = ?,
                director_ids = ?,
                production_companies = ?,
                raw_credits = ?,
                credits_fetched_at = ?
          WHERE imdb_id = ?`,
      )
      .bind(
        movie.runtime ?? null,
        movie.budget ?? null,
        movie.revenue ?? null,
        movie.original_language ?? null,
        directors.length > 0 ? directors.join(', ') : null,
        cast.length > 0
          ? JSON.stringify(
              cast.map((c: TmdbCastEntry) => ({
                name: c.name,
                character: c.character,
              })),
            )
          : null,
        castIds.length > 0 ? JSON.stringify(castIds) : null,
        directorIds.length > 0 ? JSON.stringify(directorIds) : null,
        companies.length > 0 ? JSON.stringify(companies) : null,
        raw,
        now,
        imdbId,
      )
      .run();
  }

  /** Record a credits-fetch error without overwriting a prior good row. */
  public async recordCreditsError(
    imdbId: string,
    raw: string,
    errorMessage: string,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE tmdb_movies
            SET raw_credits = ?, credits_fetched_at = ?, error = ?
          WHERE imdb_id = ?`,
      )
      .bind(raw, now, errorMessage, imdbId)
      .run();
  }

  /**
   * Re-parses already-stored /movie responses to populate columns that
   * were added in later migrations (budget/revenue, cast_ids,
   * director_ids, production_companies, original_language). No network.
   */
  public async backfillFromRawCredits(): Promise<number> {
    const rows = await this.db
      .prepare(
        `SELECT imdb_id, raw_credits FROM tmdb_movies
          WHERE status = 'found'
            AND raw_credits IS NOT NULL
            AND (budget IS NULL
                 OR cast_ids IS NULL
                 OR production_companies IS NULL
                 OR original_language IS NULL)`,
      )
      .all<{ imdb_id: string; raw_credits: string }>();

    return (rows.results ?? []).reduce<Promise<number>>(async (accP, row) => {
      const updated = await accP;
      try {
        const json = JSON.parse(row.raw_credits) as TmdbMovieResponse;
        const crew = json.credits?.crew ?? [];
        const cast = (json.credits?.cast ?? []).slice(0, 5);
        const dirIds = crew
          .filter((c) => c.job === 'Director')
          .map((c) => c.id)
          .filter((x): x is number => typeof x === 'number');
        const castIds = cast
          .map((c: TmdbCastEntry) => c.id)
          .filter((x): x is number => typeof x === 'number');
        const companies = (json.production_companies ?? [])
          .filter((c) => c.id !== undefined)
          .map((c) => ({ id: c.id, name: c.name }));
        await this.db
          .prepare(
            `UPDATE tmdb_movies
                SET budget = ?,
                    revenue = ?,
                    original_language = COALESCE(original_language, ?),
                    cast_ids = COALESCE(cast_ids, ?),
                    director_ids = COALESCE(director_ids, ?),
                    production_companies = COALESCE(production_companies, ?)
              WHERE imdb_id = ?`,
          )
          .bind(
            json.budget ?? null,
            json.revenue ?? null,
            json.original_language ?? null,
            castIds.length > 0 ? JSON.stringify(castIds) : null,
            dirIds.length > 0 ? JSON.stringify(dirIds) : null,
            companies.length > 0 ? JSON.stringify(companies) : null,
            row.imdb_id,
          )
          .run();
        return updated + 1;
      } catch {
        /* skip malformed rows */
        return updated;
      }
    }, Promise.resolve(0));
  }

  /** Collect cast+director ids referenced by any successful movie. */
  public async collectReferencedPeople(): Promise<Set<number>> {
    const res = await this.db
      .prepare(
        `SELECT cast_ids, director_ids FROM tmdb_movies
          WHERE status = 'found'
            AND (cast_ids IS NOT NULL OR director_ids IS NOT NULL)`,
      )
      .all<{ cast_ids: string | null; director_ids: string | null }>();
    const ids = (res.results ?? []).flatMap((row) =>
      [row.cast_ids, row.director_ids]
        .filter((raw): raw is string => raw !== null)
        .flatMap((raw) => {
          try {
            return JSON.parse(raw) as number[];
          } catch {
            return [];
          }
        }),
    );
    return new Set<number>(ids);
  }

  /** Ids in tmdb_people. */
  public async knownPeopleIds(): Promise<Set<number>> {
    const res = await this.db
      .prepare(`SELECT id FROM tmdb_people`)
      .all<{ id: number }>();
    return new Set<number>((res.results ?? []).map((r) => r.id));
  }

  /** People still missing a prestige_score — covers the migration backfill. */
  public async stalePeopleIds(): Promise<Set<number>> {
    const res = await this.db
      .prepare(`SELECT id FROM tmdb_people WHERE prestige_score IS NULL`)
      .all<{ id: number }>();
    return new Set<number>((res.results ?? []).map((r) => r.id));
  }

  /** Persist a person row with their computed prestige score. */
  public async upsertPerson(
    person: TmdbPersonResponse,
    fallbackId: number,
    prestige: number,
    totalCredits: number,
    raw: string,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO tmdb_people
            (id, name, popularity, known_for_department,
             prestige_score, total_credits, fetched_at, raw_response)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            popularity = excluded.popularity,
            known_for_department = excluded.known_for_department,
            prestige_score = excluded.prestige_score,
            total_credits = excluded.total_credits,
            fetched_at = excluded.fetched_at,
            raw_response = excluded.raw_response`,
      )
      .bind(
        person.id ?? fallbackId,
        person.name ?? null,
        person.popularity ?? null,
        person.known_for_department ?? null,
        prestige,
        totalCredits,
        now,
        raw,
      )
      .run();
  }

  /** Movies + their person id arrays. Used to recompute talent_score. */
  public async movieTalentInputs(): Promise<
    { imdb_id: string; cast_ids: string | null; director_ids: string | null }[]
  > {
    const res = await this.db
      .prepare(
        `SELECT imdb_id, cast_ids, director_ids
           FROM tmdb_movies
          WHERE status = 'found'
            AND (cast_ids IS NOT NULL OR director_ids IS NOT NULL)`,
      )
      .all<{
        imdb_id: string;
        cast_ids: string | null;
        director_ids: string | null;
      }>();
    return res.results ?? [];
  }

  /** Map person_id → max(prestige_score, popularity) for scoring. */
  public async peoplePrestigeMap(): Promise<Map<number, number>> {
    const res = await this.db
      .prepare(
        `SELECT id, COALESCE(prestige_score, popularity) AS pop FROM tmdb_people`,
      )
      .all<{ id: number; pop: number | null }>();
    return new Map<number, number>(
      (res.results ?? [])
        .filter((r): r is { id: number; pop: number } => r.pop !== null)
        .map((r) => [r.id, r.pop]),
    );
  }

  /** Write a movie's computed talent_score. */
  public async updateTalentScore(imdbId: string, score: number): Promise<void> {
    await this.db
      .prepare(`UPDATE tmdb_movies SET talent_score = ? WHERE imdb_id = ?`)
      .bind(score, imdbId)
      .run();
  }
}
