-- Cached /person/{id} responses. Popularity is TMDB's traffic signal
-- (~0.5 for unknowns, ~5 for established, 10+ for A-list).
CREATE TABLE tmdb_people (
  id                    INTEGER PRIMARY KEY,
  name                  TEXT,
  popularity            REAL,
  known_for_department  TEXT,
  fetched_at            TEXT NOT NULL,
  raw_response          TEXT
);
CREATE INDEX tmdb_people_pop_idx ON tmdb_people(popularity DESC);

-- talent_score is the max popularity across (director + top cast),
-- recomputed whenever new people are looked up.
ALTER TABLE tmdb_movies ADD COLUMN talent_score    REAL;
ALTER TABLE tmdb_movies ADD COLUMN cast_ids        TEXT;  -- JSON array of person ids
ALTER TABLE tmdb_movies ADD COLUMN director_ids    TEXT;  -- JSON array of person ids
CREATE INDEX tmdb_movies_talent_idx ON tmdb_movies(talent_score DESC);
