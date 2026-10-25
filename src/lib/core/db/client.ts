import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * A Drizzle client bound to a D1 database, typed against the schema it was
 * built with. Generic in the schema so this platform module stays free of any
 * app's tables — the domain passes its own schema to {@link createDatabase} and
 * names the concrete type (see `@/domain/db/client`).
 */
export type GenericDatabase<TSchema extends Record<string, unknown>> =
  DrizzleD1Database<TSchema> & {
    $client: D1Database;
  };

/**
 * Wrap a raw D1 binding in a typed Drizzle client for `schema`. The binding and
 * `drizzle-orm/d1` are the only platform concerns; the schema comes from the
 * caller (the app/domain), so this never reaches into the domain.
 *
 * @public
 */
export function createDatabase<TSchema extends Record<string, unknown>>(
  d1: D1Database,
  schema: TSchema,
): GenericDatabase<TSchema> {
  return drizzle(d1, { schema }) as GenericDatabase<TSchema>;
}
