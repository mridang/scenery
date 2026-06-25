-- OMDB enrichment: IMDb rating, IMDb vote count, Metacritic score, and
-- Rotten Tomatoes score, all keyed off imdb_id via the OMDB API. Stored
-- on tmdb_movies alongside the TMDB fields so the catalog view doesn't
-- grow another LEFT JOIN.
ALTER TABLE tmdb_movies ADD COLUMN omdb_status TEXT;
ALTER TABLE tmdb_movies ADD COLUMN omdb_fetched_at TEXT;
ALTER TABLE tmdb_movies ADD COLUMN omdb_raw TEXT;
ALTER TABLE tmdb_movies ADD COLUMN imdb_rating REAL;
ALTER TABLE tmdb_movies ADD COLUMN imdb_votes INTEGER;
ALTER TABLE tmdb_movies ADD COLUMN metacritic_score INTEGER;
ALTER TABLE tmdb_movies ADD COLUMN rt_score INTEGER;
