-- push_subscriptions.id: the subscription id the API exposes (lowercase hex
-- SHA-256 of the endpoint, see src/lib/push/subscription-id.ts), stored so
-- DELETE /api/push/subscriptions/{id} reads the one row instead of listing
-- every subscription and hashing each endpoint.
--
-- Not backfilled here: SQLite has no SHA-256 function. Existing rows keep a
-- NULL id; PushSubscriptionRepository.removeById falls back to the rows whose
-- id is still NULL (found through this index) and fills their ids as it sees
-- them. New and re-subscribed rows get the id on write.
ALTER TABLE push_subscriptions ADD COLUMN id TEXT;

-- Unique, and NULLs do not collide, so rows without an id are allowed. It
-- also serves `id IS NULL` for the fallback.
CREATE UNIQUE INDEX push_subscriptions_id_idx ON push_subscriptions(id);
