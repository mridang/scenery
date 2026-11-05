-- Drop two indexes no query uses; each only costs a write.
--
-- releases_first_seen_idx: the only reads of releases.first_seen_at are inside
-- COALESCE(posted_at, first_seen_at) expressions (catalog read model and the
-- movies.newest_posted_at refresh), which a plain index cannot serve.
-- tmdb_people_pop_idx: popularity is only read inside
-- COALESCE(prestige_score, popularity) when building the prestige map, which
-- reads every person anyway; nothing filters or sorts on it.
-- No backfill: dropping an index changes no data.
DROP INDEX releases_first_seen_idx;
DROP INDEX tmdb_people_pop_idx;
