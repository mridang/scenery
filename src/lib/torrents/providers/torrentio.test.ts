import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TorrentioProvider } from './torrentio';

const realFetch = globalThis.fetch;

function stubFetch(body: unknown, opts: { status?: number } = {}): void {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  globalThis.fetch = jest.fn(() =>
    Promise.resolve(
      new Response(text, {
        status: opts.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  ) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('TorrentioProvider', () => {
  it("returns 'empty' when streams array is empty", async () => {
    stubFetch({ streams: [] });
    const r = await new TorrentioProvider().search('tt0000001');
    expect(r.status).toBe('empty');
    expect(r.torrents).toEqual([]);
  });

  it('parses seeders, size, source, quality from the emoji-delimited title', async () => {
    stubFetch({
      streams: [
        {
          name: 'Torrentio\n1080p',
          title:
            'Project.Hail.Mary.2026.1080p.WEB-DL.HDR.x265-CMRG\n👤 852 💾 5.4 GB ⚙️ 1337x',
          infoHash: 'AAAA1234',
        },
      ],
    });
    const r = await new TorrentioProvider().search('tt12042730');
    expect(r.status).toBe('success');
    expect(r.torrents).toHaveLength(1);
    const t = r.torrents[0];
    expect(t.infoHash).toBe('aaaa1234');
    expect(t.seeders).toBe(852);
    expect(t.sizeBytes).toBe(5_400_000_000);
    expect(t.source).toBe('1337x');
    expect(t.quality).toBe('1080p');
    expect(t.isHdr).toBe(true);
  });

  it("returns 'error' on non-2xx", async () => {
    stubFetch('oops', { status: 502 });
    const r = await new TorrentioProvider().search('tt0000001');
    expect(r.status).toBe('error');
    expect(r.httpStatus).toBe(502);
  });

  it("returns 'error' on network failure without throwing", async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.reject(new Error('ECONNRESET')),
    ) as typeof fetch;
    const r = await new TorrentioProvider().search('tt0000001');
    expect(r.status).toBe('error');
    expect(r.error).toContain('ECONNRESET');
  });
});
