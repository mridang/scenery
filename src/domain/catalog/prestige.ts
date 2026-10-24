/**
 * Prestige-studio recognition. The catalog query awards a scoring bonus
 * and an 'A' tier to movies from these studios, and the UI shows their
 * names as badges. The TMDB production-company id is the key.
 *
 * This is the single source of truth for both halves: the SQL scoring
 * query reads {@link PRESTIGE_IDS} for its `IN (...)` membership test,
 * and the view layer reads {@link PRESTIGE_LABELS} to turn the ids a row
 * matched back into display names.
 *
 * @public
 */
export const PRESTIGE_LABELS: Readonly<Record<number, string>> = {
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

/** Every recognised prestige-studio id, for the SQL membership test. */
export const PRESTIGE_IDS: readonly number[] =
  Object.keys(PRESTIGE_LABELS).map(Number);

/**
 * Map the prestige-studio ids a row matched (a JSON array string the
 * catalog query produced via `json_group_array`, e.g. `"[210099,3268]"`)
 * to their distinct display labels. Returns `[]` for null / empty /
 * unparseable input. Two ids that share a label (HBO is 3268 and 7429)
 * collapse to one.
 */
export function labelsForPrestigeIds(json: string | null): string[] {
  if (json === null) {
    return [];
  }
  const ids = ((): readonly number[] => {
    try {
      const parsed: unknown = JSON.parse(json);
      return Array.isArray(parsed) ? (parsed as number[]) : [];
    } catch {
      return [];
    }
  })();
  const labels = ids.flatMap((id) => {
    const label = PRESTIGE_LABELS[id];
    return label === undefined ? [] : [label];
  });
  return [...new Set(labels)];
}
