import { requestPage } from '../request-page';
import type { ExtractedRelease, FetchResult, Source } from '../types';

const BASE_URL = 'https://www.scnsrc.me/category/films/hd/';

const POST_RE = /class="post"\s+id="post-(\d+)"/g;
const TITLE_RE =
  // eslint-disable-next-line sonarjs/super-linear-regex -- an attribute scan across a tag cannot be made linear without a different matcher; input is one post chunk of a fetched listing
  /<h2>\s*<a\s+href="([^"]+)"[^>]*title="Goto\s+([^"]+)"[^>]*>([^<]+)<\/a>/;
const IMDB_RE = /imdb\.com\/title\/(tt\d+)/i;
const AUTHOR_RE = /<a\s+href="[^"]*\/author\/[^"]*"[^>]*>([^<]+)<\/a>/;
const DATE_RE = /<span class="date">([^<]+)<\/span>/;
const CATEGORY_RE = /rel="category tag"[^>]*>([^<]+)</g;
const IMG_RE = /<img[^>]+src="([^"]+)"/;
const EXCERPT_RE = /<p[^>]*>([\s\S]*?)<\/p>/;

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

function parseScnsrcDate(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  // Format observed: "Jun 5th, 2026, at 5:25 am"
  const cleaned = raw.replace(/(\d)(?:st|nd|rd|th)/, '$1').replace(' at ', ' ');
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * Scnsrc.me adapter — pulls movie releases from the `/category/films/hd/`
 * listing. Each post is wrapped in `<div class="post" id="post-NNNNNN">`
 * and embeds an IMDb link inside its body..
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

      const titleMatch = TITLE_RE.exec(chunk);
      const imdbMatch = IMDB_RE.exec(chunk);
      if (!titleMatch || !imdbMatch) {
        return [];
      }
      const [, url, , title] = titleMatch;
      const imdbId = imdbMatch[1];
      if (url === undefined || title === undefined) {
        return [];
      }
      if (imdbId === undefined) {
        return [];
      }

      const author = AUTHOR_RE.exec(chunk)?.[1]?.trim();
      const dateRaw = DATE_RE.exec(chunk)?.[1]?.trim();
      const categories = [...chunk.matchAll(CATEGORY_RE)]
        .map((match) => match[1]?.trim())
        .filter((category): category is string => category !== undefined);
      const imageUrl = IMG_RE.exec(chunk)?.[1];
      const excerptRaw = EXCERPT_RE.exec(chunk)?.[1];
      const excerpt = excerptRaw
        ? stripTags(excerptRaw).replaceAll(/\s+/g, ' ').trim()
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
