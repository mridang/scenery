-- Register DDLValley as a parallel source. Each cron iteration scrapes
-- both sources; releases dedupe naturally on (source_id, external_id),
-- and the catalog dedupes on imdb_id.
INSERT INTO sources (slug, base_url) VALUES
  ('ddlvalley', 'https://www.ddlvalley.me/category/movies/')
ON CONFLICT(slug) DO NOTHING;
