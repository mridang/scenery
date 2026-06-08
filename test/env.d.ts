/// <reference types="@cloudflare/vitest-pool-workers/types" />
import type { D1Migration } from '@cloudflare/vitest-pool-workers';

// `cloudflare:test` types its `env` as the generated `Cloudflare.Env`, so
// the migration list passed to Miniflare in vitest.config.mjs is surfaced
// by augmenting that interface (DB is already declared there by
// `wrangler types`). Test-only binding — production never reads it.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
