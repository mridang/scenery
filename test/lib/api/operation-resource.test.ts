import { describe, expect, it } from '@jest/globals';

import {
  isOperationId,
  operationResource,
} from '../../../src/lib/api/operation-resource';
import type { OperationRow } from '../../../src/lib/operations/repository';

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

describe('isOperationId', () => {
  it('accepts a lowercase UUID only', () => {
    expect(isOperationId(crypto.randomUUID())).toBe(true);
    expect(isOperationId(crypto.randomUUID().toUpperCase())).toBe(false);
    expect(isOperationId('1; DROP TABLE operations')).toBe(false);
    expect(isOperationId('')).toBe(false);
  });
});
