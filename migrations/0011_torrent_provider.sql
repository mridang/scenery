-- Track which provider served each torrent lookup. Lets us monitor
-- fallback health (e.g. spike in apibay = Torrentio is sick).
ALTER TABLE torrent_lookups ADD COLUMN provider TEXT;
CREATE INDEX torrent_lookups_provider_idx ON torrent_lookups(provider);
