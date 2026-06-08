/**
 * TMDB genre row (`/genre/movie/list`).
 *
 * @public
 */
export interface TmdbGenre {
  readonly id: number;
  readonly name: string;
}

/**
 * The movie-level fields we capture from TMDB's `/find` endpoint.
 *
 * @public
 */
export interface TmdbFindMovie {
  readonly id: number;
  readonly title?: string;
  readonly original_title?: string;
  readonly release_date?: string;
  readonly overview?: string;
  readonly poster_path?: string | null;
  readonly backdrop_path?: string | null;
  readonly genre_ids?: readonly number[];
  readonly popularity?: number;
  readonly vote_average?: number;
  readonly vote_count?: number;
}

/**
 * Response shape of `/find/{imdb_id}?external_source=imdb_id`.
 *
 * @public
 */
export interface TmdbFindResponse {
  readonly movie_results?: readonly TmdbFindMovie[];
}

/** Cast entry from `/movie/{id}?append_to_response=credits`. @public */
export interface TmdbCastEntry {
  readonly id?: number;
  readonly name?: string;
  readonly character?: string;
}

/** Crew entry from `/movie/{id}?append_to_response=credits`. @public */
export interface TmdbCrewEntry {
  readonly id?: number;
  readonly job?: string;
  readonly name?: string;
}

/** Production company entry on movie responses. @public */
export interface TmdbCompany {
  readonly id?: number;
  readonly name?: string;
}

/**
 * Subset of `/movie/{id}?append_to_response=credits` we persist.
 *
 * @public
 */
export interface TmdbMovieResponse {
  readonly runtime?: number | null;
  readonly budget?: number | null;
  readonly revenue?: number | null;
  readonly original_language?: string | null;
  readonly production_companies?: readonly TmdbCompany[];
  readonly credits?: {
    readonly cast?: readonly TmdbCastEntry[];
    readonly crew?: readonly TmdbCrewEntry[];
  };
}

/** Subset of `/person/{id}?append_to_response=movie_credits`. @public */
export interface TmdbPersonResponse {
  readonly id?: number;
  readonly name?: string;
  readonly popularity?: number;
  readonly known_for_department?: string;
  readonly movie_credits?: {
    readonly cast?: readonly {
      readonly id?: number;
      readonly vote_count?: number;
    }[];
    readonly crew?: readonly {
      readonly id?: number;
      readonly job?: string;
      readonly vote_count?: number;
    }[];
  };
}
