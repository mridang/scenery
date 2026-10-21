import { describe, expect, it } from '@jest/globals';

import { parsePipelineRunInput } from '../../../src/lib/api/pipeline-run-input';

describe('parsePipelineRunInput', () => {
  it('defaults to every step, no backfill and every provider', () => {
    const parsed = parsePipelineRunInput({});
    expect(parsed).toMatchObject({ ok: true });
    if (!parsed.ok) throw new Error('unreachable');
    expect([...parsed.input.steps]).toEqual(['scrape', 'enrich', 'torrents']);
    expect(parsed.input.backfillPages).toBe(0);
    expect(parsed.input.source).toBeUndefined();
    expect(parsed.input.torrentProviders).toBeUndefined();
  });

  it('reads the members it knows', () => {
    const parsed = parsePipelineRunInput({
      source: 'scnsrc',
      backfillPages: 10,
      steps: ['enrich'],
      torrentProviders: ['apibay'],
    });
    if (!parsed.ok) throw new Error('unreachable');
    expect(parsed.input).toMatchObject({
      source: 'scnsrc',
      backfillPages: 10,
      torrentProviders: ['apibay'],
    });
    expect([...parsed.input.steps]).toEqual(['enrich']);
  });

  it('names an unknown member as an error', () => {
    expect(parsePipelineRunInput({ backfill: 10 })).toEqual({
      ok: false,
      errors: ['backfill: unknown member.'],
    });
  });

  it.each([
    [{ backfillPages: -1 }, 'backfillPages'],
    [{ backfillPages: 1.5 }, 'backfillPages'],
    [{ backfillPages: '3' }, 'backfillPages'],
    [{ source: '' }, 'source'],
    [{ source: 4 }, 'source'],
    [{ steps: ['nope'] }, 'steps'],
    [{ steps: 'enrich' }, 'steps'],
    [{ torrentProviders: ['piratebay'] }, 'torrentProviders'],
  ])('refuses %j', (body, member) => {
    const parsed = parsePipelineRunInput(body);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error('unreachable');
    expect(parsed.errors[0]).toMatch(new RegExp(`^${member}:`));
  });

  it.each([null, [], 'x', 3])('refuses a body that is %j', (body) => {
    expect(parsePipelineRunInput(body).ok).toBe(false);
  });
});
