import type { PageFetcher } from "./scrapingant";
import type { ExtractedRelease, FetchResult, Source } from "./types";

const BASE_URL = "https://www.ddlvalley.me/category/movies/";

const POST_RE = /class="post br5 cl"\s+id="post-(\d+)"/g;
const DL_LINK_RE = /<a\s+href="([^"]+)"[^>]*title="Download\s+([^"]+)"/;
const IMDB_RE = /imdb\.com\/title\/(tt\d+)/i;
const DATE_RE = /<span class="date">([^<]+)<\/span>/;
const AUTHOR_RE = /<span class="author">\s*<a[^>]*>([^<]+)<\/a>/;
const CATEGORY_RE = /rel="category tag"[^>]*>([^<]+)</g;
const IMG_RE = /<div class="poster[^"]*">\s*<img[^>]+src="([^"]+)"/;
const PLOT_RE = /<div class="plot">([\s\S]*?)<\/div>/;

function parseDdlvalleyDate(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  // Format observed: "Jun 7th, 2026" (no time of day).
  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/, "$1").trim();
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * ddlvalley.me adapter — pulls movie releases from the `/category/movies/`
 * listing. Used as a parallel source to scnsrc so a Cloudflare block on
 * either site doesn't lose us the day's releases.
 *
 * @public
 */
export class DdlvalleySource implements Source {
  public readonly slug = "ddlvalley";
  public readonly baseUrl = BASE_URL;
  public readonly fetcherLabel: string;
  private readonly fetcher: PageFetcher;

  public constructor(fetcher: PageFetcher) {
    this.fetcher = fetcher;
    this.fetcherLabel = fetcher.label;
  }

  public pageUrl(pageNumber: number): string {
    return pageNumber <= 1 ? BASE_URL : `${BASE_URL}page/${pageNumber}/`;
  }

  public async fetchPage(pageNumber: number): Promise<FetchResult> {
    return this.fetcher.fetch(this.pageUrl(pageNumber));
  }

  public extract(html: string): ExtractedRelease[] {
    const offsets: { id: string; idx: number }[] = [];
    for (const m of html.matchAll(POST_RE)) {
      const id = m[1];
      if (id === undefined) continue;
      offsets.push({ id, idx: m.index ?? 0 });
    }
    const out: ExtractedRelease[] = [];
    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i]!;
      const start = offset.idx;
      const next = offsets[i + 1];
      const end = next ? next.idx : html.length;
      const chunk = html.slice(start, end);

      const dl = chunk.match(DL_LINK_RE);
      const imdb = chunk.match(IMDB_RE);
      if (!dl || !imdb) continue;
      const url = dl[1];
      const title = dl[2];
      const imdbId = imdb[1];
      if (url === undefined || title === undefined || imdbId === undefined) {
        continue;
      }

      const dateRaw = chunk.match(DATE_RE)?.[1]?.trim();
      const author = chunk.match(AUTHOR_RE)?.[1]?.trim();
      const categories = Array.from(chunk.matchAll(CATEGORY_RE))
        .map((m) => m[1]?.trim())
        .filter((s): s is string => s !== undefined);
      const imageUrl = chunk.match(IMG_RE)?.[1];
      const plotRaw = chunk.match(PLOT_RE)?.[1];
      const excerpt = plotRaw
        ? plotRaw
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim()
        : undefined;

      out.push({
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
      });
    }
    return out;
  }
}
