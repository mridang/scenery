import type { PageViewOptions, ViewOptions } from './types';

/** Recognised `?sort=` values for the SQL layer. */
const KNOWN_SQL_SORTS = new Set(['score', 'date']);
/** Recognised `?sort=` values for the page (includes the page-only 'rating'). */
const KNOWN_PAGE_SORTS = new Set(['score', 'date', 'rating']);
/** Recognised `?view=` values; anything else falls back to the default. */
const KNOWN_VIEWS = new Set(['catalog', 'plan']);
/** Recognised `?status=` values; anything else falls back to the default. */
const KNOWN_STATUSES = new Set(['all', 'available', 'pending', 'none']);
/** Recognised `?layout=` values; anything else falls back to the default. */
const KNOWN_LAYOUTS = new Set(['mosaic', 'uniform']);

/** Raw, untrusted query parameters as they arrive from the URL. */
export interface RawViewParams {
  readonly lang?: string | null;
  readonly sort?: string | null;
  readonly view?: string | null;
  readonly status?: string | null;
  readonly layout?: string | null;
  readonly q?: string | null;
}

/**
 * Normalise and validate the SQL-relevant catalog query parameters shared
 * by the home page and the RSS feed. Unknown `sort` / `view` values are
 * rejected to their defaults so a typo or a hostile query can never reach
 * the SQL path; `lang` is lower-cased (`'en'` default, `'all'` skips the
 * filter).
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
    sort: KNOWN_SQL_SORTS.has(sort) ? sort : 'date',
    view: KNOWN_VIEWS.has(view) ? view : 'catalog',
  };
}

/**
 * Like {@link parseViewOptions}, but also normalises the page-only
 * filters (status / layout / search / 'rating' sort) that the catalog
 * page applies after the SQL has returned its rows. `pageSort` keeps the
 * full user choice, while {@link ViewOptions#sort} downgrades 'rating' to
 * the SQL default so the SQL path stays small.
 *
 * @public
 */
export function parsePageViewOptions(raw: RawViewParams): PageViewOptions {
  const base = parseViewOptions(raw);
  const rawSort = (raw.sort ?? 'date').toLowerCase();
  const pageSort = KNOWN_PAGE_SORTS.has(rawSort) ? rawSort : 'date';
  const status = (raw.status ?? 'all').toLowerCase();
  const layout = (raw.layout ?? 'mosaic').toLowerCase();
  const q = (raw.q ?? '').trim();
  return {
    ...base,
    pageSort,
    status: KNOWN_STATUSES.has(status) ? status : 'all',
    layout: KNOWN_LAYOUTS.has(layout) ? layout : 'mosaic',
    q,
  };
}
