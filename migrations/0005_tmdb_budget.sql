-- Budget / revenue from /movie response. Useful as an A-grade signal:
-- a movie with $50M+ budget is almost always a tentpole release. 0 means
-- TMDB doesn't have the data (often indie/small).
ALTER TABLE tmdb_movies ADD COLUMN budget   INTEGER;
ALTER TABLE tmdb_movies ADD COLUMN revenue  INTEGER;
