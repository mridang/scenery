-- TMDB genre lookup (cached once from /genre/movie/list)
CREATE TABLE tmdb_genres (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

-- Cached TMDB /find?external_source=imdb_id response per imdb id.
-- Status is 'found' | 'not_found' | 'error'. raw_response is the
-- verbatim API body so we can re-derive any field later without
-- another network round-trip.
CREATE TABLE tmdb_movies (
  imdb_id         TEXT PRIMARY KEY REFERENCES movies(imdb_id),
  tmdb_id         INTEGER,
  status          TEXT NOT NULL,
  title           TEXT,
  original_title  TEXT,
  release_date    TEXT,
  release_year    INTEGER,
  overview        TEXT,
  poster_path     TEXT,
  backdrop_path   TEXT,
  genre_ids       TEXT,
  popularity      REAL,
  vote_average    REAL,
  vote_count      INTEGER,
  raw_response    TEXT NOT NULL,
  fetched_at      TEXT NOT NULL,
  error           TEXT
);
CREATE INDEX tmdb_movies_tmdb_idx ON tmdb_movies(tmdb_id);
CREATE INDEX tmdb_movies_status_idx ON tmdb_movies(status);
