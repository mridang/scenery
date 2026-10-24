/**
 * @packageDocumentation
 *
 * What the site calls itself and where it lives, in one place for the page
 * metadata, the structured data and outbound fetches (see `http/safe-fetch.ts`).
 * The first four constants are in every app; the rest are this app's own.
 */

/** The name of the site, as it appears in titles and structured data. */
export const SITE_NAME = 'scenery';
/** The site's public address, with no trailing slash. */
export const SITE_URL = 'https://scenery.apps.mrida.ng';

/** The site's default page title. */
export const SITE_TITLE = 'scenery';
/** The site's default description, for page metadata and structured data. */
export const SITE_DESCRIPTION =
  'A scored, ranked tracker of new movie releases — with TMDB enrichment, ' +
  'prestige/quality signals, torrents and a 1 TB download plan.';
