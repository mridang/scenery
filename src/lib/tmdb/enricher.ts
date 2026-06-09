import type { TmdbClient } from './client';
import type { TmdbRepository } from './repository';
import type { TmdbPersonResponse } from './types';

/**
 * TMDB enrichment, exposed as granular units of work — one unit per
 * public method — so a caller (a Workflow step, a queue consumer, or a
 * bounded synchronous loop) can run exactly as much as fits its own
 * subrequest budget and checkpoint between units:
 *
 *   - {@link ensureGenres} populates the genre dictionary,
 *   - {@link enrichMovie} resolves one movie (/find then /movie credits),
 *   - {@link enrichPerson} fetches one person's prestige,
 *   - {@link backfillFromRawCredits} fills columns from cached responses,
 *   - {@link recomputeTalentScoresPublic} rescores every movie (pure DB).
 *
 * Every method is idempotent: re-running after a partial failure simply
 * picks up whatever is still pending.
 *
 * @public
 */
export class TmdbEnricher {
  public constructor(
    private readonly client: TmdbClient,
    private readonly repo: TmdbRepository,
  ) {}

  /** Public hook so callers can refresh the genre table directly. */
  public async refreshGenres(): Promise<number> {
    const result = await this.client.getMovieGenres();
    if (!result.ok) {
      throw new Error(`tmdb genres: ${result.error}`);
    }
    for (const genre of result.value) {
      await this.repo.upsertGenre(genre);
    }
    return result.value.length;
  }

  /** Populate the genre dictionary if empty. Idempotent. @public */
  public async ensureGenres(): Promise<void> {
    if ((await this.repo.countGenres()) === 0) {
      await this.refreshGenres();
    }
  }

  /**
   * IMDb ids that still need a /find lookup (never fetched, or a prior
   * attempt errored). Each is one unit of work.
   *
   * @public
   */
  public async listPendingMovieIds(limit: number): Promise<string[]> {
    return this.repo.pendingMovieIds(limit);
  }

  /**
   * Fully enrich ONE movie: /find then /movie credits. At most two TMDB
   * subrequests — safely under any per-invocation cap.
   *
   * @returns A short verdict for the step result.
   * @public
   */
  public async enrichMovie(
    imdbId: string,
  ): Promise<'found' | 'not_found' | 'error'> {
    const now = new Date().toISOString();
    const find = await this.client.findByImdb(imdbId);
    if (!find.ok) {
      await this.repo.recordMovieError(imdbId, find.raw, find.error, now);
      return 'error';
    }
    const movie = find.value.movie_results?.[0];
    if (!movie) {
      await this.repo.recordMovieNotFound(imdbId, find.raw, now);
      return 'not_found';
    }
    await this.repo.upsertFoundMovie(imdbId, movie, find.raw, now);

    const credits = await this.client.getMovieWithCredits(movie.id);
    if (credits.ok) {
      await this.repo.updateMovieCredits(
        imdbId,
        credits.value,
        credits.raw,
        new Date().toISOString(),
      );
    } else {
      await this.repo.recordCreditsError(
        imdbId,
        credits.raw,
        credits.error,
        new Date().toISOString(),
      );
    }
    return 'found';
  }

  /** Re-parse cached /movie responses into later-added columns. @public */
  public async backfillFromRawCredits(): Promise<number> {
    return this.repo.backfillFromRawCredits();
  }

  /**
   * Person ids referenced by the catalog that we haven't fetched yet (or
   * whose prestige score is missing). Each is one unit of work.
   *
   * @public
   */
  public async listPendingPeopleIds(limit: number): Promise<number[]> {
    const wanted = await this.repo.collectReferencedPeople();
    if (wanted.size === 0) {
      return [];
    }
    const have = await this.repo.knownPeopleIds();
    const stale = await this.repo.stalePeopleIds();
    const todo = new Set<number>([
      ...[...wanted].filter((id) => !have.has(id)),
      ...stale,
    ]);
    return [...todo].slice(0, limit);
  }

  /**
   * Fetch ONE person's filmography and store their prestige score. One
   * TMDB subrequest.
   *
   * @returns true on success, false on fetch error.
   * @public
   */
  public async enrichPerson(personId: number): Promise<boolean> {
    const result = await this.client.getPersonWithCredits(personId);
    if (!result.ok) {
      return false;
    }
    const { prestige, totalCredits } = this.computePrestige(result.value);
    await this.repo.upsertPerson(
      result.value,
      personId,
      prestige,
      totalCredits,
      result.raw,
      new Date().toISOString(),
    );
    return true;
  }

  /** Recompute talent_score for every movie. Pure DB, no subrequests. @public */
  public async recomputeTalentScoresPublic(): Promise<number> {
    return this.recomputeTalentScores();
  }

  private computePrestige(person: TmdbPersonResponse): {
    prestige: number;
    totalCredits: number;
  } {
    const cast = person.movie_credits?.cast ?? [];
    const crew = (person.movie_credits?.crew ?? []).filter(
      (credit) => credit.job === 'Director',
    );
    const totalVotes = [...cast, ...crew].reduce(
      (sum, credit) => sum + (credit.vote_count ?? 0),
      0,
    );
    return {
      prestige: Math.log10(totalVotes + 1),
      totalCredits: cast.length + crew.length,
    };
  }

  private async recomputeTalentScores(): Promise<number> {
    const inputs = await this.repo.movieTalentInputs();
    const prestige = await this.repo.peoplePrestigeMap();

    for (const row of inputs) {
      const ids = [row.cast_ids, row.director_ids]
        .filter((raw): raw is string => raw !== null)
        .flatMap((raw) => {
          try {
            return JSON.parse(raw) as number[];
          } catch {
            return [];
          }
        });
      const maxScore = ids.reduce((acc, id) => {
        const score = prestige.get(id);
        return score !== undefined && score > acc ? score : acc;
      }, 0);
      await this.repo.updateTalentScore(row.imdb_id, maxScore);
    }
    return inputs.length;
  }
}
