-- Web Push (VAPID) subscriptions. One row per browser/device that opted
-- in to receive the daily 17:00 UTC top-5 notification. Removed when the
-- push endpoint returns 410 Gone.
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_sent_at TEXT
);
