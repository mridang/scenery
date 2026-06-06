-- One lookup row per movie. Status:
--   'success' (≥1 torrent found),
--   'empty'   (response was 200 but no streams),
--   'error'   (transport or parse failure).
CREATE TABLE torrent_lookups (
  imdb_id        TEXT PRIMARY KEY REFERENCES movies(imdb_id),
  status         TEXT NOT NULL,
  searched_at    TEXT NOT NULL,
  attempt_count  INTEGER NOT NULL DEFAULT 1,
  result_count   INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  raw_response   TEXT
);

CREATE TABLE torrents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  imdb_id      TEXT NOT NULL REFERENCES movies(imdb_id),
  info_hash    TEXT NOT NULL,
  title        TEXT NOT NULL,            -- the torrent's actual release name
  raw_title    TEXT NOT NULL,            -- full multi-line "title" from torrentio
  source       TEXT,                     -- e.g. 1337x, ThePirateBay, RARBG
  seeders      INTEGER,
  size_bytes   INTEGER,
  quality      TEXT,                     -- 480p / 720p / 1080p / 2160p
  is_hdr       INTEGER NOT NULL DEFAULT 0,
  is_remux     INTEGER NOT NULL DEFAULT 0,
  fetched_at   TEXT NOT NULL,
  UNIQUE(imdb_id, info_hash)
);
CREATE INDEX torrents_imdb_idx          ON torrents(imdb_id);
CREATE INDEX torrents_imdb_seeders_idx  ON torrents(imdb_id, seeders DESC);
