import { describe, expect, it } from '@jest/globals';

import type { MovieRow, ScoredMovie } from '../../../../src/lib/catalog';

import {
  buildFeed,
  descriptionFor,
  feedTitle,
} from '../../../../src/app/feed.xml/_lib/rss';

function row(overrides: Partial<MovieRow> = {}): MovieRow {
  return {
    imdb_id: 'tt0000001',
    tmdb_id: 1,
    tmdb_status: 'found',
    tmdb_title: 'Sample',
    tmdb_year: 2026,
    release_date: null,
    tmdb_genre_ids: null,
    poster_path: null,
    vote_average: null,
    vote_count: null,
    popularity: null,
    runtime: null,
    budget: null,
    talent_score: null,
    original_language: 'en',
    director: null,
    top_cast: null,
    production_companies: null,
    first_seen_at: '2026-06-01T00:00:00.000Z',
    release_count: 1,
    latest_release_title: null,
    latest_release_at: '2026-06-01T00:00:00.000Z',
    first_posted_at: '2026-06-01T00:00:00.000Z',
    torrent_status: null,
    torrent_count: null,
    best_info_hash: null,
    best_torrent_title: null,
    best_source: null,
    best_size_bytes: null,
    best_seeders: null,
    best_quality: null,
    ...overrides,
  };
}

function scored(overrides: Partial<MovieRow> = {}): ScoredMovie {
  return {
    row: row(overrides),
    studios: [],
    genres: [],
    cast: [],
    score: 42.5,
    tier: 'B',
    cumBytes: 0,
    fits: true,
  };
}

describe('feedTitle', () => {
  it('reflects view, language and sort', () => {
    expect(feedTitle('plan', 'all', 'date')).toBe(
      'scenery — 1 TB plan (all languages, newest first)',
    );
    expect(feedTitle('catalog', 'en', 'score')).toBe(
      'scenery — Catalog (EN, best first)',
    );
  });
});

describe('descriptionFor', () => {
  it('emits only the populated labelled fields', () => {
    const desc = descriptionFor(
      scored({
        tmdb_year: 2026,
        vote_average: 7.5,
        vote_count: 100,
        director: 'Jane Doe',
      }),
    );
    expect(desc).toContain('Score: 42.5');
    expect(desc).toContain('Year: 2026');
    expect(desc).toContain('Rating: 7.5 (100 votes)');
    expect(desc).toContain('Director: Jane Doe');
    expect(desc).not.toContain('Genres:'); // none supplied
  });
});

describe('buildFeed', () => {
  const base = {
    trackers: ['udp://t/announce'],
    view: 'catalog',
    lang: 'en',
    sort: 'date',
    selfHref: 'https://x/feed.xml?lang=en',
    altHref: 'https://x/?lang=en',
    updated: new Date('2026-06-09T00:00:00.000Z'),
  };

  it('produces a well-formed RSS 2.0 document with the self link', () => {
    const xml = buildFeed({ ...base, items: [scored()] });
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<rss');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('scenery — Catalog (EN, newest first)');
    expect(xml).toContain('rel="self"');
    expect(xml).toContain('<item>');
  });

  it('renders a magnet enclosure only when an info hash exists', () => {
    const withHash = buildFeed({
      ...base,
      items: [
        scored({ best_info_hash: 'a'.repeat(40), best_size_bytes: 1000 }),
      ],
    });
    expect(withHash).toContain('enclosure');
    expect(withHash).toContain('magnet:?xt=urn:btih:');
    expect(withHash).toContain('application/x-bittorrent');

    const without = buildFeed({ ...base, items: [scored()] });
    expect(without).not.toContain('<enclosure');
  });

  it('keeps special characters in titles safe via CDATA', () => {
    const xml = buildFeed({
      ...base,
      items: [scored({ tmdb_title: 'A & B <C>' })],
    });
    // The library wraps titles in CDATA rather than entity-escaping —
    // either is valid XML, and the raw text is preserved without breaking
    // the document.
    expect(xml).toContain('<![CDATA[A & B <C>');
  });
});
