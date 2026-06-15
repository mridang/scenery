import { describe, expect, it } from '@jest/globals';

import { ApibayProvider } from '../../../../src/lib/torrents/providers/apibay';

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

const EMPTY_HASH = '0000000000000000000000000000000000000000';

describe('ApibayProvider', () => {
  it('parses a canned apibay response into the provider result shape', async () => {
    const r = await new ApibayProvider(
      transportOf([
        {
          id: '1',
          name: 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR-FraMeSToR',
          info_hash: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01',
          leechers: '5',
          seeders: '120',
          num_files: '3',
          size: '54000000000',
          username: 'uploader',
          added: '1700000000',
          status: 'vip',
          category: '207',
          imdb: 'tt15239678',
        },
        {
          id: '2',
          name: 'Dune.Part.Two.2024.1080p.WEB-DL.x264-GROUP',
          info_hash: 'FEDCBA9876543210FEDCBA9876543210FEDCBA98',
          leechers: '2',
          seeders: '40',
          num_files: '1',
          size: '8500000000',
          username: 'uploader2',
          added: '1700000001',
          status: 'member',
          category: '201',
          imdb: 'tt15239678',
        },
      ]),
    ).search('tt15239678');

    expect(r.status).toBe('success');
    expect(r.torrents).toHaveLength(2);

    const first = r.torrents[0];
    expect(first.infoHash).toBe('abcdef0123456789abcdef0123456789abcdef01');
    expect(first.title).toBe(
      'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR-FraMeSToR',
    );
    expect(first.source).toBe('ThePirateBay');
    expect(first.seeders).toBe(120);
    expect(first.sizeBytes).toBe(54000000000);
    expect(first.quality).toBe('2160p');
    expect(first.isHdr).toBe(true);
    expect(first.isRemux).toBe(true);

    const second = r.torrents[1];
    expect(second.quality).toBe('1080p');
    expect(second.isHdr).toBe(false);
    expect(second.isRemux).toBe(false);
    expect(second.seeders).toBe(40);
  });

  it("returns 'empty' for the apibay no-results sentinel row", async () => {
    const r = await new ApibayProvider(
      transportOf([
        {
          id: '0',
          name: 'No results returned',
          info_hash: EMPTY_HASH,
          leechers: '0',
          seeders: '0',
          num_files: '0',
          size: '0',
          username: '',
          added: '0',
          status: '',
          category: '0',
          imdb: '',
        },
      ]),
    ).search('tt0000001');

    expect(r.status).toBe('empty');
    expect(r.torrents).toEqual([]);
  });

  it('treats non-finite seeders and zero size as null', async () => {
    const r = await new ApibayProvider(
      transportOf([
        {
          id: '1',
          name: 'Movie.2026.720p.WEBRip',
          info_hash: 'AA00000000000000000000000000000000000001',
          leechers: '0',
          seeders: 'not-a-number',
          num_files: '1',
          size: '0',
          username: 'u',
          added: '1',
          status: 'member',
          category: '201',
          imdb: 'tt0000002',
        },
      ]),
    ).search('tt0000002');

    expect(r.status).toBe('success');
    expect(r.torrents).toHaveLength(1);
    expect(r.torrents[0].seeders).toBeNull();
    expect(r.torrents[0].sizeBytes).toBeNull();
    expect(r.torrents[0].quality).toBe('720p');
  });

  it("returns 'error' on a non-2xx response", async () => {
    const r = await new ApibayProvider(
      transportOf('upstream down', { status: 503 }),
    ).search('tt0000001');

    expect(r.status).toBe('error');
    expect(r.httpStatus).toBe(503);
    expect(r.error).toContain('503');
  });

  it("returns 'error' on malformed JSON", async () => {
    const r = await new ApibayProvider(transportOf('{not json')).search(
      'tt0000001',
    );

    expect(r.status).toBe('error');
    expect(r.torrents).toEqual([]);
  });

  it("returns 'error' on a network failure without throwing", async () => {
    const transport = (() =>
      Promise.reject(new Error('ECONNRESET'))) as typeof fetch;
    const r = await new ApibayProvider(transport).search('tt0000001');

    expect(r.status).toBe('error');
    expect(r.error).toContain('ECONNRESET');
  });
});
