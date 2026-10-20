import { describe, expect, it } from '@jest/globals';

import { TorrentLookupManager } from '../../../src/lib/torrents/manager';
import type {
  LookupResult,
  TorrentProvider,
  TorrentProviderName,
} from '../../../src/lib/torrents/types';

function fakeProvider(
  name: TorrentProviderName,
  result: LookupResult,
): TorrentProvider {
  return { name, search: () => Promise.resolve(result) };
}

const SUCCESS: LookupResult = {
  status: 'success',
  torrents: [
    {
      infoHash: 'deadbeef',
      title: 'x',
      rawTitle: 'x',
      source: 'x',
      seeders: 1,
      sizeBytes: 1,
      quality: null,
      isHdr: false,
      isRemux: false,
    },
  ],
  rawResponse: '{}',
};
const EMPTY: LookupResult = {
  status: 'empty',
  torrents: [],
  rawResponse: '{}',
};
const ERROR: LookupResult = {
  status: 'error',
  torrents: [],
  rawResponse: '',
  error: 'boom',
};

describe('TorrentLookupManager', () => {
  it("first provider's success wins", async () => {
    const m = new TorrentLookupManager([
      fakeProvider('apibay', SUCCESS),
      fakeProvider('torrentio', EMPTY),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('apibay');
    expect(r.result.status).toBe('success');
  });

  it('falls through to a later provider on empty', async () => {
    const m = new TorrentLookupManager([
      fakeProvider('apibay', EMPTY),
      fakeProvider('torrentio', SUCCESS),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('torrentio');
    expect(r.result.status).toBe('success');
  });

  it('falls through to a later provider on error', async () => {
    const m = new TorrentLookupManager([
      fakeProvider('apibay', ERROR),
      fakeProvider('torrentio', SUCCESS),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('torrentio');
    expect(r.result.status).toBe('success');
  });

  it("returns first 'empty' when nobody succeeds but somebody is empty", async () => {
    const m = new TorrentLookupManager([
      fakeProvider('apibay', ERROR),
      fakeProvider('torrentio', EMPTY),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('torrentio');
    expect(r.result.status).toBe('empty');
  });

  it('records every attempt in the attempt log', async () => {
    const m = new TorrentLookupManager([
      fakeProvider('apibay', ERROR),
      fakeProvider('torrentio', EMPTY),
      fakeProvider('apibay', SUCCESS),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.attempted.map((a) => a.provider)).toEqual([
      'apibay',
      'torrentio',
      'apibay',
    ]);
  });

  it('treats thrown errors as a failure attempt and continues', async () => {
    const provider: TorrentProvider = {
      name: 'apibay',
      search: () => Promise.reject(new Error('network')),
    };
    const m = new TorrentLookupManager([
      provider,
      fakeProvider('torrentio', SUCCESS),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('torrentio');
    expect(r.attempted[0]).toMatchObject({
      provider: 'apibay',
      status: 'error',
    });
  });

  it('throws on construction when no providers are supplied', () => {
    expect(() => new TorrentLookupManager([])).toThrow(/at least one/);
  });
});
