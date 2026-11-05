-- Read fewer rows on the hot paths. D1 bills rows read, so each index below
-- lets its query read the one row it needs (or only the rows it returns)
-- instead of every row of the table.

-- The home page's last-update block (CatalogRepository.loadLastUpdate) takes
-- the newest scrape, torrent lookup and TMDB fetch time. Without an index each
-- one scanned the whole table; page_snapshots holds every fetched HTML page.
CREATE INDEX page_snapshots_fetched_idx   ON page_snapshots(fetched_at);
CREATE INDEX torrent_lookups_searched_idx ON torrent_lookups(searched_at);
CREATE INDEX tmdb_movies_fetched_idx      ON tmdb_movies(fetched_at);

-- OMDB backfill (OmdbRepository.pending) asks for found movies still missing
-- ratings. Partial: a movie drops out once enriched, so the index stays small.
CREATE INDEX tmdb_movies_omdb_pending_idx ON tmdb_movies(status)
  WHERE omdb_status IS NULL OR omdb_status = 'error';

-- ScrapingRepository.nextAttemptNumber reads the highest attempt_number of a
-- (source, page). Keying the index by attempt_number lets it read the last
-- entry only; the old started_at key made it read every attempt of the page.
DROP INDEX fetch_attempts_src_page_idx;
CREATE INDEX fetch_attempts_src_page_idx ON fetch_attempts(source_id, page_number, attempt_number);

-- torrents_imdb_idx(imdb_id) is a prefix of torrents_imdb_seeders_idx and of
-- the unique (imdb_id, info_hash) key, so it only costs writes.
DROP INDEX torrents_imdb_idx;
