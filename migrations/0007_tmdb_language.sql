-- ISO 639-1 language code ('en', 'hi', 'ja', 'fr', ...) from /movie.
ALTER TABLE tmdb_movies ADD COLUMN original_language TEXT;
CREATE INDEX tmdb_movies_lang_idx ON tmdb_movies(original_language);
