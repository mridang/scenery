/**
 * @packageDocumentation
 *
 * What differs from one app to the next in the shared image proxy
 * (`address.ts`, `proxy.ts`, `service.ts`, `src/app/img/route.ts`): where
 * pictures may come from and the widths they are offered at. The code that
 * decides who may ask lives in `access.ts`. Everything else is the same in
 * every app.
 */

/**
 * The hosts the proxy fetches pictures from, or null for any public host. An
 * app that takes pictures from arbitrary websites must not leave the proxy
 * open to anyone, so it also checks a signature in `access.ts`. Posters and
 * backdrops come from TMDB only.
 */
export const ALLOWED_HOSTS: readonly string[] | null = ['image.tmdb.org'];

/**
 * The widths (in pixels) a page may ask for; anything else snaps up to the
 * nearest. Each is a real device-pixel size the pages use, so a caller cannot
 * iterate every integer to fill the cache.
 */
export const ALLOWED_WIDTHS: readonly number[] = [
  92, 154, 185, 342, 500, 780, 1280, 1920, 2560, 3840,
];

/** The width used when a request does not name a usable one. */
export const DEFAULT_WIDTH = 185;
