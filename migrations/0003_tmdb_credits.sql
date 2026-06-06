-- Adds the fields available from /movie/{id}?append_to_response=credits.
ALTER TABLE tmdb_movies ADD COLUMN runtime            INTEGER;
ALTER TABLE tmdb_movies ADD COLUMN director           TEXT;     -- comma-separated names
ALTER TABLE tmdb_movies ADD COLUMN top_cast           TEXT;     -- JSON array of {name,character}
ALTER TABLE tmdb_movies ADD COLUMN credits_fetched_at TEXT;
ALTER TABLE tmdb_movies ADD COLUMN raw_credits        TEXT;
CREATE INDEX tmdb_movies_credits_pending_idx
  ON tmdb_movies(status) WHERE credits_fetched_at IS NULL;
