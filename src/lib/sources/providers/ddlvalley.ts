import { requestPage } from '../request-page';
import type { ExtractedRelease, FetchResult, Source } from '../types';

const ORDINAL_SUFFIX = /(\d)(?:st|nd|rd|th)/u;

const BASE_URL = 'https://www.ddlvalley.me/category/movies/';

const POST_RE = /class="post br5 cl"\s+id="post-(\d+)"/gu;
const IMDB_RE = /imdb\.com\/title\/(tt\d+)/iu;
const DATE_RE = /<span class="date">([^<]+)<\/span>/u;
const AUTHOR_RE = /<span class="author">\s*<a[^>]*>([^<]+)<\/a>/u;
const CATEGORY_RE = /rel="category tag"[^>]*>([^<]+)</gu;
const IMG_RE = /<div class="poster[^"]*">\s*<img[^>]+src="([^"]+)"/u;
const PLOT_RE = /<div class="plot">([\s\S]*?)<\/div>/u;

/** Where the whitespace run that starts at `from` ends. */
function skipWhitespace(text: string, from: number): number {
  const whitespace = Object.assign(/\s*/uy, { lastIndex: from });
  return from + (whitespace.exec(text)?.[0].length ?? 0);
}

/** The `href="..."` of an anchor opened at `at`: its value and where it ends. */
function hrefAfter(
  text: string,
  at: number,
  opening: string,
): { href: string; end: number } | undefined {
  if (!text.startsWith(opening, at)) {
    return undefined;
  }
  const spaced = skipWhitespace(text, at + opening.length);
  if (spaced === at + opening.length || !text.startsWith('href="', spaced)) {
    return undefined;
  }
  const from = spaced + 'href="'.length;
  const close = text.indexOf('"', from);
  return close > from
    ? { href: text.slice(from, close), end: close + 1 }
    : undefined;
}

/**
 * The value of a `<prefix> ...word..."` attribute at `at`: after the prefix
 * come spaces, then text up to the next quote, as `prefix\s+([^"]+)"` reads it
 * (when only spaces precede the quote, the last space is the value).
 */
function quotedValue(
  text: string,
  at: number,
  prefix: string,
): { value: string; end: number } | undefined {
  const from = at + prefix.length;
  const word = skipWhitespace(text, from);
  if (word === from) {
    return undefined;
  }
  const close = text.indexOf('"', word);
  if (close > word) {
    return { value: text.slice(word, close), end: close + 1 };
  }
  return close === word && word - from >= 2
    ? { value: text.slice(word - 1, word), end: word + 1 }
    : undefined;
}

/**
 * Every `prefix` inside the tag that starts at `from` (before its first `>`),
 * last one first, as `[^>]*prefix` tries them.
 */
function prefixesInTag(
  text: string,
  from: number,
  prefix: string,
): readonly number[] {
  const gt = text.indexOf('>', from);
  const last = gt === -1 ? text.length - 1 : gt - 1;
  return Array.from(
    { length: Math.max(0, last - from + 1) },
    (_, offset) => last - offset,
  ).filter((at) => text.startsWith(prefix, at));
}

/** The first valid `prefix ...word"` attribute in the tag that starts at `from`. */
function titleInTag(
  text: string,
  from: number,
  prefix: string,
): { value: string; end: number } | undefined {
  return prefixesInTag(text, from, prefix)
    .map((found) => quotedValue(text, found, prefix))
    .find((title) => title !== undefined);
}

/**
 * The first `<a href="URL" ... title="Download TITLE"` of a chunk as
 * `[url, title]`; reads the same as `/<a\s+href="([^"]+)"[^>]*title="Download\s+([^"]+)"/`.
 */
export function findDownloadLink(chunk: string): [string, string] | undefined {
  return chunk
    .matchAll(/<a/gu)
    .map(({ index: at }): [string, string] | undefined => {
      const link = hrefAfter(chunk, at, '<a');
      const title = link
        ? titleInTag(chunk, link.end, 'title="Download')
        : undefined;
      return link && title ? [link.href, title.value] : undefined;
    })
    .find((found) => found !== undefined);
}

/** Removes every `<...>` run; same result as `replaceAll(/<[^>]+>/g, '')`, in linear time. */
function stripTags(html: string): string {
  const open = html.indexOf('<');
  const close = open === -1 ? -1 : html.indexOf('>', open + 1);
  if (close === -1) {
    return html;
  }
  return close === open + 1
    ? html.slice(0, open + 1) + stripTags(html.slice(open + 1))
    : html.slice(0, open) + stripTags(html.slice(close + 1));
}

function parseDdlvalleyDate(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return undefined;
  }
  // Format observed: "Jun 7th, 2026" (no time of day).
  const cleaned = raw.replace(ORDINAL_SUFFIX, '$1').trim();
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
    const offsets = Array.from(html.matchAll(POST_RE), (match) => ({
      id: match[1],
      idx: match.index,
    })).filter(
      (offset): offset is { id: string; idx: number } =>
        offset.id !== undefined,
    );

    return offsets.flatMap((offset, index) => {
      const start = offset.idx;
      const next = offsets[index + 1];
      const end = next ? next.idx : html.length;
      const chunk = html.slice(start, end);

      const downloadMatch = findDownloadLink(chunk);
      const imdbMatch = IMDB_RE.exec(chunk);
      if (!downloadMatch || !imdbMatch) {
        return [];
      }
      const [url, title] = downloadMatch;
      const imdbId = imdbMatch[1];
      if (imdbId === undefined) {
        return [];
      }

      const dateRaw = DATE_RE.exec(chunk)?.[1]?.trim();
      const author = AUTHOR_RE.exec(chunk)?.[1]?.trim();
      const categories = Array.from(chunk.matchAll(CATEGORY_RE), (match) =>
        match[1]?.trim(),
      ).filter((category): category is string => category !== undefined);
      const imageUrl = IMG_RE.exec(chunk)?.[1];
      const plotRaw = PLOT_RE.exec(chunk)?.[1];
      const excerpt = plotRaw
        ? stripTags(plotRaw).replaceAll(/\s+/gu, ' ').trim()
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
