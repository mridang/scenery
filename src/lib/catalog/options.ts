import type { ViewOptions } from './types';

/** Recognised `?sort=` values; anything else falls back to the default. */
const KNOWN_SORTS = new Set(['score', 'date']);
/** Recognised `?view=` values; anything else falls back to the default. */
const KNOWN_VIEWS = new Set(['catalog', 'plan']);

/** Raw, untrusted query parameters as they arrive from the URL. */
export interface RawViewParams {
  readonly lang?: string | null;
  readonly sort?: string | null;
  readonly view?: string | null;
}

/**
 * Normalise and validate the catalog query parameters shared by the home
 * page and the RSS feed. Unknown `sort` / `view` values are rejected to
 * their defaults so a typo or a hostile query can never reach the SQL
 * path; `lang` is lower-cased (`'en'` default, `'all'` skips the filter).
 *
 * Centralising this is what keeps the two entry points honest — they
 * can't drift to different defaults or skip the validation.
 *
 * @public
 */
export function parseViewOptions(raw: RawViewParams): ViewOptions {
  const lang = (raw.lang ?? 'en').toLowerCase();
  const sort = (raw.sort ?? 'date').toLowerCase();
  const view = (raw.view ?? 'catalog').toLowerCase();
  return {
    lang,
    sort: KNOWN_SORTS.has(sort) ? sort : 'date',
    view: KNOWN_VIEWS.has(view) ? view : 'catalog',
  };
}
