import { describe, expect, it } from '@jest/globals';

import {
  RUN_TIMEOUT_MS,
  isOperationId,
  operationResource,
} from '@/domain/operations/operation-resource';
import type { OperationRow } from '@/domain/operations/repository';

const row = (over: Partial<OperationRow> = {}): OperationRow => ({
  id: '0b8a3f1e-5a53-4a5c-8a1c-0a6c8d8f6a11',
  type: 'omdb_backfill',
  status: 'succeeded',
  parameters: '{"limit":25}',
  result: '{"scanned":3}',
  created_at: '2026-10-21T01:02:03.000Z',
  finished_at: '2026-10-21T01:02:09.000Z',
  ...over,
});

describe('operationResource', () => {
  it('shows the stored JSON as objects, with RFC 3339 times', () => {
    expect(operationResource(row())).toEqual({
      id: '0b8a3f1e-5a53-4a5c-8a1c-0a6c8d8f6a11',
      type: 'omdb_backfill',
      status: 'succeeded',
      parameters: { limit: 25 },
      result: { scanned: 3 },
      created_at: '2026-10-21T01:02:03.000Z',
      finished_at: '2026-10-21T01:02:09.000Z',
    });
  });

  it('leaves out the result and end time of an operation still running', () => {
    expect(
      operationResource(
        row({ status: 'running', result: null, finished_at: null }),
        Date.parse('2026-10-21T01:02:04.000Z'),
      ),
    ).toEqual({
      id: '0b8a3f1e-5a53-4a5c-8a1c-0a6c8d8f6a11',
      type: 'omdb_backfill',
      status: 'running',
      parameters: { limit: 25 },
      created_at: '2026-10-21T01:02:03.000Z',
    });
  });
});

describe('operationResource for a run that was cut short', () => {
  const running = row({ status: 'running', result: null, finished_at: null });
  const started = Date.parse(running.created_at);

  it('still shows a recent run as running', () => {
    expect(operationResource(running, started + RUN_TIMEOUT_MS).status).toBe(
      'running',
    );
  });

  it('shows a run unfinished after the timeout as failed, with no end time made up', () => {
    const shown = operationResource(running, started + RUN_TIMEOUT_MS + 1);
    expect(shown.status).toBe('failed');
    expect(shown.result).toEqual({ error: 'The run did not finish.' });
    expect(shown).not.toHaveProperty('finished_at');
  });

  it('leaves a finished run alone however old it is', () => {
    expect(operationResource(row(), started + 10 * RUN_TIMEOUT_MS).status).toBe(
      'succeeded',
    );
  });
});

describe('isOperationId', () => {
  it('accepts a lowercase UUID only', () => {
    expect(isOperationId(crypto.randomUUID())).toBe(true);
    expect(isOperationId(crypto.randomUUID().toUpperCase())).toBe(false);
    expect(isOperationId('1; DROP TABLE operations')).toBe(false);
    expect(isOperationId('')).toBe(false);
  });
});
