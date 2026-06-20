/**
 * @packageDocumentation
 *
 * The typed database schema — the single source of truth every repository
 * composes queries against. Column names and JS keys are kept identical
 * (snake_case) so query results line up with the existing row types.
 *
 * The hand-written SQL migrations in `/migrations` remain authoritative;
 * this file mirrors their result so Drizzle can type the queries. Keep it
 * in sync when adding a migration (it matches the live D1 exactly).
 */

import {
  integer,
  real,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

import {
  FETCH_STATUSES,
  LOOKUP_STATUSES,
  QUALITIES,
  SOURCE_SLUGS,
  TMDB_STATUSES,
  TORRENT_PROVIDERS,
} from './enums';

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug', { enum: SOURCE_SLUGS }).notNull().unique(),
  base_url: text('base_url').notNull(),
});

export const movies = sqliteTable('movies', {
  imdb_id: text('imdb_id').primaryKey(),
  first_seen_at: text('first_seen_at').notNull(),
  last_seen_at: text('last_seen_at').notNull(),
});

export const releases = sqliteTable(
  'releases',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source_id: integer('source_id').notNull(),
    external_id: text('external_id').notNull(),
    imdb_id: text('imdb_id').notNull(),
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
  (t) => [unique().on(t.source_id, t.external_id)],
);

export const page_snapshots = sqliteTable('page_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source_id: integer('source_id').notNull(),
  page_number: integer('page_number').notNull(),
  page_url: text('page_url').notNull(),
  fetched_at: text('fetched_at').notNull(),
  fetcher: text('fetcher').notNull(),
  http_status: integer('http_status'),
  html: text('html').notNull(),
  byte_size: integer('byte_size').notNull(),
  response_headers: text('response_headers'),
});

export const fetch_attempts = sqliteTable('fetch_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source_id: integer('source_id').notNull(),
  page_number: integer('page_number').notNull(),
  page_url: text('page_url').notNull(),
  attempt_number: integer('attempt_number').notNull(),
  started_at: text('started_at').notNull(),
  finished_at: text('finished_at'),
  status: text('status', { enum: FETCH_STATUSES }).notNull(),
  http_status: integer('http_status'),
  error: text('error'),
  response_body: text('response_body'),
  snapshot_id: integer('snapshot_id'),
});

export const tmdb_genres = sqliteTable('tmdb_genres', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const tmdb_movies = sqliteTable('tmdb_movies', {
  imdb_id: text('imdb_id').primaryKey(),
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
});

export const tmdb_people = sqliteTable('tmdb_people', {
  id: integer('id').primaryKey(),
  name: text('name'),
  popularity: real('popularity'),
  known_for_department: text('known_for_department'),
  fetched_at: text('fetched_at').notNull(),
  raw_response: text('raw_response'),
  prestige_score: real('prestige_score'),
  total_credits: integer('total_credits'),
  raw_credits: text('raw_credits'),
});

export const torrents = sqliteTable(
  'torrents',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    imdb_id: text('imdb_id').notNull(),
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
  (t) => [unique().on(t.imdb_id, t.info_hash)],
);

export const torrent_lookups = sqliteTable('torrent_lookups', {
  imdb_id: text('imdb_id').primaryKey(),
  status: text('status', { enum: LOOKUP_STATUSES }).notNull(),
  searched_at: text('searched_at').notNull(),
  attempt_count: integer('attempt_count').notNull().default(1),
  result_count: integer('result_count').notNull().default(0),
  last_error: text('last_error'),
  raw_response: text('raw_response'),
  provider: text('provider', { enum: TORRENT_PROVIDERS }),
});

export const push_subscriptions = sqliteTable('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  created_at: text('created_at').notNull(),
  last_sent_at: text('last_sent_at'),
});
