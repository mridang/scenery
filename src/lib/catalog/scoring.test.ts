import { describe, expect, it } from '@jest/globals';

import {
  RECENCY_HALF_LIFE_DAYS,
  RECENCY_MAX_PTS,
  ScoringEngine,
} from './scoring';
import type { MovieRow } from './types';

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
    latest_release_at: null,
    first_posted_at: null,
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

describe('ScoringEngine.computeCentroid', () => {
  it('returns 6.0 when no rated rows', () => {
    expect(ScoringEngine.computeCentroid([])).toBe(6.0);
    expect(ScoringEngine.computeCentroid([row()])).toBe(6.0);
  });
  it('excludes rows with under 5 votes', () => {
    const rows = [
      row({ vote_average: 9, vote_count: 1 }), // ignored
      row({ vote_average: 6, vote_count: 100 }),
      row({ vote_average: 8, vote_count: 200 }),
    ];
    expect(ScoringEngine.computeCentroid(rows)).toBe(7);
  });
});

describe('ScoringEngine.prestigeStudios', () => {
  it('returns empty for null/invalid', () => {
    const e = new ScoringEngine(6);
    expect(e.prestigeStudios(null)).toEqual([]);
    expect(e.prestigeStudios('not json')).toEqual([]);
  });
  it('dedupes labels mapped from multiple ids', () => {
    const e = new ScoringEngine(6);
    // 3268 + 7429 both map to HBO; 41077 -> A24
    const labels = e.prestigeStudios(
      JSON.stringify([{ id: 3268 }, { id: 7429 }, { id: 41077 }]),
    );
    expect(labels).toEqual(['HBO', 'A24']);
  });
});

describe('ScoringEngine.recencyBoost', () => {
  const now = Date.parse('2026-06-07T00:00:00.000Z');
  it('returns 0 for null release date', () => {
    const e = new ScoringEngine(6, { nowMs: now });
    expect(e.recencyBoost(null)).toBe(0);
  });
  it('returns max for pre-release (future) dates', () => {
    const e = new ScoringEngine(6, { nowMs: now });
    expect(e.recencyBoost('2027-01-01')).toBe(RECENCY_MAX_PTS);
  });
  it('returns half the maximum at the half-life', () => {
    const e = new ScoringEngine(6, { nowMs: now });
    const halfLifeAgo = new Date(
      now - RECENCY_HALF_LIFE_DAYS * 86_400_000,
    ).toISOString();
    expect(e.recencyBoost(halfLifeAgo)).toBeCloseTo(RECENCY_MAX_PTS / 2, 5);
  });
  it('decays monotonically with age', () => {
    const e = new ScoringEngine(6, { nowMs: now });
    const a = e.recencyBoost(new Date(now - 30 * 86_400_000).toISOString());
    const b = e.recencyBoost(new Date(now - 365 * 86_400_000).toISOString());
    expect(a).toBeGreaterThan(b);
  });
});

describe('ScoringEngine.score', () => {
  const now = Date.parse('2026-06-07T00:00:00.000Z');
  const e = new ScoringEngine(6, { nowMs: now });

  it("returns 0 for movies that aren't 'found'", () => {
    expect(e.score(row({ tmdb_status: 'not_found' }), false)).toBe(0);
    expect(e.score(row({ tmdb_status: null }), false)).toBe(0);
  });

  it('rises with vote_count when rating is constant', () => {
    const lo = e.score(row({ vote_average: 7, vote_count: 10 }), false);
    const hi = e.score(row({ vote_average: 7, vote_count: 10_000 }), false);
    expect(hi).toBeGreaterThan(lo);
  });

  it('adds prestige bonus', () => {
    const withoutP = e.score(row({ vote_average: 6, vote_count: 100 }), false);
    const withP = e.score(row({ vote_average: 6, vote_count: 100 }), true);
    expect(withP - withoutP).toBeCloseTo(10, 5);
  });

  it("adds budget contribution that's log-scaled", () => {
    const noBudget = e.score(row({ budget: 0 }), false);
    const small = e.score(row({ budget: 1_000_000 }), false);
    const huge = e.score(row({ budget: 200_000_000 }), false);
    expect(small).toBeGreaterThan(noBudget);
    expect(huge).toBeGreaterThan(small);
    // Logarithmic, so 200x budget < 200x score contribution.
    expect(huge - noBudget).toBeLessThan(20 * (small - noBudget));
  });
});

describe('ScoringEngine.tier', () => {
  const now = Date.parse('2026-06-07T00:00:00.000Z');
  const e = new ScoringEngine(6, { nowMs: now });

  it('returns ? for not_found', () => {
    expect(e.tier(row({ tmdb_status: 'not_found' }), false)).toBe('?');
  });
  it('prestige → A regardless of votes', () => {
    expect(e.tier(row({ vote_average: 3, vote_count: 1000 }), true)).toBe('A');
  });
  it('$30M+ budget → A', () => {
    expect(e.tier(row({ vote_count: 0, budget: 30_000_000 }), false)).toBe('A');
  });
  it('high talent → A', () => {
    expect(e.tier(row({ vote_count: 0, talent_score: 6 }), false)).toBe('A');
  });
  it('low rating + many votes → C', () => {
    expect(
      e.tier(
        row({ vote_average: 4, vote_count: 100, budget: 0, talent_score: 0 }),
        false,
      ),
    ).toBe('C');
  });
  it('untested (no votes, no signal) → ?', () => {
    expect(
      e.tier(row({ vote_count: 0, talent_score: 0, budget: 0 }), false),
    ).toBe('?');
  });
});
