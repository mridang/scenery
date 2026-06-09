import { describe, expect, it } from '@jest/globals';

import { ScnsrcSource } from '@/lib/sources/providers/scnsrc';

/**
 * Build a single well-formed scnsrc post chunk. The extractor keys off the
 * `class="post" id="post-NNN"` marker, an `<h2>` title link with a
 * `title="Goto ..."` attribute, and an embedded imdb.com/title link.
 */
function wellFormedPost(): string {
  return `
    <div class="post" id="post-99001">
      <h2>
        <a href="https://www.scnsrc.me/some-movie-2026/" rel="bookmark"
           title="Goto Some Movie 2026 1080p">Some Movie 2026 1080p</a>
      </h2>
      <span class="date">Jun 5th, 2026, at 5:25 am</span>
      <a href="https://www.scnsrc.me/author/ripper/">ripper</a>
      <a href="https://www.scnsrc.me/category/films/hd/" rel="category tag">HD</a>
      <a href="https://www.scnsrc.me/category/films/" rel="category tag">Films</a>
      <img src="https://img.scnsrc.me/some-movie.jpg" alt="poster" />
      <p>A gripping tale. See
        <a href="https://www.imdb.com/title/tt7654321/">IMDb</a> for more.</p>
    </div>`;
}

describe('ScnsrcSource.extract', () => {
  const source = new ScnsrcSource(
    (() => Promise.resolve(new Response(''))) as unknown as typeof fetch,
    'test-fetcher',
  );

  it('extracts all fields from a well-formed post', () => {
    const releases = source.extract(wellFormedPost());

    expect(releases).toHaveLength(1);
    const release = releases[0]!;
    expect(release.externalId).toBe('99001');
    expect(release.imdbId).toBe('tt7654321');
    expect(release.title).toBe('Some Movie 2026 1080p');
    expect(release.url).toBe('https://www.scnsrc.me/some-movie-2026/');
    expect(release.author).toBe('ripper');
    expect(release.postedAtRaw).toBe('Jun 5th, 2026, at 5:25 am');
    expect(release.postedAt).toBe(new Date('Jun 5 2026 5:25 am').toISOString());
    expect(release.categories).toEqual(['HD', 'Films']);
    expect(release.imageUrl).toBe('https://img.scnsrc.me/some-movie.jpg');
    expect(release.excerpt).toContain('A gripping tale.');
    expect(release.postHtml).toContain('post-99001');
  });

  it('skips a post that has no imdb id', () => {
    const html = `
      <div class="post" id="post-77002">
        <h2>
          <a href="https://www.scnsrc.me/no-imdb/" title="Goto No IMDb Movie">
            No IMDb Movie</a>
        </h2>
        <span class="date">Jun 6th, 2026, at 1:00 pm</span>
        <p>No external link here.</p>
      </div>`;

    expect(source.extract(html)).toEqual([]);
  });

  it('extracts the good post and skips the bad one across mixed posts', () => {
    const bad = `
      <div class="post" id="post-77003">
        <h2><a href="https://www.scnsrc.me/x/" title="Goto X">X</a></h2>
        <p>no imdb</p>
      </div>`;
    const releases = source.extract(wellFormedPost() + bad);

    expect(releases).toHaveLength(1);
    expect(releases[0]!.externalId).toBe('99001');
  });

  it('returns an empty array when there are no posts at all', () => {
    expect(source.extract('<html><body>nothing here</body></html>')).toEqual(
      [],
    );
  });

  it('does not crash on malformed/truncated html and returns what it can', () => {
    const truncated = `
      <div class="post" id="post-55005">
        <h2>
          <a href="https://www.scnsrc.me/partial/" title="Goto Partial">
            Partial</a>
        </h2>
        <a href="https://www.imdb.com/title/tt0001111/">imdb`;

    const releases = source.extract(truncated);
    expect(releases).toHaveLength(1);
    expect(releases[0]!.imdbId).toBe('tt0001111');
    expect(releases[0]!.title).toBe('Partial');
    // Missing date is tolerated.
    expect(releases[0]!.postedAt).toBeUndefined();
    expect(releases[0]!.categories).toBeUndefined();
  });

  it('leaves postedAt undefined when the date cannot be parsed', () => {
    const html = `
      <div class="post" id="post-44004">
        <h2>
          <a href="https://www.scnsrc.me/baddate/" title="Goto Bad Date">
            Bad Date</a>
        </h2>
        <span class="date">not a real date</span>
        <a href="https://www.imdb.com/title/tt0002222/">imdb</a>
      </div>`;

    const release = source.extract(html)[0]!;
    expect(release.postedAtRaw).toBe('not a real date');
    expect(release.postedAt).toBeUndefined();
  });
});

describe('ScnsrcSource.pageUrl', () => {
  const source = new ScnsrcSource(
    (() => Promise.resolve(new Response(''))) as unknown as typeof fetch,
    'test-fetcher',
  );

  it('returns the base url for page 1', () => {
    expect(source.pageUrl(1)).toBe(source.baseUrl);
  });

  it('appends a page segment for later pages', () => {
    expect(source.pageUrl(3)).toBe(`${source.baseUrl}page/3/`);
  });
});

describe('ScnsrcSource.fetchPage', () => {
  it('returns the fetched html via the injected transport', async () => {
    const source = new ScnsrcSource(
      (() =>
        Promise.resolve(
          new Response(wellFormedPost(), { status: 200 }),
        )) as unknown as typeof fetch,
      'test-fetcher',
    );

    const result = await source.fetchPage(1);
    expect(result.ok).toBe(true);
    expect(result.html).toContain('post-99001');
  });
});
