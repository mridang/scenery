import { describe, expect, it } from '@jest/globals';

import { TorrentioProvider } from '../../../../src/lib/torrents/providers/torrentio';

const transportOf = (
  body: unknown,
  init: { status?: number } = {},
): typeof fetch =>
  (() =>
    Promise.resolve(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
    )) as typeof fetch;

/** Returns the item at `index`, failing the test loudly when it is absent. */
function nth<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`expected an item at index ${index}`);
  }
  return item;
}

describe('TorrentioProvider', () => {
  it("returns 'empty' when streams array is empty", async () => {
    const r = await new TorrentioProvider(transportOf({ streams: [] })).search(
      'tt0000001',
    );
    expect(r.status).toBe('empty');
    expect(r.torrents).toEqual([]);
  });

  it('parses seeders, size, source, quality from the emoji-delimited title', async () => {
    const r = await new TorrentioProvider(
      transportOf({
        streams: [
          {
            name: 'Torrentio\n1080p',
            title:
              'Project.Hail.Mary.2026.1080p.WEB-DL.HDR.x265-CMRG\n👤 852 💾 5.4 GB ⚙️ 1337x',
            infoHash: 'AAAA1234',
          },
        ],
      }),
    ).search('tt12042730');
    expect(r.status).toBe('success');
    expect(r.torrents).toHaveLength(1);
    const t = nth(r.torrents, 0);
    expect(t.infoHash).toBe('aaaa1234');
    expect(t.seeders).toBe(852);
    expect(t.sizeBytes).toBe(5_400_000_000);
    expect(t.source).toBe('1337x');
    expect(t.quality).toBe('1080p');
    expect(t.isHdr).toBe(true);
  });

  it("returns 'error' on non-2xx", async () => {
    const r = await new TorrentioProvider(
      transportOf('oops', { status: 502 }),
    ).search('tt0000001');
    expect(r.status).toBe('error');
    expect(r.httpStatus).toBe(502);
  });

  it("returns 'error' on network failure without throwing", async () => {
    const transport = (() =>
      Promise.reject(new Error('ECONNRESET'))) as typeof fetch;
    const r = await new TorrentioProvider(transport).search('tt0000001');
    expect(r.status).toBe('error');
    expect(r.error).toContain('ECONNRESET');
  });
});
