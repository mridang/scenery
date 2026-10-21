import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockEnv: Record<string, unknown> = {};
const calls: string[] = [];
jest.unstable_mockModule('../../../../src/lib/util', () => ({
  getDB: () => ({}),
  getEnv: () => mockEnv,
  logInfo: () => undefined,
  logWarn: () => undefined,
  logError: () => undefined,
}));
jest.unstable_mockModule('../../../../src/lib/sources', () => ({
  buildSources: () => ({ alpha: {}, beta: {} }),
}));
jest.unstable_mockModule('../../../../src/lib/scraping', () => ({
  ScrapingRepository: class {},
  ScrapeOrchestrator: class {
    public run(args: { sourceSlug: string; pageNumbers: number[] }) {
      calls.push(`scrape:${args.sourceSlug}:${args.pageNumbers.length}`);
      return Promise.resolve({ ok: true });
    }
  },
}));
jest.unstable_mockModule('../../../../src/lib/tmdb', () => ({
  buildEnricher: () => ({
    ensureGenres: () => Promise.resolve(),
    listPendingMovieIds: () => Promise.resolve(['tt1']),
    enrichMovie: () => Promise.resolve(),
    backfillFromRawCredits: () => Promise.resolve(),
    listPendingPeopleIds: () => Promise.resolve([]),
    enrichPerson: () => Promise.resolve(),
    recomputeTalentScoresPublic: () => Promise.resolve(2),
  }),
}));
jest.unstable_mockModule('../../../../src/lib/transport', () => ({
  browserTransport: () => fetch,
  genericTransport: () => fetch,
  proxyTransport: () => fetch,
  withRetry: (f: typeof fetch) => f,
}));
jest.unstable_mockModule('../../../../src/lib/torrents', () => ({
  ApibayProvider: class {
    public readonly name = 'apibay';
  },
  TorrentioProvider: class {
    public readonly name = 'torrentio';
  },
  defaultProviders: () => [],
  runTorrentLookups: (
    _db: unknown,
    opts: { providers: { name: string }[] },
  ) => {
    calls.push(`torrents:${opts.providers.map((p) => p.name).join(',')}`);
    return Promise.resolve({ looked: 1 });
  },
}));

const { POST } = await import('../../../../src/app/api/pipeline-runs/route');

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://x/api/pipeline-runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  mockEnv = {};
  calls.length = 0;
});

describe('POST /api/pipeline-runs', () => {
  it('401s with a bearer challenge when a secret is set and none is sent', async () => {
    mockEnv = { CRON_SECRET: 'shh' };
    const res = await POST(post({}));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });

  it('401s on a wrong bearer token', async () => {
    mockEnv = { CRON_SECRET: 'shh' };
    expect(
      (await POST(post({}, { authorization: 'Bearer nope' }))).status,
    ).toBe(401);
  });

  it('400s with the offending members for an unknown member', async () => {
    const res = await POST(post({ bogus: 1 }));
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(((await res.json()) as { errors: string[] }).errors).toEqual([
      'bogus: unknown member.',
    ]);
  });

  it('415s for a body that is not JSON', async () => {
    const res = await POST(
      new Request('https://x/api/pipeline-runs', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      }),
    );
    expect(res.status).toBe(415);
  });

  it('400s for a body that does not parse', async () => {
    expect((await POST(post('{nope'))).status).toBe(400);
  });

  it('runs every step by default, once per source, on page 1', async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(200);
    expect(calls).toEqual(['scrape:alpha:1', 'scrape:beta:1', 'torrents:']);
    expect(await res.json()).toMatchObject({
      sources: ['alpha', 'beta'],
      enrich: { movies: 1, people: 0, talentScored: 2 },
      torrents: { looked: 1 },
    });
  });

  it('runs only the enrich step for steps: ["enrich"]', async () => {
    const res = await POST(post({ steps: ['enrich'] }));
    expect(calls).toEqual([]);
    expect(await res.json()).toMatchObject({
      pages: {},
      enrich: { movies: 1 },
      torrents: null,
    });
  });

  it('backfills the pages asked for from the one source named', async () => {
    await POST(post({ source: 'beta', backfillPages: 3, steps: ['scrape'] }));
    expect(calls).toEqual(['scrape:beta:3']);
  });

  it('limits the torrent lookup to the providers named', async () => {
    await POST(post({ steps: ['torrents'], torrentProviders: ['apibay'] }));
    expect(calls).toEqual(['torrents:apibay']);
  });
});
