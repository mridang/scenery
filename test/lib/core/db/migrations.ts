import { readdir } from 'node:fs/promises';
import path from 'node:path';

const COLLATOR = new Intl.Collator();

/**
 * Every migration file, in order: what a database looks like once all of them
 * have been applied, which is what the schema file in `src/lib/db` mirrors.
 */
const files = await readdir(path.join(process.cwd(), 'migrations'));

export const APP_MIGRATIONS: readonly string[] = files
  .filter((file) => file.endsWith('.sql'))
  .toSorted((a, b) => COLLATOR.compare(a, b));
