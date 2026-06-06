-- Catalog: source-agnostic. Only the imdb id is universal; everything
-- else (title, year, runtime, etc.) is fetched later from TMDB.
CREATE TABLE movies (
  imdb_id        TEXT PRIMARY KEY,
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL
);

-- One row per release tracker we ingest from.
CREATE TABLE sources (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  slug     TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL
);

INSERT INTO sources (slug, base_url) VALUES
  ('scnsrc', 'https://www.scnsrc.me/category/films/hd/');

-- Every release post we've seen on a source. Same imdb id can have
-- multiple releases (different groups / resolutions / repacks).
CREATE TABLE releases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id      INTEGER NOT NULL REFERENCES sources(id),
  external_id    TEXT NOT NULL,                  -- source's own post id, as text for portability
  imdb_id        TEXT NOT NULL REFERENCES movies(imdb_id),
  title          TEXT NOT NULL,                  -- as written by the source
  url            TEXT NOT NULL,                  -- post permalink on the source
  posted_at      TEXT,                           -- ISO timestamp if parseable
  posted_at_raw  TEXT,                           -- raw date string as scraped, for debugging
  categories     TEXT,                           -- JSON array of category strings
  author         TEXT,
  image_url      TEXT,                           -- poster/thumbnail if present
  excerpt        TEXT,                           -- short text blurb if present
  post_html      TEXT,                           -- the post block's raw html chunk
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  UNIQUE(source_id, external_id)
);
CREATE INDEX releases_imdb_idx       ON releases(imdb_id);
CREATE INDEX releases_first_seen_idx ON releases(first_seen_at DESC);

-- Raw page HTML for every successful fetch. Re-parseable forever.
CREATE TABLE page_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id       INTEGER NOT NULL REFERENCES sources(id),
  page_number     INTEGER NOT NULL,
  page_url        TEXT NOT NULL,
  fetched_at      TEXT NOT NULL,
  fetcher         TEXT NOT NULL,                 -- 'scrapingant-browser', etc.
  http_status     INTEGER,
  html            TEXT NOT NULL,
  byte_size       INTEGER NOT NULL,
  response_headers TEXT                          -- JSON of headers, if available
);
CREATE INDEX page_snapshots_src_page_idx ON page_snapshots(source_id, page_number, fetched_at DESC);

-- Every attempt, success or failure. Failed attempts still get the
-- response body if we got one back, so we can post-mortem.
CREATE TABLE fetch_attempts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id       INTEGER NOT NULL REFERENCES sources(id),
  page_number     INTEGER NOT NULL,
  page_url        TEXT NOT NULL,
  attempt_number  INTEGER NOT NULL,              -- 1-based, monotonically increasing per (source, page)
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  status          TEXT NOT NULL,                 -- 'success' | 'failed'
  http_status     INTEGER,
  error           TEXT,
  response_body   TEXT,                          -- body we got back, even on failure (truncated if huge)
  snapshot_id     INTEGER REFERENCES page_snapshots(id)
);
CREATE INDEX fetch_attempts_src_page_idx ON fetch_attempts(source_id, page_number, started_at DESC);
CREATE INDEX fetch_attempts_status_idx   ON fetch_attempts(status, started_at DESC);
