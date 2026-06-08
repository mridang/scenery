import { applyD1Migrations, env } from 'cloudflare:test';

// Runs once per workers test-worker, before any test. Replays every
// migration bundled in via the TEST_MIGRATIONS binding against the
// in-memory D1 so repository tests see the exact production schema —
// including seed rows such as the `scnsrc` source from 0001_init.sql.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
