import { CatalogRepository } from './repository';
import { ScoringEngine } from './scoring';
import type {
  CatalogStats,
  LangCount,
  LastUpdate,
  MovieRow,
  ScoredMovie,
  Tier,
  ViewOptions,
  ViewResult,
} from './types';
import { BUDGET_BYTES } from './types';
import { ViewBuilder } from './view';

export { CatalogRepository } from './repository';
export { ScoringEngine } from './scoring';
export type * from './types';
export { BUDGET_BYTES } from './types';
export { ViewBuilder } from './view';

// ----- Back-compat shims for the previous functional API. New callers
// should construct CatalogRepository / ViewBuilder explicitly. -----

/** @deprecated Use `new CatalogRepository(db).loadMovies(lang)`. @public */
export async function loadMovies(
  db: D1Database,
  lang: string,
): Promise<MovieRow[]> {
  return new CatalogRepository(db).loadMovies(lang);
}

/** @deprecated Use `new CatalogRepository(db).loadLanguageCounts()`. @public */
export async function loadLanguageCounts(db: D1Database): Promise<LangCount[]> {
  return new CatalogRepository(db).loadLanguageCounts();
}

/** @deprecated Use `new CatalogRepository(db).loadGenres()`. @public */
export async function loadGenres(db: D1Database): Promise<Map<number, string>> {
  return new CatalogRepository(db).loadGenres();
}

/** @deprecated Use `new CatalogRepository(db).loadStats()`. @public */
export async function loadStats(db: D1Database): Promise<CatalogStats> {
  return new CatalogRepository(db).loadStats();
}

/** @deprecated Use `new CatalogRepository(db).loadLastUpdate()`. @public */
export async function loadLastUpdate(db: D1Database): Promise<LastUpdate> {
  return new CatalogRepository(db).loadLastUpdate();
}

/** @deprecated Use `new ViewBuilder(repo).build(opts)`. @public */
export async function buildView(
  db: D1Database,
  opts: ViewOptions,
): Promise<ViewResult> {
  return new ViewBuilder(new CatalogRepository(db)).build(opts);
}

/** @deprecated Use `new ScoringEngine(C, M).score(row, hasPrestige)`. @public */
export function computeScore(
  m: MovieRow,
  C: number,
  M: number,
  hasPrestige: boolean,
): number {
  return new ScoringEngine(C, { M }).score(m, hasPrestige);
}

/** @deprecated Use `new ScoringEngine(C, M).tier(row, hasPrestige)`. @public */
export function tierOf(
  m: MovieRow,
  C: number,
  M: number,
  hasPrestige: boolean,
): Tier {
  return new ScoringEngine(C, { M }).tier(m, hasPrestige);
}

/** @deprecated Use `new ScoringEngine(C).prestigeStudios(raw)`. @public */
export function prestigeStudiosOf(raw: string | null): string[] {
  return new ScoringEngine(0).prestigeStudios(raw);
}

// Helpful for callers that want all three at once.
export type { ScoredMovie };
export { BUDGET_BYTES as DEFAULT_BUDGET_BYTES };
