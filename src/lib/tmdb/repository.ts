import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';

import {
  createDatabase,
  type Database,
  movies,
  tmdb_genres,
  tmdb_movies,
  tmdb_people,
} from '../db';
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
  private readonly db: Database;

  public constructor(d1: D1Database) {
    this.db = createDatabase(d1);
  }

  /** Number of rows currently in {@link tmdb_genres}. */
  public async countGenres(): Promise<number> {
    const row = await this.db
      .select({ n: sql<number>`COUNT(*)` })
      .from(tmdb_genres)
      .get();
    return row?.n ?? 0;
  }

  /** Upsert one TMDB genre. */
  public async upsertGenre(genre: TmdbGenre): Promise<void> {
    await this.db
      .insert(tmdb_genres)
      .values({ id: genre.id, name: genre.name })
      .onConflictDoUpdate({
        target: tmdb_genres.id,
        set: { name: genre.name },
      });
  }

  /**
   * Imdb ids that still need a /find lookup: either no tmdb_movies row
   * yet, or a prior attempt that errored (e.g. hit the per-invocation
   * subrequest cap). 'not_found' rows are intentionally excluded — those
   * are a settled verdict, not a transient failure.
   */
  public async pendingMovieIds(limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ imdb_id: movies.imdb_id })
      .from(movies)
      .leftJoin(tmdb_movies, eq(tmdb_movies.imdb_id, movies.imdb_id))
      .where(or(isNull(tmdb_movies.imdb_id), eq(tmdb_movies.status, 'error')))
      .limit(limit);
    return rows.map((row) => row.imdb_id);
  }

  /** Imdb ids already found but missing credit data. */
  public async pendingCreditIds(
    limit: number,
  ): Promise<{ imdb_id: string; tmdb_id: number }[]> {
    return this.db
      .select({ imdb_id: tmdb_movies.imdb_id, tmdb_id: tmdb_movies.tmdb_id })
      .from(tmdb_movies)
      .where(
        and(
          eq(tmdb_movies.status, 'found'),
          isNotNull(tmdb_movies.tmdb_id),
          isNull(tmdb_movies.credits_fetched_at),
        ),
      )
      .limit(limit) as Promise<{ imdb_id: string; tmdb_id: number }[]>;
  }

  /** Persist an HTTP error against a movie's tmdb_movies row. */
  public async recordMovieError(
    imdbId: string,
    raw: string,
    errorMessage: string,
    now: string,
  ): Promise<void> {
    await this.db
      .insert(tmdb_movies)
      .values({
        imdb_id: imdbId,
        status: 'error',
        raw_response: raw,
        fetched_at: now,
        error: errorMessage,
      })
      .onConflictDoUpdate({
        target: tmdb_movies.imdb_id,
        set: {
          status: 'error',
          raw_response: raw,
          fetched_at: now,
          error: errorMessage,
        },
      });
  }

  /** Persist a 'not_found' verdict against a movie's tmdb_movies row. */
  public async recordMovieNotFound(
    imdbId: string,
    raw: string,
    now: string,
  ): Promise<void> {
    await this.db
      .insert(tmdb_movies)
      .values({
        imdb_id: imdbId,
        status: 'not_found',
        raw_response: raw,
        fetched_at: now,
      })
      .onConflictDoUpdate({
        target: tmdb_movies.imdb_id,
        set: {
          status: 'not_found',
          raw_response: raw,
          fetched_at: now,
        },
      });
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
    const values = {
      tmdb_id: movie.id,
      status: 'found' as const,
      title: movie.title ?? null,
      original_title: movie.original_title ?? null,
      release_date: movie.release_date ?? null,
      release_year: year,
      overview: movie.overview ?? null,
      poster_path: movie.poster_path ?? null,
      backdrop_path: movie.backdrop_path ?? null,
      genre_ids: JSON.stringify(movie.genre_ids ?? []),
      popularity: movie.popularity ?? null,
      vote_average: movie.vote_average ?? null,
      vote_count: movie.vote_count ?? null,
      raw_response: raw,
      fetched_at: now,
    };
    await this.db
      .insert(tmdb_movies)
      .values({ imdb_id: imdbId, ...values })
      .onConflictDoUpdate({
        target: tmdb_movies.imdb_id,
        set: { ...values, error: null },
      });
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
      (member) => member.job === 'Director',
    );
    const directors = directorRows.map((member) => member.name).filter(Boolean);
    const directorIds = directorRows
      .map((member) => member.id)
      .filter((id): id is number => typeof id === 'number');
    const castIds = cast
      .map((member: TmdbCastEntry) => member.id)
      .filter((id): id is number => typeof id === 'number');
    const companies = (movie.production_companies ?? [])
      .filter((company) => company.id !== undefined)
      .map((company) => ({ id: company.id, name: company.name }));

    await this.db
      .update(tmdb_movies)
      .set({
        runtime: movie.runtime ?? null,
        budget: movie.budget ?? null,
        revenue: movie.revenue ?? null,
        original_language: movie.original_language ?? null,
        director: directors.length > 0 ? directors.join(', ') : null,
        top_cast:
          cast.length > 0
            ? JSON.stringify(
                cast.map((member: TmdbCastEntry) => ({
                  name: member.name,
                  character: member.character,
                })),
              )
            : null,
        cast_ids: castIds.length > 0 ? JSON.stringify(castIds) : null,
        director_ids:
          directorIds.length > 0 ? JSON.stringify(directorIds) : null,
        production_companies:
          companies.length > 0 ? JSON.stringify(companies) : null,
        raw_credits: raw,
        credits_fetched_at: now,
      })
      .where(eq(tmdb_movies.imdb_id, imdbId));
  }

  /** Record a credits-fetch error without overwriting a prior good row. */
  public async recordCreditsError(
    imdbId: string,
    raw: string,
    errorMessage: string,
    now: string,
  ): Promise<void> {
    await this.db
      .update(tmdb_movies)
      .set({ raw_credits: raw, credits_fetched_at: now, error: errorMessage })
      .where(eq(tmdb_movies.imdb_id, imdbId));
  }

  /**
   * Re-parses already-stored /movie responses to populate columns that
   * were added in later migrations (budget/revenue, cast_ids,
   * director_ids, production_companies, original_language). No network.
   */
  public async backfillFromRawCredits(): Promise<number> {
    const rows = (await this.db
      .select({
        imdb_id: tmdb_movies.imdb_id,
        raw_credits: tmdb_movies.raw_credits,
      })
      .from(tmdb_movies)
      .where(
        and(
          eq(tmdb_movies.status, 'found'),
          isNotNull(tmdb_movies.raw_credits),
          or(
            isNull(tmdb_movies.budget),
            isNull(tmdb_movies.cast_ids),
            isNull(tmdb_movies.production_companies),
            isNull(tmdb_movies.original_language),
          ),
        ),
      )) as { imdb_id: string; raw_credits: string }[];

    return rows.reduce<Promise<number>>(async (accP, row) => {
      const updated = await accP;
      try {
        const json = JSON.parse(row.raw_credits) as TmdbMovieResponse;
        const crew = json.credits?.crew ?? [];
        const cast = (json.credits?.cast ?? []).slice(0, 5);
        const directorIds = crew
          .filter((member) => member.job === 'Director')
          .map((member) => member.id)
          .filter((id): id is number => typeof id === 'number');
        const castIds = cast
          .map((member: TmdbCastEntry) => member.id)
          .filter((id): id is number => typeof id === 'number');
        const companies = (json.production_companies ?? [])
          .filter((company) => company.id !== undefined)
          .map((company) => ({ id: company.id, name: company.name }));
        await this.db
          .update(tmdb_movies)
          .set({
            budget: json.budget ?? null,
            revenue: json.revenue ?? null,
            original_language: sql`COALESCE(original_language, ${json.original_language ?? null})`,
            cast_ids: sql`COALESCE(cast_ids, ${castIds.length > 0 ? JSON.stringify(castIds) : null})`,
            director_ids: sql`COALESCE(director_ids, ${directorIds.length > 0 ? JSON.stringify(directorIds) : null})`,
            production_companies: sql`COALESCE(production_companies, ${companies.length > 0 ? JSON.stringify(companies) : null})`,
          })
          .where(eq(tmdb_movies.imdb_id, row.imdb_id));
        return updated + 1;
      } catch {
        /* skip malformed rows */
        return updated;
      }
    }, Promise.resolve(0));
  }

  /** Collect cast+director ids referenced by any successful movie. */
  public async collectReferencedPeople(): Promise<Set<number>> {
    const rows = await this.db
      .select({
        cast_ids: tmdb_movies.cast_ids,
        director_ids: tmdb_movies.director_ids,
      })
      .from(tmdb_movies)
      .where(
        and(
          eq(tmdb_movies.status, 'found'),
          or(
            isNotNull(tmdb_movies.cast_ids),
            isNotNull(tmdb_movies.director_ids),
          ),
        ),
      );
    const ids = rows.flatMap((row) =>
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

  /** Cast + director ids referenced by ONE movie (deduped). */
  public async peopleIdsForMovie(imdbId: string): Promise<number[]> {
    const row = await this.db
      .select({
        cast_ids: tmdb_movies.cast_ids,
        director_ids: tmdb_movies.director_ids,
      })
      .from(tmdb_movies)
      .where(eq(tmdb_movies.imdb_id, imdbId))
      .get();
    if (!row) {
      return [];
    }
    const ids = [row.cast_ids, row.director_ids]
      .filter((raw): raw is string => raw !== null)
      .flatMap((raw) => {
        try {
          return JSON.parse(raw) as number[];
        } catch {
          return [];
        }
      });
    return [...new Set<number>(ids)];
  }

  /** Ids in tmdb_people. */
  public async knownPeopleIds(): Promise<Set<number>> {
    const rows = await this.db.select({ id: tmdb_people.id }).from(tmdb_people);
    return new Set<number>(rows.map((row) => row.id));
  }

  /** People still missing a prestige_score — covers the migration backfill. */
  public async stalePeopleIds(): Promise<Set<number>> {
    const rows = await this.db
      .select({ id: tmdb_people.id })
      .from(tmdb_people)
      .where(isNull(tmdb_people.prestige_score));
    return new Set<number>(rows.map((row) => row.id));
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
    const values = {
      name: person.name ?? null,
      popularity: person.popularity ?? null,
      known_for_department: person.known_for_department ?? null,
      prestige_score: prestige,
      total_credits: totalCredits,
      fetched_at: now,
      raw_response: raw,
    };
    await this.db
      .insert(tmdb_people)
      .values({ id: person.id ?? fallbackId, ...values })
      .onConflictDoUpdate({
        target: tmdb_people.id,
        set: values,
      });
  }

  /** Movies + their person id arrays. Used to recompute talent_score. */
  public async movieTalentInputs(): Promise<
    { imdb_id: string; cast_ids: string | null; director_ids: string | null }[]
  > {
    return this.db
      .select({
        imdb_id: tmdb_movies.imdb_id,
        cast_ids: tmdb_movies.cast_ids,
        director_ids: tmdb_movies.director_ids,
      })
      .from(tmdb_movies)
      .where(
        and(
          eq(tmdb_movies.status, 'found'),
          or(
            isNotNull(tmdb_movies.cast_ids),
            isNotNull(tmdb_movies.director_ids),
          ),
        ),
      );
  }

  /** Map person_id → max(prestige_score, popularity) for scoring. */
  public async peoplePrestigeMap(): Promise<Map<number, number>> {
    const rows = await this.db
      .select({
        id: tmdb_people.id,
        pop: sql<
          number | null
        >`COALESCE(${tmdb_people.prestige_score}, ${tmdb_people.popularity})`.as(
          'pop',
        ),
      })
      .from(tmdb_people);
    return new Map<number, number>(
      rows
        .filter((row): row is { id: number; pop: number } => row.pop !== null)
        .map((row) => [row.id, row.pop]),
    );
  }

  /** Write a movie's computed talent_score. */
  public async updateTalentScore(imdbId: string, score: number): Promise<void> {
    await this.db
      .update(tmdb_movies)
      .set({ talent_score: score })
      .where(eq(tmdb_movies.imdb_id, imdbId));
  }
}
