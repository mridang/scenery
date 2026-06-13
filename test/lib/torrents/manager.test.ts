import { describe, expect, it } from '@jest/globals';

import { TorrentLookupManager } from '../../../src/lib/torrents/manager';
import type {
  LookupResult,
  TorrentProvider,
} from '../../../src/lib/torrents/types';

function fakeProvider(name: string, result: LookupResult): TorrentProvider {
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
      fakeProvider('a', SUCCESS),
      fakeProvider('b', EMPTY),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('a');
    expect(r.result.status).toBe('success');
  });

  it('falls through to a later provider on empty', async () => {
    const m = new TorrentLookupManager([
      fakeProvider('a', EMPTY),
      fakeProvider('b', SUCCESS),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('b');
    expect(r.result.status).toBe('success');
  });

  it('falls through to a later provider on error', async () => {
    const m = new TorrentLookupManager([
      fakeProvider('a', ERROR),
      fakeProvider('b', SUCCESS),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('b');
    expect(r.result.status).toBe('success');
  });

  it("returns first 'empty' when nobody succeeds but somebody is empty", async () => {
    const m = new TorrentLookupManager([
      fakeProvider('a', ERROR),
      fakeProvider('b', EMPTY),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('b');
    expect(r.result.status).toBe('empty');
  });

  it('records every attempt in the attempt log', async () => {
    const m = new TorrentLookupManager([
      fakeProvider('a', ERROR),
      fakeProvider('b', EMPTY),
      fakeProvider('c', SUCCESS),
    ]);
    const r = await m.lookup('tt0001');
    expect(r.attempted.map((a) => a.provider)).toEqual(['a', 'b', 'c']);
  });

  it('treats thrown errors as a failure attempt and continues', async () => {
    const provider: TorrentProvider = {
      name: 'bad',
      search: () => Promise.reject(new Error('network')),
    };
    const m = new TorrentLookupManager([provider, fakeProvider('ok', SUCCESS)]);
    const r = await m.lookup('tt0001');
    expect(r.provider).toBe('ok');
    expect(r.attempted[0]).toMatchObject({
      provider: 'bad',
      status: 'error',
    });
  });

  it('throws on construction when no providers are supplied', () => {
    expect(() => new TorrentLookupManager([])).toThrow(/at least one/);
  });
});
