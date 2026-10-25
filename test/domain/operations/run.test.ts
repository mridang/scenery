import type { Database } from '@/domain/db/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { OperationRequest } from '@/domain/operations/types';

const calls: string[] = [];

const sweepPending = jest.fn(async (limit: number) => ({
  scanned: limit,
  found: 1,
  notFound: 2,
  errored: 3,
}));
jest.unstable_mockModule('@/domain/omdb', () => ({
  OmdbEnricher: class {
    public sweepPending = sweepPending;
  },
}));

const runPages = jest.fn(
  async (opts: { sourceSlug: string; pageNumbers: number[] }) => {
    calls.push(`scrape:${opts.sourceSlug}:${opts.pageNumbers.join(',')}`);
    if (opts.sourceSlug === 'ddlvalley') {
      throw new Error('blocked');
    }
    return [{ page: 1 }];
  },
);
jest.unstable_mockModule('@/domain/scraping', () => ({
  ScrapeOrchestrator: class {
    public run = runPages;
  },
  ScrapingRepository: class {},
}));
jest.unstable_mockModule('@/lib/sources', () => ({
  buildSources: () => ({ scnsrc: {}, ddlvalley: {} }),
}));
jest.unstable_mockModule('@/domain/tmdb', () => ({
  buildEnricher: () => ({
    ensureGenres: async () => calls.push('enrich'),
    listPendingMovieIds: async () => ['tt1', 'tt2'],
    enrichMovie: async () => undefined,
    backfillFromRawCredits: async () => undefined,
    listPendingPeopleIds: async () => [7],
    enrichPerson: async () => undefined,
    recomputeTalentScoresPublic: async () => 4,
  }),
}));
const lookups = jest.fn(
  async (_db: unknown, opts: { providers: readonly unknown[] }) => {
    calls.push(`torrents:${opts.providers.length}`);
    return { looked_up: opts.providers.length };
  },
);
jest.unstable_mockModule('@/lib/torrents', () => ({
  ApibayProvider: class {},
  TorrentioProvider: class {},
  defaultProviders: () => [{}, {}, {}],
}));
jest.unstable_mockModule('@/domain/torrents', () => ({
  runTorrentLookups: lookups,
}));
jest.unstable_mockModule('@/lib/transport', () => ({
  browserTransport: () => fetch,
  genericTransport: () => fetch,
  proxyTransport: () => fetch,
  withRetry: (transport: typeof fetch) => transport,
}));

const { runOperation } = await import('@/domain/operations/run');

const create = jest.fn<(options: unknown) => Promise<unknown>>(async () => ({
  id: 'inst-1',
  status: async () => ({ status: 'queued' }),
}));
const deps = {
  db: {} as unknown as Database,
  env: {
    NOTIFY_WORKFLOW: { create },
    OMDB_API_KEY: 'k',
  } as unknown as CloudflareEnv,
};

const pipeline = (
  parameters: Partial<
    Extract<OperationRequest, { type: 'pipeline_run' }>['parameters']
  >,
): OperationRequest => ({
  type: 'pipeline_run',
  parameters: {
    backfill_pages: 0,
    steps: ['scrape', 'enrich', 'torrents'],
    ...parameters,
  },
});

beforeEach(() => {
  calls.length = 0;
  jest.clearAllMocks();
});

describe('runOperation', () => {
  it('sweeps OMDB for the limit asked and reports it in snake_case', async () => {
    expect(
      await runOperation(
        { type: 'omdb_backfill', parameters: { limit: 9 } },
        deps,
      ),
    ).toEqual({ limit: 9, scanned: 9, found: 1, not_found: 2, errored: 3 });
  });

  it('starts the notify workflow and reports its instance', async () => {
    expect(
      await runOperation({ type: 'push_trigger', parameters: {} }, deps),
    ).toEqual({ instance_id: 'inst-1', status: { status: 'queued' } });
    expect(create).toHaveBeenCalledWith({ params: {} });
  });

  it('runs every step of a pipeline by default, on page 1 of every source', async () => {
    const result = (await runOperation(pipeline({}), deps)) as Record<
      string,
      unknown
    >;
    expect(calls).toEqual([
      'scrape:scnsrc:1',
      'scrape:ddlvalley:1',
      'enrich',
      'torrents:3',
    ]);
    expect(result).toMatchObject({
      sources: ['scnsrc', 'ddlvalley'],
      enrich: { movies: 2, people: 1, talent_scored: 4 },
      torrents: { looked_up: 3 },
    });
    expect(typeof result['started_at']).toBe('string');
    expect(typeof result['finished_at']).toBe('string');
  });

  it('keeps going when one source fails, and says what went wrong with it', async () => {
    const result = (await runOperation(
      pipeline({ steps: ['scrape'] }),
      deps,
    )) as { pages: Record<string, unknown>; enrich?: unknown };
    expect(result.pages).toEqual({
      scnsrc: [{ page: 1 }],
      ddlvalley: { error: 'blocked' },
    });
    expect(result.enrich).toBeUndefined();
  });

  it('backfills the pages asked for, for just the source asked for', async () => {
    await runOperation(
      pipeline({ source: 'scnsrc', backfill_pages: 3, steps: ['scrape'] }),
      deps,
    );
    expect(calls).toEqual(['scrape:scnsrc:1,2,3']);
  });

  it('runs only the steps asked for', async () => {
    await runOperation(pipeline({ steps: ['enrich'] }), deps);
    expect(calls).toEqual(['enrich']);
    calls.length = 0;
    await runOperation(pipeline({ steps: ['torrents'] }), deps);
    expect(calls).toEqual(['torrents:3']);
  });

  it('asks only the torrent providers named', async () => {
    await runOperation(
      pipeline({ steps: ['torrents'], torrent_providers: ['apibay'] }),
      deps,
    );
    expect(calls).toEqual(['torrents:1']);
  });
});
