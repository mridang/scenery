import { requestPage } from '../request-page';
import type { ExtractedRelease, FetchResult, Source } from '../types';

const BASE_URL = 'https://www.ddlvalley.me/category/movies/';

const POST_RE = /class="post br5 cl"\s+id="post-(\d+)"/g;
const DL_LINK_RE = /<a\s+href="([^"]+)"[^>]*title="Download\s+([^"]+)"/;
const IMDB_RE = /imdb\.com\/title\/(tt\d+)/i;
const DATE_RE = /<span class="date">([^<]+)<\/span>/;
const AUTHOR_RE = /<span class="author">\s*<a[^>]*>([^<]+)<\/a>/;
const CATEGORY_RE = /rel="category tag"[^>]*>([^<]+)</g;
const IMG_RE = /<div class="poster[^"]*">\s*<img[^>]+src="([^"]+)"/;
const PLOT_RE = /<div class="plot">([\s\S]*?)<\/div>/;

function parseDdlvalleyDate(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  // Format observed: "Jun 7th, 2026" (no time of day).
  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/, '$1').trim();
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * ddlvalley.me adapter — pulls movie releases from the `/category/movies/`
 * listing. Used as a parallel source to scnsrc so a Cloudflare block on
 * either site doesn't lose us the day's releases.
 *
 * @public
 */
export class DdlvalleySource implements Source {
  public readonly slug = 'ddlvalley';
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

      const downloadMatch = chunk.match(DL_LINK_RE);
      const imdbMatch = chunk.match(IMDB_RE);
      if (!downloadMatch || !imdbMatch) {
        return [];
      }
      const url = downloadMatch[1];
      const title = downloadMatch[2];
      const imdbId = imdbMatch[1];
      if (url === undefined || title === undefined || imdbId === undefined) {
        return [];
      }

      const dateRaw = chunk.match(DATE_RE)?.[1]?.trim();
      const author = chunk.match(AUTHOR_RE)?.[1]?.trim();
      const categories = Array.from(chunk.matchAll(CATEGORY_RE))
        .map((match) => match[1]?.trim())
        .filter((category): category is string => category !== undefined);
      const imageUrl = chunk.match(IMG_RE)?.[1];
      const plotRaw = chunk.match(PLOT_RE)?.[1];
      const excerpt = plotRaw
        ? plotRaw
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
          postedAt: parseDdlvalleyDate(dateRaw),
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
