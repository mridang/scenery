import path from 'node:path';

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Read every file in ./migrations once, at config-load time. The parsed
// array is structured-cloneable, so it can be handed to the workers
// project as a Miniflare binding and replayed against the in-memory D1 in
// a setup file (see test/apply-migrations.ts).
const migrations = await readD1Migrations(
  path.join(import.meta.dirname, 'migrations'),
);

export default defineConfig({
  test: {
    projects: [
      {
        // Pure, runtime-agnostic unit tests (scoring, parsers) run on
        // plain Node — no workerd boot, no bindings, fast reruns.
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        // Repository tests run inside the real Workers runtime (workerd)
        // against a genuine in-memory D1 bound as `DB`. `cloudflareTest`
        // is the Vitest 4 plugin form of the pool (it replaced
        // `defineWorkersProject` from the `/config` entry).
        plugins: [
          cloudflareTest({
            miniflare: {
              compatibilityDate: '2026-05-01',
              compatibilityFlags: ['nodejs_compat'],
              d1Databases: ['DB'],
              // Migrations travel into the runtime as a binding; the setup
              // file applies them before any test runs.
              bindings: { TEST_MIGRATIONS: migrations },
            },
          }),
        ],
        test: {
          name: 'workers',
          include: ['test/**/*.test.ts'],
          setupFiles: ['./test/apply-migrations.ts'],
        },
      },
    ],
  },
});
