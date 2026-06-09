import { requestPage } from '../request-page';
import type { ExtractedRelease, FetchResult, Source } from '../types';

const BASE_URL = 'https://www.scnsrc.me/category/films/hd/';

const POST_RE = /class="post"\s+id="post-(\d+)"/g;
const TITLE_RE =
  /<h2>\s*<a\s+href="([^"]+)"[^>]*title="Goto\s+([^"]+)"[^>]*>([^<]+)<\/a>/;
const IMDB_RE = /imdb\.com\/title\/(tt\d+)/i;
const AUTHOR_RE = /<a\s+href="[^"]*\/author\/[^"]*"[^>]*>([^<]+)<\/a>/;
const DATE_RE = /<span class="date">([^<]+)<\/span>/;
const CATEGORY_RE = /rel="category tag"[^>]*>([^<]+)</g;
const IMG_RE = /<img[^>]+src="([^"]+)"/;
const EXCERPT_RE = /<p[^>]*>([\s\S]*?)<\/p>/;

function parseScnsrcDate(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  // Format observed: "Jun 5th, 2026, at 5:25 am"
  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/, '$1').replace(' at ', ' ');
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * scnsrc.me adapter — pulls movie releases from the `/category/films/hd/`
 * listing. Each post is wrapped in `<div class="post" id="post-NNNNNN">`
 * and embeds an IMDb link inside its body.
 *
 * @public
 */
export class ScnsrcSource implements Source {
  public readonly slug = 'scnsrc';
  public readonly baseUrl = BASE_URL;

  public constructor(
    private readonly transport: typeof fetch,
    public readonly fetcherLabel: string,
  ) {}

  public pageUrl(pageNumber: number): string {
    return pageNumber <= 1 ? BASE_URL : `${BASE_URL}page/${pageNumber}/`;
  }

  public async fetchPage(pageNumber: number): Promise<FetchResult> {
    return requestPage(this.transport, this.pageUrl(pageNumber));
  }

  public extract(html: string): ExtractedRelease[] {
    const offsets = Array.from(html.matchAll(POST_RE))
      .map((match) => ({ id: match[1], idx: match.index ?? 0 }))
      .filter(
        (offset): offset is { id: string; idx: number } =>
          offset.id !== undefined,
      );

    return offsets.flatMap((offset, i) => {
      const start = offset.idx;
      const next = offsets[i + 1];
      const end = next ? next.idx : html.length;
      const chunk = html.slice(start, end);

      const titleMatch = chunk.match(TITLE_RE);
      const imdbMatch = chunk.match(IMDB_RE);
      if (!titleMatch || !imdbMatch) {
        return [];
      }
      const url = titleMatch[1];
      const title = titleMatch[3];
      const imdbId = imdbMatch[1];
      if (url === undefined || title === undefined || imdbId === undefined) {
        return [];
      }

      const author = chunk.match(AUTHOR_RE)?.[1]?.trim();
      const dateRaw = chunk.match(DATE_RE)?.[1]?.trim();
      const categories = Array.from(chunk.matchAll(CATEGORY_RE))
        .map((match) => match[1]?.trim())
        .filter((category): category is string => category !== undefined);
      const imageUrl = chunk.match(IMG_RE)?.[1];
      const excerptRaw = chunk.match(EXCERPT_RE)?.[1];
      const excerpt = excerptRaw
        ? excerptRaw
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        : undefined;

      return [
        {
          externalId: offset.id,
          imdbId,
          title: title.trim(),
          url,
          postedAtRaw: dateRaw,
          postedAt: parseScnsrcDate(dateRaw),
          categories: categories.length > 0 ? categories : undefined,
          author,
          imageUrl,
          excerpt,
          postHtml: chunk,
        },
      ];
    });
  }
}
