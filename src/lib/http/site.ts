/**
 * @packageDocumentation
 *
 * The few values in the site's security headers that belong to this app and
 * not to the shared header code (`headers.ts`, `csp.ts`): which pictures the
 * pages may load from other sites, which pages search engines may index, which
 * files other sites may fetch, and which small files may be cached for a day.
 */

/**
 * The `img-src` sources. Posters come through this site's own `/api/img`, and
 * the pages draw their icons inline, so no other site is named.
 */
export const IMG_SRC = "'self' data: blob:";

/**
 * Directives only this app adds. The pages set colours, widths and background
 * pictures through `style` attributes, which a nonce cannot cover, so
 * attributes (and only attributes; `<style>` elements still need the nonce) may
 * be inline.
 */
export const EXTRA_DIRECTIVES: readonly string[] = [
  "style-src-attr 'unsafe-inline'",
];

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
