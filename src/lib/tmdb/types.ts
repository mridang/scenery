/**
 * TMDB genre row (`/genre/movie/list`).
 *
 * @public
 */
export interface TmdbGenre {
  id: number;
  name: string;
}

/**
 * The movie-level fields we capture from TMDB's `/find` endpoint.
 *
 * @public
 */
export interface TmdbFindMovie {
  id: number;
  title?: string;
  original_title?: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genre_ids?: number[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
}

/**
 * Response shape of `/find/{imdb_id}?external_source=imdb_id`.
 *
 * @public
 */
export interface TmdbFindResponse {
  movie_results?: TmdbFindMovie[];
}

/** Cast entry from `/movie/{id}?append_to_response=credits`. @public */
export interface TmdbCastEntry {
  id?: number;
  name?: string;
  character?: string;
}

/** Crew entry from `/movie/{id}?append_to_response=credits`. @public */
export interface TmdbCrewEntry {
  id?: number;
  job?: string;
  name?: string;
}

/** Production company entry on movie responses. @public */
export interface TmdbCompany {
  id?: number;
  name?: string;
}

/**
 * Subset of `/movie/{id}?append_to_response=credits` we persist.
 *
 * @public
 */
export interface TmdbMovieResponse {
  runtime?: number | null;
  budget?: number | null;
  revenue?: number | null;
  original_language?: string | null;
  production_companies?: TmdbCompany[];
  credits?: { cast?: TmdbCastEntry[]; crew?: TmdbCrewEntry[] };
}

/** Subset of `/person/{id}?append_to_response=movie_credits`. @public */
export interface TmdbPersonResponse {
  id?: number;
  name?: string;
  popularity?: number;
  known_for_department?: string;
  movie_credits?: {
    cast?: { id?: number; vote_count?: number }[];
    crew?: { id?: number; job?: string; vote_count?: number }[];
  };
}

/**
 * Aggregate summary returned by {@link TmdbEnricher}.
 *
 * @public
 */
export interface EnrichSummary {
  found: number;
  notFound: number;
  errors: number;
  scanned: number;
  creditsFetched: number;
  creditsErrors: number;
  peopleFetched: number;
  peopleErrors: number;
  talentScored: number;
}
