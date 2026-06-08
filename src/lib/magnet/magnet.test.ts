import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  bestTrackers,
  buildMagnet,
  FALLBACK_TRACKERS,
  isValidInfoHash,
  magnetPath,
  resetTrackerCache,
} from './magnet';

describe('isValidInfoHash', () => {
  it('accepts 40-char hex (v1) hashes', () => {
    expect(isValidInfoHash('0'.repeat(40))).toBe(true);
    expect(isValidInfoHash('abcdef0123456789ABCDEF0123456789abcdef01')).toBe(
      true,
    );
  });
  it('accepts 32-char base32 hashes', () => {
    expect(isValidInfoHash('A'.repeat(32))).toBe(true);
  });
  it('rejects wrong length or bad characters', () => {
    expect(isValidInfoHash('xyz')).toBe(false);
    expect(isValidInfoHash('0'.repeat(39))).toBe(false);
    expect(isValidInfoHash('g'.repeat(40))).toBe(false); // g not hex/base32
    expect(isValidInfoHash('../etc/passwd')).toBe(false);
  });
});

describe('buildMagnet', () => {
  const hash = '0'.repeat(40);
  it('includes xt, encoded dn and each tracker', () => {
    const m = buildMagnet(hash, 'My Movie (2026)', ['udp://t1', 'udp://t2']);
    expect(m).toContain(`xt=urn:btih:${hash}`);
    expect(m).toContain('dn=My%20Movie%20(2026)');
    expect(m).toContain('tr=udp%3A%2F%2Ft1');
    expect(m).toContain('tr=udp%3A%2F%2Ft2');
  });
  it('omits dn when name is null or empty', () => {
    expect(buildMagnet(hash, null, [])).toBe(`magnet:?xt=urn:btih:${hash}`);
    expect(buildMagnet(hash, '', [])).toBe(`magnet:?xt=urn:btih:${hash}`);
  });
});

describe('magnetPath', () => {
  it('points at the resolver endpoint with an encoded name', () => {
    expect(magnetPath('abc', 'A & B')).toBe('/magnet/abc?dn=A%20%26%20B');
  });
  it('omits the query when there is no name', () => {
    expect(magnetPath('abc', null)).toBe('/magnet/abc');
  });
});

describe('bestTrackers', () => {
  beforeEach(() => resetTrackerCache());

  const ok = (body: string): typeof fetch =>
    (() =>
      Promise.resolve(new Response(body, { status: 200 }))) as typeof fetch;

  it('parses non-empty lines from the fetched list', async () => {
    const transport = ok('udp://a\n\n  udp://b  \nudp://c\n');
    const trackers = await bestTrackers(transport);
    expect(trackers).toEqual(['udp://a', 'udp://b', 'udp://c']);
  });

  it('falls back when the request errors', async () => {
    const transport = (() =>
      Promise.reject(new Error('network'))) as typeof fetch;
    expect(await bestTrackers(transport)).toEqual(FALLBACK_TRACKERS);
  });

  it('falls back on a non-200 response', async () => {
    const transport = (() =>
      Promise.resolve(new Response('', { status: 503 }))) as typeof fetch;
    expect(await bestTrackers(transport)).toEqual(FALLBACK_TRACKERS);
  });
});
