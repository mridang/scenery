import type { MovieRow, Tier } from './types';

/**
 * Half-life of the recency boost in days. Movies released this far in
 * the past get half the maximum recency points.
 *
 * @public
 */
export const RECENCY_HALF_LIFE_DAYS = 180;

/**
 * Maximum points the recency boost can contribute to a movie's score.
 *
 * @public
 */
export const RECENCY_MAX_PTS = 20;

const PRESTIGE_LABELS: Record<number, string> = {
  178: 'Netflix',
  152952: 'Apple TV+',
  192828: 'Apple TV+',
  420: 'Marvel',
  3268: 'HBO',
  7429: 'HBO',
  41077: 'A24',
  20580: 'Amazon MGM',
  210099: 'Amazon MGM',
  127928: 'Searchlight',
  7637: 'Annapurna',
  10146: 'Focus',
  90733: 'NEON',
  81: 'Plan B',
  2575: 'Disney',
  6194: 'Warner Bros',
  33: 'Universal',
  4: 'Paramount',
  21: 'Metro-Goldwyn-Mayer',
  1632: 'Lionsgate',
};

interface CompanyRef {
  id?: number;
}

/**
 * Pure scoring logic. No I/O, no module-level state — every method is
 * referentially transparent.
 *
 * @public
 */
export class ScoringEngine {
  /** Catalog mean rating for Bayesian weighting. */
  public readonly C: number;
  /** Bayesian minimum-vote threshold. */
  public readonly M: number;
  /** Reference "now" used by the recency boost (ms since epoch). */
  public readonly nowMs: number;

  public constructor(C: number, opts: { M?: number; nowMs?: number } = {}) {
    this.C = C;
    this.M = opts.M ?? 50;
    this.nowMs = opts.nowMs ?? Date.now();
  }

  /**
   * Compute the centroid (`C`) for a catalog by averaging the
   * vote_average of any movie with ≥5 votes. Falls back to 6.0 when
   * there's nothing rated yet.
   */
  public static computeCentroid(rows: MovieRow[]): number {
    const rated = rows.filter(
      (r) => r.vote_average !== null && (r.vote_count ?? 0) >= 5,
    );
    if (rated.length === 0) {
      return 6.0;
    }
    const total = rated.reduce((s, r) => s + (r.vote_average ?? 0), 0);
    return total / rated.length;
  }

  /**
   * Distinct prestige-studio labels referenced by the movie's
   * production_companies JSON. Empty when none match.
   */
  public prestigeStudios(raw: string | null): string[] {
    if (raw === null) {
      return [];
    }
    const parsed = ((): readonly CompanyRef[] => {
      try {
        return JSON.parse(raw) as CompanyRef[];
      } catch {
        return [];
      }
    })();
    const labels = parsed.flatMap((c) => {
      const label = c.id === undefined ? undefined : PRESTIGE_LABELS[c.id];
      return label === undefined ? [] : [label];
    });
    return [...new Set(labels)];
  }

  /**
   * Composite ranking score. Higher = better candidate for download.
   * Always non-negative; returns 0 for any row with `tmdb_status !== 'found'`.
   */
  public score(m: MovieRow, hasPrestige: boolean): number {
    if (m.tmdb_status !== 'found') {
      return 0;
    }
    const R = m.vote_average ?? 0;
    const v = m.vote_count ?? 0;
    const bayesian = (v / (v + this.M)) * R + (this.M / (v + this.M)) * this.C;
    const confidence = Math.min(1, Math.log10(v + 1) / 2);
    const talent = Math.min(m.talent_score ?? 0, 8) * 4;
    const budgetM = (m.budget ?? 0) / 1_000_000;
    const budgetPts = budgetM > 0 ? Math.log10(budgetM + 1) * 8 : 0;
    const prestige = hasPrestige ? 10 : 0;
    const recency = this.recencyBoost(m.release_date);
    return bayesian * 5 * confidence + talent + budgetPts + prestige + recency;
  }

  /**
   * Exponential recency decay. A movie released today gets the full
   * {@link RECENCY_MAX_PTS}; one released `RECENCY_HALF_LIFE_DAYS` days
   * ago gets half that. Pre-release movies (date in the future) cap at
   * the maximum. Missing dates contribute zero.
   */
  public recencyBoost(releaseDate: string | null): number {
    if (releaseDate === null) {
      return 0;
    }
    const t = Date.parse(releaseDate);
    if (!Number.isFinite(t)) {
      return 0;
    }
    const ageMs = this.nowMs - t;
    if (ageMs <= 0) {
      return RECENCY_MAX_PTS;
    }
    const ageDays = ageMs / 86_400_000;
    const decay = Math.exp(-(Math.LN2 * ageDays) / RECENCY_HALF_LIFE_DAYS);
    return RECENCY_MAX_PTS * decay;
  }

  /**
   * Bin a movie into one of four download-priority tiers using the
   * Bayesian-weighted rating plus the same auxiliary signals as
   * {@link score}.
   */
  public tier(m: MovieRow, hasPrestige: boolean): Tier {
    if (m.tmdb_status !== 'found') {
      return '?';
    }
    const weighted = this.weightedRating(m.vote_average, m.vote_count);
    const v = m.vote_count ?? 0;
    const t = m.talent_score ?? 0;
    const b = m.budget ?? 0;
    if (hasPrestige) {
      return 'A';
    }
    if (b >= 30_000_000) {
      return 'A';
    }
    if (t >= 5.5) {
      return 'A';
    }
    if (weighted !== null && weighted >= 6.5 && v >= 100) {
      return 'A';
    }
    if (v < 5 && t < 1 && b === 0) {
      return '?';
    }
    if (
      weighted !== null &&
      weighted < 5.0 &&
      v >= 30 &&
      t < 2 &&
      b < 5_000_000
    ) {
      return 'C';
    }
    return 'B';
  }

  private weightedRating(R: number | null, v: number | null): number | null {
    if (R === null || v === null) {
      return null;
    }
    return (v / (v + this.M)) * R + (this.M / (v + this.M)) * this.C;
  }
}
