/**
 * @packageDocumentation
 *
 * What differs from one app to the next in the shared HTTP code (`headers.ts`,
 * `csp.ts`, `edge-limits.ts`, `edge-cache.ts`): the pages search engines may
 * index (and the edge may keep a copy of), the files other sites may load, the
 * small files that may be cached for a day, the files the edge limits do not
 * count or count as discovery, and the few outside places and extra rules a
 * page's policy needs. Everything else in those files is the same in every app.
 */

/** The pages search engines may index. The whole site is private, so none. */
export const PUBLIC_PAGES: ReadonlySet<string> = new Set();

/**
 * The files other sites and browsers fetch on purpose (icons, the manifest,
 * the feed), which any site may load.
 */
export const OPEN_FILES =
  /^\/(favicon\.ico|favicon-\d+x\d+\.png|android-chrome-\d+x\d+\.png|apple-touch-icon\.png|icon\.png|icon\.svg|site\.webmanifest|feed\.xml|icons\/.*)$/;

/** The small files that rarely change, and for which a stale copy is harmless. */
export const RARELY_CHANGING: ReadonlySet<string> = new Set([
  '/site.webmanifest',
  '/icon.svg',
  '/icon.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
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
