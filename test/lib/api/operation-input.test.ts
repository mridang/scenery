import { describe, expect, it } from '@jest/globals';

import { parseOperationInput } from '../../../src/lib/api/operation-input';

const errorsOf = (body: Record<string, unknown>): readonly string[] => {
  const input = parseOperationInput(body);
  return input.ok ? [] : input.errors;
};

describe('parseOperationInput', () => {
  it('runs every pipeline step on page 1 when asked for a bare pipeline_run', () => {
    expect(parseOperationInput({ type: 'pipeline_run' })).toEqual({
      ok: true,
      request: {
        type: 'pipeline_run',
        parameters: {
          backfill_pages: 0,
          steps: ['scrape', 'enrich', 'torrents'],
        },
      },
    });
  });

  it('keeps the parameters a pipeline_run is given', () => {
    expect(
      parseOperationInput({
        type: 'pipeline_run',
        parameters: {
          source: 'scnsrc',
          backfill_pages: 10,
          steps: ['enrich'],
          torrent_providers: ['apibay'],
        },
      }),
    ).toEqual({
      ok: true,
      request: {
        type: 'pipeline_run',
        parameters: {
          source: 'scnsrc',
          backfill_pages: 10,
          steps: ['enrich'],
          torrent_providers: ['apibay'],
        },
      },
    });
  });

  it.each([
    [{ source: 'nope' }, 'parameters.source: one of scnsrc, ddlvalley.'],
    [
      { backfill_pages: -1 },
      'parameters.backfill_pages: a whole number from 0 to 100.',
    ],
    [
      { backfill_pages: 101 },
      'parameters.backfill_pages: a whole number from 0 to 100.',
    ],
    [
      { backfill_pages: 1.5 },
      'parameters.backfill_pages: a whole number from 0 to 100.',
    ],
    [
      { steps: [] },
      'parameters.steps: a non-repeating list of scrape, enrich, torrents.',
    ],
    [
      { steps: ['scrape', 'scrape'] },
      'parameters.steps: a non-repeating list of scrape, enrich, torrents.',
    ],
    [
      { steps: ['dance'] },
      'parameters.steps: a non-repeating list of scrape, enrich, torrents.',
    ],
    [
      { torrent_providers: ['bittorrent'] },
      'parameters.torrent_providers: a non-repeating list of apibay, torrentio.',
    ],
    [
      { backfillPages: 3 },
      'parameters.backfillPages: not a parameter of this operation.',
    ],
  ])('refuses the pipeline_run parameters %j', (parameters, message) => {
    expect(errorsOf({ type: 'pipeline_run', parameters })).toEqual([message]);
  });

  it('sweeps 25 movies unless an omdb_backfill says otherwise', () => {
    expect(parseOperationInput({ type: 'omdb_backfill' })).toMatchObject({
      ok: true,
      request: { parameters: { limit: 25 } },
    });
    expect(
      parseOperationInput({
        type: 'omdb_backfill',
        parameters: { limit: 200 },
      }),
    ).toMatchObject({ ok: true, request: { parameters: { limit: 200 } } });
  });

  it.each([0, 201, 2.5, '5'])(
    'refuses an omdb_backfill limit of %j',
    (limit) => {
      expect(
        errorsOf({ type: 'omdb_backfill', parameters: { limit } }),
      ).toEqual(['parameters.limit: a whole number from 1 to 200.']);
    },
  );

  it('takes no parameters for a push_trigger', () => {
    expect(parseOperationInput({ type: 'push_trigger' })).toEqual({
      ok: true,
      request: { type: 'push_trigger', parameters: {} },
    });
    expect(
      errorsOf({ type: 'push_trigger', parameters: { limit: 1 } }),
    ).toEqual(['parameters.limit: not a parameter of this operation.']);
  });

  it('refuses a type that is not on the list, naming the ones that are', () => {
    expect(errorsOf({ type: 'rm_rf' })).toEqual([
      'type: one of pipeline_run, omdb_backfill, push_trigger.',
    ]);
    expect(errorsOf({})).toEqual([
      'type: one of pipeline_run, omdb_backfill, push_trigger.',
    ]);
  });

  it('refuses members it does not know and parameters that are not an object', () => {
    expect(errorsOf({ type: 'push_trigger', run_at: 'noon' })).toEqual([
      'run_at: not a member of an operation.',
    ]);
    expect(errorsOf({ type: 'push_trigger', parameters: [] })).toEqual([
      'parameters: must be an object.',
    ]);
  });
});
