-- Production companies, e.g. [{id:178,name:"Netflix"}, ...]. Already
-- present in the stored /movie response — see backfill.
ALTER TABLE tmdb_movies ADD COLUMN production_companies TEXT;
