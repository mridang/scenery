/**
 * @packageDocumentation
 *
 * The app's Drizzle client: the generic platform client from
 * `@/lib/core/db/client` bound to this app's own schema. This is where the
 * schema and the D1 binding meet, so `lib/core` stays schema-agnostic.
 */

import {
  createDatabase,
  type Database as GenericDatabase,
} from '@/lib/core/db/client';
import { getDB } from '@/lib/core/runtime';
import * as schema from './schema';

/** A Drizzle client typed against this app's schema. @public */
export type Database = GenericDatabase<typeof schema>;

/** Wrap a D1 binding (a Workflow's `env.DB`, a test's fake) in the app client. */
export function databaseFrom(binding: D1Database): Database {
  return createDatabase(binding, schema);
}

/** The app client for the current request's D1 binding. */
export function database(): Database {
  return databaseFrom(getDB());
}
