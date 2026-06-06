-- Career body of work — a much better signal for "is this a real talent"
-- than TMDB's recency-biased popularity field. Computed as
-- log10(sum(vote_count) across all their cast + director credits + 1).
ALTER TABLE tmdb_people ADD COLUMN prestige_score REAL;
ALTER TABLE tmdb_people ADD COLUMN total_credits  INTEGER;
ALTER TABLE tmdb_people ADD COLUMN raw_credits    TEXT;
CREATE INDEX tmdb_people_prestige_idx ON tmdb_people(prestige_score DESC);
