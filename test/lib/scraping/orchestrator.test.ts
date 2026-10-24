import { describe, expect, it, jest } from '@jest/globals';

import { ScrapeOrchestrator } from '@/domain/scraping/orchestrator';
import type { SourceSlug } from '@/utils/enums';
import type { ScrapingRepository } from '@/domain/scraping/repository';
import type {
  ExtractedRelease,
  FetchResult,
  Source,
} from '@/lib/sources/types';

/**
 * A minimal in-memory stand-in for {@link ScrapingRepository}. The
 * orchestrator only calls the methods overridden below; everything else
 * stays unimplemented because it is never reached on these paths.
 */
function fakeRepo(overrides: Partial<ScrapingRepository> = {}): {
  repo: ScrapingRepository;
  upserts: { sourceId: number; release: ExtractedRelease }[];
  failed: unknown[];
  snapshots: unknown[];
  successful: unknown[];
} {
  const upserts: { sourceId: number; release: ExtractedRelease }[] = [];
  const failed: unknown[] = [];
  const snapshots: unknown[] = [];
  const successful: unknown[] = [];

  const base: Partial<ScrapingRepository> = {
    findSource: jest.fn(async () => ({ id: 7, slug: 'scnsrc' })),
    nextAttemptNumber: jest.fn(async () => 1),
    insertFailedAttempt: jest.fn(async (opts: unknown) => {
      failed.push(opts);
    }),
    insertSnapshot: jest.fn(async (opts: unknown) => {
      snapshots.push(opts);
      return 100 + snapshots.length;
    }),
    insertSuccessfulAttempt: jest.fn(async (opts: unknown) => {
      successful.push(opts);
    }),
    upsertRelease: jest.fn(
      async (sourceId: number, release: ExtractedRelease) => {
        upserts.push({ sourceId, release });
      },
    ),
    ...overrides,
  };

  return {
    repo: base as unknown as ScrapingRepository,
    upserts,
    failed,
    snapshots,
    successful,
  };
}

function release(id: string): ExtractedRelease {
  return {
    externalId: id,
    imdbId: `tt${id}`,
    title: `Title ${id}`,
    url: `https://example.test/${id}`,
    postHtml: `<div id="post-${id}"></div>`,
  };
}

/** A fully controllable fake Source. */
function fakeSource(opts: {
  slug: SourceSlug;
  fetch: (pageNumber: number) => Promise<FetchResult>;
  releases?: ExtractedRelease[];
}): Source {
  return {
    slug: opts.slug,
    baseUrl: `https://example.test/${opts.slug}/`,
    fetcherLabel: `fetcher-${opts.slug}`,
    pageUrl: (n) => `https://example.test/${opts.slug}/page/${n}/`,
    fetchPage: opts.fetch,
    extract: () => opts.releases ?? [],
  };
}

describe('ScrapeOrchestrator.run', () => {
  it('persists extracted releases on a successful fetch', async () => {
    const { repo, upserts, snapshots, successful } = fakeRepo();
    const src = fakeSource({
      slug: 'scnsrc',
      fetch: async () => ({
        ok: true,
        httpStatus: 200,
        html: '<html>page</html>',
        byteSize: 17,
      }),
      releases: [release('1'), release('2')],
    });

    const orchestrator = new ScrapeOrchestrator(repo, { scnsrc: src });
    const results = await orchestrator.run({
      sourceSlug: 'scnsrc',
      pageNumbers: [1],
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('success');
    expect(results[0]!.releasesUpserted).toBe(2);
    expect(upserts.map((u) => u.release.externalId)).toEqual(['1', '2']);
    expect(snapshots).toHaveLength(1);
    expect(successful).toHaveLength(1);
  });

  it('records a failed attempt without throwing when a fetch fails', async () => {
    const { repo, failed, upserts } = fakeRepo();
    const src = fakeSource({
      slug: 'scnsrc',
      fetch: async () => ({
        ok: false,
        httpStatus: 403,
        error: 'blocked',
        byteSize: 0,
      }),
    });

    const orchestrator = new ScrapeOrchestrator(repo, { scnsrc: src });
    const results = await orchestrator.run({
      sourceSlug: 'scnsrc',
      pageNumbers: [1],
    });

    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.httpStatus).toBe(403);
    expect(results[0]!.error).toBe('blocked');
    expect(failed).toHaveLength(1);
    expect(upserts).toHaveLength(0);
  });

  it('is fail-safe across pages: a failed page does not abort later pages', async () => {
    const { repo, upserts, failed } = fakeRepo();
    const src = fakeSource({
      slug: 'scnsrc',
      fetch: async (pageNumber) =>
        pageNumber === 1
          ? { ok: false, httpStatus: 500, error: 'boom', byteSize: 0 }
          : {
              ok: true,
              httpStatus: 200,
              html: '<html>page2</html>',
              byteSize: 18,
            },
      releases: [release('9')],
    });

    const orchestrator = new ScrapeOrchestrator(repo, { scnsrc: src });
    const results = await orchestrator.run({
      sourceSlug: 'scnsrc',
      pageNumbers: [1, 2],
    });

    expect(results).toHaveLength(2);
    expect(results[0]!.status).toBe('failed');
    expect(results[1]!.status).toBe('success');
    expect(failed).toHaveLength(1);
    expect(upserts.map((u) => u.release.externalId)).toEqual(['9']);
  });

  it('throws when the requested source slug is not registered', async () => {
    const { repo } = fakeRepo();
    const orchestrator = new ScrapeOrchestrator(repo, {});

    await expect(
      orchestrator.run({ sourceSlug: 'missing', pageNumbers: [1] }),
    ).rejects.toThrow('unknown source: missing');
  });

  it('throws when the source is registered but not seeded in the db', async () => {
    const { repo } = fakeRepo({
      findSource: jest.fn(async () => null),
    });
    const src = fakeSource({
      slug: 'scnsrc',
      fetch: async () => ({ ok: true, html: '', byteSize: 0 }),
    });
    const orchestrator = new ScrapeOrchestrator(repo, { scnsrc: src });

    await expect(
      orchestrator.run({ sourceSlug: 'scnsrc', pageNumbers: [1] }),
    ).rejects.toThrow('not in db');
  });

  it('upserts nothing when a successful page yields no releases', async () => {
    const { repo, upserts, snapshots } = fakeRepo();
    const src = fakeSource({
      slug: 'scnsrc',
      fetch: async () => ({
        ok: true,
        httpStatus: 200,
        html: '<html>empty</html>',
        byteSize: 18,
      }),
      releases: [],
    });

    const orchestrator = new ScrapeOrchestrator(repo, { scnsrc: src });
    const results = await orchestrator.run({
      sourceSlug: 'scnsrc',
      pageNumbers: [1],
    });

    expect(results[0]!.status).toBe('success');
    expect(results[0]!.releasesUpserted).toBe(0);
    expect(upserts).toHaveLength(0);
    expect(snapshots).toHaveLength(1);
  });
});
