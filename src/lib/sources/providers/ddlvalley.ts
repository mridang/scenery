import { requestPage } from '../request-page';
import type { ExtractedRelease, FetchResult, Source } from '../types';

const BASE_URL = 'https://www.ddlvalley.me/category/movies/';

const POST_RE = /class="post br5 cl"\s+id="post-(\d+)"/g;
// eslint-disable-next-line sonarjs/super-linear-regex -- an attribute scan across a tag cannot be made linear without a different matcher; input is one post chunk of a fetched listing
const DL_LINK_RE = /<a\s+href="([^"]+)"[^>]*title="Download\s+([^"]+)"/;
const IMDB_RE = /imdb\.com\/title\/(tt\d+)/i;
const DATE_RE = /<span class="date">([^<]+)<\/span>/;
const AUTHOR_RE = /<span class="author">\s*<a[^>]*>([^<]+)<\/a>/;
const CATEGORY_RE = /rel="category tag"[^>]*>([^<]+)</g;
const IMG_RE = /<div class="poster[^"]*">\s*<img[^>]+src="([^"]+)"/;
const PLOT_RE = /<div class="plot">([\s\S]*?)<\/div>/;

/** Removes every `<...>` run; same result as `replaceAll(/<[^>]+>/g, '')`, in linear time. */
function stripTags(html: string): string {
  let out = '';
  let from = 0;
  let open = html.indexOf('<');
  while (open !== -1) {
    const close = html.indexOf('>', open + 1);
    if (close === -1) {
      break;
    }
    if (close === open + 1) {
      open = html.indexOf('<', open + 1);
    } else {
      out += html.slice(from, open);
      from = close + 1;
      open = html.indexOf('<', from);
    }
  }
  return out + html.slice(from);
}

function parseDdlvalleyDate(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  // Format observed: "Jun 7th, 2026" (no time of day).
  const cleaned = raw.replace(/(\d)(?:st|nd|rd|th)/, '$1').trim();
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Ddlvalley.me adapter — pulls movie releases from the `/category/movies/`
 * listing. Used as a parallel source to scnsrc so a Cloudflare block on
 * either site doesn't lose us the day's releases..
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
    const offsets = [...html.matchAll(POST_RE)]
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

      const downloadMatch = DL_LINK_RE.exec(chunk);
      const imdbMatch = IMDB_RE.exec(chunk);
      if (!downloadMatch || !imdbMatch) {
        return [];
      }
      const [, url, title] = downloadMatch;
      const imdbId = imdbMatch[1];
      if (url === undefined || title === undefined) {
        return [];
      }
      if (imdbId === undefined) {
        return [];
      }

      const dateRaw = DATE_RE.exec(chunk)?.[1]?.trim();
      const author = AUTHOR_RE.exec(chunk)?.[1]?.trim();
      const categories = [...chunk.matchAll(CATEGORY_RE)]
        .map((match) => match[1]?.trim())
        .filter((category): category is string => category !== undefined);
      const imageUrl = IMG_RE.exec(chunk)?.[1];
      const plotRaw = PLOT_RE.exec(chunk)?.[1];
      const excerpt = plotRaw
        ? stripTags(plotRaw).replaceAll(/\s+/g, ' ').trim()
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
