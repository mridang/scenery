import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { logError, logInfo, logWarn } from '../../../src/lib/util/logging';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('structured logging', () => {
  it('logInfo emits exactly one JSON line to console.log', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    logInfo({ event: 'torrent.lookup', status: 'ok' });

    expect(log).toHaveBeenCalledTimes(1);
    expect(err).not.toHaveBeenCalled();

    const line = log.mock.calls[0][0] as string;
    expect(typeof line).toBe('string');
    expect(line.includes('\n')).toBe(false);

    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('torrent.lookup');
    expect(parsed.status).toBe('ok');
    expect(typeof parsed.ts).toBe('string');
    expect(Number.isNaN(Date.parse(parsed.ts as string))).toBe(false);
  });

  it('logWarn emits one warn-level line to console.error', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    logWarn({ event: 'torrent.lookup' });

    expect(log).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledTimes(1);

    const parsed = JSON.parse(err.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;
    expect(parsed.level).toBe('warn');
    expect(parsed.event).toBe('torrent.lookup');
    expect(typeof parsed.ts).toBe('string');
  });

  it('logError emits one error-level line to console.error', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const err = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    logError({ event: 'torrent.lookup' });

    expect(log).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalledTimes(1);

    const parsed = JSON.parse(err.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;
    expect(parsed.level).toBe('error');
  });

  it('preserves extra fields verbatim', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    logInfo({ event: 'x', count: 3, nested: { a: 1 } });

    const parsed = JSON.parse(log.mock.calls[0][0] as string) as Record<
      string,
      unknown
    >;
    expect(parsed.count).toBe(3);
    expect(parsed.nested).toEqual({ a: 1 });
  });
});
