import { describe, expect, it } from '@jest/globals';

import { DdlvalleySource } from '@/lib/sources/providers/ddlvalley';

/**
 * Build a single well-formed ddlvalley post chunk. The extractor keys off
 * the `class="post br5 cl" id="post-NNN"` marker, a download link with a
 * `title="Download ..."` attribute, and an embedded imdb.com/title link.
 */
function wellFormedPost(): string {
  return `
    <div class="post br5 cl" id="post-12345">
      <a href="https://www.ddlvalley.me/another-movie-2026/"
         title="Download Another Movie 2026 720p">Another Movie 2026 720p</a>
      <span class="date">Jun 7th, 2026</span>
      <span class="author"><a href="/author/uploader/">uploader</a></span>
      <a href="https://www.ddlvalley.me/category/movies/" rel="category tag">Movies</a>
      <a href="https://www.ddlvalley.me/category/720p/" rel="category tag">720p</a>
      <div class="poster br5">
        <img src="https://img.ddlvalley.me/another.jpg" alt="poster" />
      </div>
      <div class="plot">A thrilling sequel that
        <b>exceeds</b> the original. tt1112223 mentioned.</div>
      <a href="https://www.imdb.com/title/tt1112223/">IMDb</a>
    </div>`;
}

describe('DdlvalleySource.extract', () => {
  const source = new DdlvalleySource(
    (() => Promise.resolve(new Response(''))) as unknown as typeof fetch,
    'test-fetcher',
  );

  it('extracts all fields from a well-formed post', () => {
    const releases = source.extract(wellFormedPost());

    expect(releases).toHaveLength(1);
    const release = releases[0]!;
    expect(release.externalId).toBe('12345');
    expect(release.imdbId).toBe('tt1112223');
    expect(release.title).toBe('Another Movie 2026 720p');
    expect(release.url).toBe('https://www.ddlvalley.me/another-movie-2026/');
    expect(release.author).toBe('uploader');
    expect(release.postedAtRaw).toBe('Jun 7th, 2026');
    expect(release.postedAt).toBe(new Date('Jun 7 2026').toISOString());
    expect(release.categories).toEqual(['Movies', '720p']);
    expect(release.imageUrl).toBe('https://img.ddlvalley.me/another.jpg');
    expect(release.excerpt).toContain('A thrilling sequel');
    expect(release.excerpt).not.toContain('<b>');
    expect(release.postHtml).toContain('post-12345');
  });

  it('skips a post that has no imdb id', () => {
    const html = `
      <div class="post br5 cl" id="post-22222">
        <a href="https://www.ddlvalley.me/no-imdb/"
           title="Download No IMDb Movie">No IMDb Movie</a>
        <span class="date">Jun 8th, 2026</span>
        <div class="plot">No external link here.</div>
      </div>`;

    expect(source.extract(html)).toEqual([]);
  });

  it('skips a post that has no download link', () => {
    const html = `
      <div class="post br5 cl" id="post-33333">
        <span class="date">Jun 8th, 2026</span>
        <a href="https://www.imdb.com/title/tt9998887/">IMDb</a>
      </div>`;

    expect(source.extract(html)).toEqual([]);
  });

  it('extracts the good post and skips the bad one across mixed posts', () => {
    const bad = `
      <div class="post br5 cl" id="post-44444">
        <a href="https://www.ddlvalley.me/y/" title="Download Y">Y</a>
        <div class="plot">no imdb</div>
      </div>`;
    const releases = source.extract(wellFormedPost() + bad);

    expect(releases).toHaveLength(1);
    expect(releases[0]!.externalId).toBe('12345');
  });

  it('returns an empty array when there are no posts at all', () => {
    expect(source.extract('<html><body>nothing here</body></html>')).toEqual(
      [],
    );
  });

  it('does not crash on malformed/truncated html and returns what it can', () => {
    const truncated = `
      <div class="post br5 cl" id="post-55555">
        <a href="https://www.ddlvalley.me/partial/"
           title="Download Partial">Partial</a>
        <a href="https://www.imdb.com/title/tt0001111/">imdb`;

    const releases = source.extract(truncated);
    expect(releases).toHaveLength(1);
    expect(releases[0]!.imdbId).toBe('tt0001111');
    expect(releases[0]!.title).toBe('Partial');
    expect(releases[0]!.postedAt).toBeUndefined();
    expect(releases[0]!.categories).toBeUndefined();
  });

  it('leaves postedAt undefined when the date cannot be parsed', () => {
    const html = `
      <div class="post br5 cl" id="post-66666">
        <a href="https://www.ddlvalley.me/baddate/"
           title="Download Bad Date">Bad Date</a>
        <span class="date">not a real date</span>
        <a href="https://www.imdb.com/title/tt0002222/">imdb</a>
      </div>`;

    const release = source.extract(html)[0]!;
    expect(release.postedAtRaw).toBe('not a real date');
    expect(release.postedAt).toBeUndefined();
  });
});

describe('DdlvalleySource.pageUrl', () => {
  const source = new DdlvalleySource(
    (() => Promise.resolve(new Response(''))) as unknown as typeof fetch,
    'test-fetcher',
  );

  it('returns the base url for page 1', () => {
    expect(source.pageUrl(1)).toBe(source.baseUrl);
  });

  it('appends a page segment for later pages', () => {
    expect(source.pageUrl(2)).toBe(`${source.baseUrl}page/2/`);
  });
});

describe('DdlvalleySource.fetchPage', () => {
  it('returns the fetched html via the injected transport', async () => {
    const source = new DdlvalleySource(
      (() =>
        Promise.resolve(
          new Response(wellFormedPost(), { status: 200 }),
        )) as unknown as typeof fetch,
      'test-fetcher',
    );

    const result = await source.fetchPage(1);
    expect(result.ok).toBe(true);
    expect(result.html).toContain('post-12345');
  });
});
