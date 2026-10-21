/**
 * @packageDocumentation
 *
 * What differs from one app to the next in the shared HTTP code (`headers.ts`,
 * `csp.ts`, `edge-limits.ts`, `edge-cache.ts`): the pages search engines may
 * index, the pages the edge may keep a copy of (with the query names they may
 * carry and for how long), the files other sites may load, the small files
 * that may be cached for a day, the files the edge limits do not count or count
 * as discovery, and the few outside places and extra rules a page's policy
 * needs. Everything else in those files is the same in every app.
 */

/** The pages search engines may index. The whole site is private, so none. */
export const PUBLIC_PAGES: ReadonlySet<string> = new Set();

/**
 * The pages the Worker may keep a copy of at the edge and answer without waking
 * the app. The site is private (nothing is indexed), but the catalog page and its feed are the same for everyone and cost a whole-catalog read, so they are kept.
 */
export const EDGE_CACHED_PAGES: ReadonlySet<string> = new Set([
  '/',
  '/feed.xml',
]);

/**
 * The query parameter names a kept page may carry. A request with any other
 * name is never kept, and the copy is keyed by these parameters alone.
 * The names the catalog page reads (the feed reads some of them).
 */
export const CACHED_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'lang',
  'sort',
  'view',
  'status',
  'layout',
  'q',
]);

/** How long the edge may keep a page before asking the app again, in seconds. */
export const EDGE_TTL_SECONDS = 1800;

/**
 * The files other sites and browsers fetch on purpose (the social cards, the
 * icons, the manifest, the feed and the plain-text files at the root), which
 * any site may load and which are not marked noindex.
 */
export const OPEN_FILES =
  /^\/(opengraph-image\.png|twitter-image\.png|icon\.svg|apple-icon\.png|favicon\.ico|manifest\.webmanifest|robots\.txt|sitemap\.xml|feed\.xml|llms\.txt|security-policy\.txt|\.well-known\/.*|icons\/.*)$/;

/** The small files that rarely change, and for which a stale copy is harmless. */
export const RARELY_CHANGING: ReadonlySet<string> = new Set([
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-icon.png',
  '/favicon.ico',
  '/opengraph-image.png',
  '/twitter-image.png',
]);

/**
 * The outside places pages may load pictures from, besides this site (`'self'`)
 * and inline `data:` pictures.
 * None: posters come through this site's own `/api/img` and the pages draw
 * their icons inline.
 */
export const EXTRA_IMG_SOURCES: readonly string[] = [];

/**
 * Directives only this app adds to its policy.
 * The pages set colours, widths and background pictures through `style`
 * attributes, which a nonce cannot cover, so attributes (and only attributes;
 * `<style>` elements still need the nonce) may be inline.
 */
export const EXTRA_DIRECTIVES: readonly string[] = [
  "style-src-attr 'unsafe-inline'",
];

/** Paths served as static files: nothing to protect, and a page loads dozens of them. */
export const STATIC_PREFIXES: readonly string[] = ['/_next/', '/icons/'];

/** The files at the root that are read by crawlers and installers and cost nothing to serve. */
export const DISCOVERY_PATHS: ReadonlySet<string> = new Set([
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
  '/feed.xml',
  '/api/health',
]);
