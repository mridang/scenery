import { describe, expect, it } from '@jest/globals';

import {
  labelsForPrestigeIds,
  PRESTIGE_IDS,
  PRESTIGE_LABELS,
} from '@/domain/catalog/prestige';

describe('labelsForPrestigeIds', () => {
  it('returns [] for null', () => {
    expect(labelsForPrestigeIds(null)).toEqual([]);
  });

  it('returns [] for an empty string', () => {
    expect(labelsForPrestigeIds('')).toEqual([]);
  });

  it('returns [] for unparseable JSON', () => {
    expect(labelsForPrestigeIds('[not json')).toEqual([]);
  });

  it('returns [] when the JSON is not an array', () => {
    expect(labelsForPrestigeIds('{"a":1}')).toEqual([]);
    expect(labelsForPrestigeIds('42')).toEqual([]);
  });

  it('returns [] for an empty array', () => {
    expect(labelsForPrestigeIds('[]')).toEqual([]);
  });

  it('maps known ids to their labels', () => {
    expect(labelsForPrestigeIds('[178,41077]')).toEqual(['Netflix', 'A24']);
  });

  it('drops ids with no label', () => {
    expect(labelsForPrestigeIds('[178,999999]')).toEqual(['Netflix']);
  });

  it('dedupes ids that share a label (3268 & 7429 -> HBO)', () => {
    expect(labelsForPrestigeIds('[3268,7429]')).toEqual(['HBO']);
  });

  it('dedupes Apple TV+ across its two ids', () => {
    expect(labelsForPrestigeIds('[152952,192828]')).toEqual(['Apple TV+']);
  });

  it('preserves first-seen order while deduping', () => {
    expect(labelsForPrestigeIds('[7429,178,3268]')).toEqual(['HBO', 'Netflix']);
  });
});

describe('PRESTIGE_IDS', () => {
  it('is derived from the label map keys as numbers', () => {
    expect(PRESTIGE_IDS).toEqual(Object.keys(PRESTIGE_LABELS).map(Number));
  });

  it('contains only numbers', () => {
    expect(PRESTIGE_IDS.every((id) => typeof id === 'number')).toBe(true);
  });

  it('includes the HBO ids', () => {
    expect(PRESTIGE_IDS).toContain(3268);
    expect(PRESTIGE_IDS).toContain(7429);
  });
});
