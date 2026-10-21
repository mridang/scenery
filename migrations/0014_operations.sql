-- Operator operations (`POST /api/operations`): a scrape-and-enrich run, an
-- OMDB backfill, a push-notification test. One row per run, kept so that
-- `GET /api/operations/{id}` can say how it went. Timestamps are RFC 3339.
CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  parameters TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
