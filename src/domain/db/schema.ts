/**
 * @packageDocumentation
 *
 * The typed database schema — the single source of truth every repository
 * composes queries against. Column names and JS keys are kept identical
 * (snake_case) so query results line up with the row types.
 *
 * The hand-written SQL migrations in `/migrations` remain authoritative;
 * this file mirrors their result so Drizzle can type the queries. Keep it
 * in sync when adding a migration (it matches the live D1 exactly).
 */

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

import {
  FETCH_STATUSES,
  LOOKUP_STATUSES,
  OPERATION_STATUSES,
  OPERATION_TYPES,
  QUALITIES,
  SOURCE_SLUGS,
  TMDB_STATUSES,
  TORRENT_PROVIDERS,
} from '@/utils/enums';

/** A release tracker we ingest from. Seeded by the first migration. */
export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug', { enum: SOURCE_SLUGS }).notNull().unique(),
  base_url: text('base_url').notNull(),
});

/**
 * One row per film, keyed by its IMDb id: the only identifier every source
 * shares. Everything else about a film is fetched later and lives in
 * `tmdb_movies`.
 */
export const movies = sqliteTable('movies', {
  imdb_id: text('imdb_id').primaryKey(),
  first_seen_at: text('first_seen_at').notNull(),
  last_seen_at: text('last_seen_at').notNull(),
});

/**
 * Every release post seen on a source. The same film can have several
 * (different groups, resolutions, repacks); upserts conflict on the
 * (source, external id) pair.
 */
export const releases = sqliteTable(
  'releases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_id: integer('source_id')
      .notNull()
      .references(() => sources.id),
    external_id: text('external_id').notNull(),
    imdb_id: text('imdb_id')
      .notNull()
      .references(() => movies.imdb_id),
    title: text('title').notNull(),
    url: text('url').notNull(),
    posted_at: text('posted_at'),
    posted_at_raw: text('posted_at_raw'),
    categories: text('categories'),
    author: text('author'),
    image_url: text('image_url'),
    excerpt: text('excerpt'),
    post_html: text('post_html'),
    first_seen_at: text('first_seen_at').notNull(),
    last_seen_at: text('last_seen_at').notNull(),
  },
  (table) => [
    unique().on(table.source_id, table.external_id),
    index('releases_imdb_idx').on(table.imdb_id),
    index('releases_first_seen_idx').on(table.first_seen_at),
  ],
);

/** The raw HTML of every page fetched successfully, so it can be re-parsed later. */
export const pageSnapshots = sqliteTable(
  'page_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_id: integer('source_id')
      .notNull()
      .references(() => sources.id),
    page_number: integer('page_number').notNull(),
    page_url: text('page_url').notNull(),
    fetched_at: text('fetched_at').notNull(),
    fetcher: text('fetcher').notNull(),
    http_status: integer('http_status'),
    html: text('html').notNull(),
    byte_size: integer('byte_size').notNull(),
    response_headers: text('response_headers'),
  },
  (table) => [
    index('page_snapshots_src_page_idx').on(
      table.source_id,
      table.page_number,
      table.fetched_at,
    ),
  ],
);

/**
 * Every fetch attempt, successful or not. A failed attempt keeps the
 * response body when there was one, for post-mortems.
 */
export const fetchAttempts = sqliteTable(
  'fetch_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_id: integer('source_id')
      .notNull()
      .references(() => sources.id),
    page_number: integer('page_number').notNull(),
    page_url: text('page_url').notNull(),
    attempt_number: integer('attempt_number').notNull(),
    started_at: text('started_at').notNull(),
    finished_at: text('finished_at'),
    status: text('status', { enum: FETCH_STATUSES }).notNull(),
    http_status: integer('http_status'),
    error: text('error'),
    response_body: text('response_body'),
    snapshot_id: integer('snapshot_id').references(() => pageSnapshots.id),
  },
  (table) => [
    index('fetch_attempts_src_page_idx').on(
      table.source_id,
      table.page_number,
      table.started_at,
    ),
    index('fetch_attempts_status_idx').on(table.status, table.started_at),
  ],
);

/** TMDB's genre list: id to name. */
export const tmdbGenres = sqliteTable('tmdb_genres', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

/**
 * What TMDB (and then OMDB) knows about a film, one row per film keyed by its
 * IMDb id. `status` records how the TMDB lookup went; the OMDB ratings sit on
 * the same row so the catalog view needs no extra join.
 */
export const tmdbMovies = sqliteTable(
  'tmdb_movies',
  {
    imdb_id: text('imdb_id')
      .primaryKey()
      .references(() => movies.imdb_id),
    tmdb_id: integer('tmdb_id'),
    status: text('status', { enum: TMDB_STATUSES }).notNull(),
    title: text('title'),
    original_title: text('original_title'),
    release_date: text('release_date'),
    release_year: integer('release_year'),
    overview: text('overview'),
    poster_path: text('poster_path'),
    backdrop_path: text('backdrop_path'),
    genre_ids: text('genre_ids'),
    popularity: real('popularity'),
    vote_average: real('vote_average'),
    vote_count: integer('vote_count'),
    raw_response: text('raw_response').notNull(),
    fetched_at: text('fetched_at').notNull(),
    error: text('error'),
    runtime: integer('runtime'),
    director: text('director'),
    top_cast: text('top_cast'),
    credits_fetched_at: text('credits_fetched_at'),
    raw_credits: text('raw_credits'),
    talent_score: real('talent_score'),
    cast_ids: text('cast_ids'),
    director_ids: text('director_ids'),
    budget: integer('budget'),
    revenue: integer('revenue'),
    production_companies: text('production_companies'),
    original_language: text('original_language'),
    omdb_status: text('omdb_status'),
    omdb_fetched_at: text('omdb_fetched_at'),
    omdb_raw: text('omdb_raw'),
    imdb_rating: real('imdb_rating'),
    imdb_votes: integer('imdb_votes'),
    metacritic_score: integer('metacritic_score'),
    rt_score: integer('rt_score'),
  },
  (table) => [
    index('tmdb_movies_tmdb_idx').on(table.tmdb_id),
    index('tmdb_movies_status_idx').on(table.status),
    // Films whose credits are still to be fetched.
    index('tmdb_movies_credits_pending_idx')
      .on(table.status)
      .where(sql`${table.credits_fetched_at} IS NULL`),
    index('tmdb_movies_talent_idx').on(table.talent_score),
    index('tmdb_movies_lang_idx').on(table.original_language),
  ],
);

/** A person (director or cast member) looked up on TMDB, with a prestige score. */
export const tmdbPeople = sqliteTable(
  'tmdb_people',
  {
    id: integer('id').primaryKey(),
    name: text('name'),
    popularity: real('popularity'),
    known_for_department: text('known_for_department'),
    fetched_at: text('fetched_at').notNull(),
    raw_response: text('raw_response'),
    prestige_score: real('prestige_score'),
    total_credits: integer('total_credits'),
    raw_credits: text('raw_credits'),
  },
  (table) => [
    index('tmdb_people_pop_idx').on(table.popularity),
    index('tmdb_people_prestige_idx').on(table.prestige_score),
  ],
);

/**
 * Torrents found for a film, one row per (film, info hash). `quality` is
 * parsed from the title and null when it could not be told.
 */
export const torrents = sqliteTable(
  'torrents',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    imdb_id: text('imdb_id')
      .notNull()
      .references(() => movies.imdb_id),
    info_hash: text('info_hash').notNull(),
    title: text('title').notNull(),
    raw_title: text('raw_title').notNull(),
    source: text('source'),
    seeders: integer('seeders'),
    size_bytes: integer('size_bytes'),
    quality: text('quality', { enum: QUALITIES }),
    is_hdr: integer('is_hdr').notNull().default(0),
    is_remux: integer('is_remux').notNull().default(0),
    fetched_at: text('fetched_at').notNull(),
  },
  (table) => [
    unique().on(table.imdb_id, table.info_hash),
    index('torrents_imdb_idx').on(table.imdb_id),
    index('torrents_imdb_seeders_idx').on(table.imdb_id, table.seeders),
  ],
);

/** The outcome of the latest torrent search for a film, so it is not searched again too soon. */
export const torrentLookups = sqliteTable(
  'torrent_lookups',
  {
    imdb_id: text('imdb_id')
      .primaryKey()
      .references(() => movies.imdb_id),
    status: text('status', { enum: LOOKUP_STATUSES }).notNull(),
    searched_at: text('searched_at').notNull(),
    attempt_count: integer('attempt_count').notNull().default(1),
    result_count: integer('result_count').notNull().default(0),
    last_error: text('last_error'),
    raw_response: text('raw_response'),
    provider: text('provider', { enum: TORRENT_PROVIDERS }),
  },
  (table) => [index('torrent_lookups_provider_idx').on(table.provider)],
);

/**
 * One Web Push subscription per browser that opted in to the daily
 * notification, keyed by its push endpoint. Removed when the endpoint answers
 * 410 Gone.
 */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  created_at: text('created_at').notNull(),
  last_sent_at: text('last_sent_at'),
});

/**
 * One run of an operator operation. `parameters` and `result` are JSON text;
 * the timestamps are RFC 3339.
 */
export const operations = sqliteTable('operations', {
  id: text('id').primaryKey(),
  type: text('type', { enum: OPERATION_TYPES }).notNull(),
  status: text('status', { enum: OPERATION_STATUSES }).notNull(),
  parameters: text('parameters').notNull(),
  result: text('result'),
  created_at: text('created_at').notNull(),
  finished_at: text('finished_at'),
});
