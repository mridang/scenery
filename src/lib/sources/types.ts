/**
 * Outcome of fetching one listing page from a release source.
 *
 * @public
 */
export interface FetchResult {
  /** True only if the fetch returned a usable HTML body. */
  readonly ok: boolean;
  /** Upstream HTTP status code, when available. */
  readonly httpStatus?: number;
  /** Raw HTML response body. Present on success; sometimes present on failure. */
  readonly html?: string;
  /** Response headers we want to keep, as a flat map. */
  readonly responseHeaders?: Readonly<Record<string, string>>;
  /** Human-readable error message if {@link ok} is false. */
  readonly error?: string;
  /** Byte size of {@link html}, useful for snapshot accounting. */
  readonly byteSize: number;
}

/**
 * One movie release extracted from a source's listing page. Shape is
 * deliberately source-agnostic so the orchestrator can persist anything.
 *
 * @public
 */
export interface ExtractedRelease {
  /** The source's own identifier for this post (e.g. WordPress post-id). */
  readonly externalId: string;
  /** IMDb id, including the `tt` prefix. Required for catalog dedup. */
  readonly imdbId: string;
  /** Release title as written by the source. */
  readonly title: string;
  /** Permalink to the post on the source's site. */
  readonly url: string;
  /** Raw date string as scraped (e.g. "Jun 5th, 2026, at 5:25 am"). */
  readonly postedAtRaw?: string;
  /** ISO-8601 timestamp parsed from {@link postedAtRaw} if possible. */
  readonly postedAt?: string;
  /** Category tags from the post (e.g. ["HD","Movies"]). */
  readonly categories?: readonly string[];
  /** Display name of the author, if exposed. */
  readonly author?: string;
  /** First image URL associated with the post. */
  readonly imageUrl?: string;
  /** Cleaned-up text blurb from the post, if available. */
  readonly excerpt?: string;
  /** The post's HTML chunk verbatim — kept so we can re-parse later. */
  readonly postHtml: string;
}

/**
 * Abstract contract every release source implements. Provider-specific
 * details (HTML structure, URL pattern, anti-bot strategy) live behind
 * this interface; orchestration only sees the methods below.
 *
 * @public
 */
export interface Source {
  /** Short identifier, persisted in the `sources` table (e.g. `scnsrc`). */
  readonly slug: string;
  /** Canonical entry URL — typically the first listing page. */
  readonly baseUrl: string;
  /** Label persisted on each snapshot row to identify the fetch path used. */
  readonly fetcherLabel: string;

  /**
   * Compute the URL for a given page in the listing.
   *
   * @param pageNumber - One-based page index.
   * @returns Absolute URL string.
   */
  pageUrl(pageNumber: number): string;

  /**
   * Retrieve a listing page's HTML.
   *
   * @param pageNumber - One-based page index.
   * @returns A {@link FetchResult} containing the HTML when successful.
   */
  fetchPage(pageNumber: number): Promise<FetchResult>;

  /**
   * Parse one listing page's HTML into structured releases.
   *
   * @param html - The HTML returned by {@link fetchPage}.
   * @returns Zero or more releases extracted from the page.
   */
  extract(html: string): ExtractedRelease[];
}
