/**
 * @packageDocumentation
 *
 * What the site calls itself and where it lives, in one place for the page
 * metadata, the structured data and outbound fetches (see `http/safe-fetch.ts`).
 * The first four constants are in every app; the structured-data constants
 * (category, requirements, features) are per-app values; the rest are this
 * app's own.
 */

/** The name of the site, as it appears in titles and structured data. */
export const SITE_NAME = 'Scenery';
/** The site's public address, with no trailing slash. */
export const SITE_URL = 'https://scenery.apps.mrida.ng';

/** The site's default page title. */
export const SITE_TITLE = 'Scenery';
/** The site's default description, for page metadata and structured data. */
export const SITE_DESCRIPTION =
  'A scored, ranked tracker of new movie releases — with TMDB enrichment, ' +
  'prestige/quality signals, torrents and a 1 TB download plan.';
/** The schema.org application category of the app, for the structured data. */
export const SITE_APPLICATION_CATEGORY = 'EntertainmentApplication';
/** What a visitor needs to use the app, for the structured data. */
export const SITE_REQUIREMENTS = 'Requires a modern web browser';
/** What the app does, one short sentence each, for the structured data. */
export const SITE_FEATURES: readonly string[] = [
  'A scored, ranked list of new movie releases',
  'Ratings and quality signals from TMDB, IMDb and Metacritic',
  'Torrent sources with a 1 TB download plan',
  'Filter by language, sort and subscribe to the feed',
];

/** Where the source code lives. */
export const SOURCE_URL = 'https://github.com/mridang/scenery';
/** Where people write to about their data or these terms. */
export const CONTACT_EMAIL = 'mridang.agarwalla@gmail.com';
/** The day the privacy policy last changed, for the page and the sitemap. */
export const PRIVACY_LAST_UPDATED = '2026-11-01';
/** The day the terms of service last changed, for the page and the sitemap. */
export const TERMS_LAST_UPDATED = '2026-11-01';
