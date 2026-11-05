-- movies.newest_posted_at: the newest release time of a movie, kept on the
-- movie row. It is MAX(COALESCE(posted_at, first_seen_at)) over the movie's
-- releases, the figure the torrent gate (TorrentRepository.candidates and
-- tooFreshCount) used to compute with a correlated subquery for every movie,
-- reading all movies plus all their releases on each run. Denormalised on
-- purpose: ScrapingRepository.upsertRelease recomputes it in the same batch
-- as the release it summarises, so it cannot drift. NULL means no releases.
ALTER TABLE movies ADD COLUMN newest_posted_at TEXT;

-- Backfill from the existing releases.
UPDATE movies SET newest_posted_at = (
  SELECT MAX(COALESCE(r.posted_at, r.first_seen_at))
  FROM releases r WHERE r.imdb_id = movies.imdb_id
);

-- The gate filters on a cutoff and orders by the same column, so one index
-- gives the matching movies in order without a sort.
CREATE INDEX movies_newest_posted_idx ON movies(newest_posted_at);
