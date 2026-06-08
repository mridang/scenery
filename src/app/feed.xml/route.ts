import type { NextRequest } from 'next/server';
import { getDB } from '@/lib/db';
import { buildView, loadGenres } from '@/lib/catalog';
import type { MovieRow, ScoredMovie } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

const PUBLIC_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://exodus.desync.com:6969/announce',
]
  .map((t) => `&tr=${encodeURIComponent(t)}`)
  .join('');

function magnetFor(hash: string, name: string | null): string {
  const dn = name ? `&dn=${encodeURIComponent(name)}` : '';
  return `magnet:?xt=urn:btih:${hash}${dn}${PUBLIC_TRACKERS}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function genreNames(
  raw: string | null,
  lookup: ReadonlyMap<number, string>,
): string[] {
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw) as number[];
    return ids.map((id) => lookup.get(id) ?? `#${id}`);
  } catch {
    return [];
  }
}

function castNames(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as { name?: string }[];
    return items.map((c) => c.name ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

function fmtSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '';
  const gb = bytes / 1_000_000_000;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1_000_000)} MB`;
}

function pubDate(at: string | null): string {
  const t = at ? Date.parse(at) : NaN;
  if (!Number.isFinite(t)) return new Date(0).toUTCString();
  return new Date(t).toUTCString();
}

function descriptionFor(
  m: MovieRow,
  studios: readonly string[],
  score: number,
  genres: ReadonlyMap<number, string>,
): string {
  const parts: string[] = [];
  parts.push(`Score: ${score.toFixed(1)}`);
  if (m.tmdb_year) parts.push(`Year: ${m.tmdb_year}`);
  const g = genreNames(m.tmdb_genre_ids, genres);
  if (g.length) parts.push(`Genres: ${g.join(', ')}`);
  if (m.runtime) {
    const h = Math.floor(m.runtime / 60);
    const min = m.runtime % 60;
    parts.push(`Runtime: ${h > 0 ? `${h}h ${min}m` : `${min}m`}`);
  }
  if (m.vote_average != null) {
    parts.push(
      `Rating: ${m.vote_average.toFixed(1)}${
        m.vote_count != null ? ` (${m.vote_count} votes)` : ''
      }`,
    );
  }
  if (studios.length) parts.push(`Studios: ${studios.join(', ')}`);
  if (m.director) parts.push(`Director: ${m.director}`);
  const cast = castNames(m.top_cast);
  if (cast.length) parts.push(`Cast: ${cast.join(', ')}`);
  if (m.best_torrent_title) {
    const bits = [m.best_quality, fmtSize(m.best_size_bytes), m.best_source]
      .filter(Boolean)
      .join(' · ');
    parts.push(`Torrent: ${m.best_torrent_title} (${bits})`);
    if (m.best_seeders != null) parts.push(`Seeders: ${m.best_seeders}`);
  }
  return parts.join('\n');
}

function feedTitle(view: string, lang: string, sort: string): string {
  const v = view === 'plan' ? '1 TB plan' : 'Catalog';
  const langPart = lang === 'all' ? 'all languages' : lang.toUpperCase();
  const sortPart = sort === 'date' ? 'newest first' : 'best first';
  return `scenery — ${v} (${langPart}, ${sortPart})`;
}

function renderItem(
  origin: string,
  m: MovieRow,
  studios: readonly string[],
  score: number,
  genres: ReadonlyMap<number, string>,
): string {
  const title = m.tmdb_title ?? m.latest_release_title ?? m.imdb_id;
  const year = m.tmdb_year ? ` (${m.tmdb_year})` : '';
  const fullTitle = `${title}${year} — ${score.toFixed(1)}`;
  const imdbLink = `https://www.imdb.com/title/${m.imdb_id}/`;
  const description = descriptionFor(m, studios, score, genres);
  const guid = m.best_info_hash
    ? `${m.imdb_id}:${m.best_info_hash}`
    : m.imdb_id;

  let enclosure = '';
  if (m.best_info_hash) {
    const magnet = magnetFor(m.best_info_hash, m.best_torrent_title);
    const length = m.best_size_bytes ?? 0;
    enclosure = `<enclosure url="${escapeXml(magnet)}" length="${length}" type="application/x-bittorrent"/>`;
  }

  const pub = pubDate(m.latest_release_at);
  void origin;
  return `<item>
  <title>${escapeXml(fullTitle)}</title>
  <link>${escapeXml(imdbLink)}</link>
  <guid isPermaLink="false">${escapeXml(guid)}</guid>
  <pubDate>${pub}</pubDate>
  <description>${escapeXml(description)}</description>
  ${enclosure}
</item>`;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const lang = (url.searchParams.get('lang') ?? 'en').toLowerCase();
  const sort = (url.searchParams.get('sort') ?? 'score').toLowerCase();
  const view = (url.searchParams.get('view') ?? 'catalog').toLowerCase();
  const limit = Math.min(
    Math.max(1, Number(url.searchParams.get('limit') ?? '100')),
    500,
  );
  // Disk-space gate: ?budgetGb=500 cuts off items once cumulative size
  // would overflow. Items without a picked-torrent size are excluded
  // when this param is set (we can't budget what we don't measure).
  const budgetGbRaw = url.searchParams.get('budgetGb');
  const budgetBytes =
    budgetGbRaw === null
      ? null
      : Math.max(0, Number(budgetGbRaw)) * 1_000_000_000;

  const db = getDB();
  const [{ movies }, genres] = await Promise.all([
    buildView(db, { lang, sort, view }),
    loadGenres(db),
  ]);

  // In plan view, only emit movies that actually fit.
  let usable: readonly ScoredMovie[] =
    view === 'plan' ? movies.filter((m) => m.fits) : movies;

  if (budgetBytes !== null) {
    const sized = usable.filter((m) => (m.row.best_size_bytes ?? 0) > 0);
    const within: ScoredMovie[] = [];
    let cum = 0;
    for (const m of sized) {
      const next = cum + (m.row.best_size_bytes ?? 0);
      if (next > budgetBytes) break;
      within.push(m);
      cum = next;
    }
    usable = within;
  }

  const items = usable.slice(0, limit);

  const origin = url.origin;
  const selfHref = `${origin}/feed.xml?${url.searchParams.toString()}`;
  const feedAlt = `${origin}/?${url.searchParams.toString()}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escapeXml(feedTitle(view, lang, sort))}</title>
<link>${escapeXml(feedAlt)}</link>
<description>Scored movie releases from scenery, sorted ${sort === 'date' ? 'by date' : 'by score'}.</description>
<language>en-us</language>
<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
<atom:link href="${escapeXml(selfHref)}" rel="self" type="application/rss+xml"/>
${items.map((s) => renderItem(origin, s.row, s.studios, s.score, genres)).join('\n')}
</channel>
</rss>
`;
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      // Browsers cache for 60s; Cloudflare's edge caches for 60s with
      // 600s of stale-while-revalidate so a slow refresh never hits a
      // user. Adjust if you change cron cadence.
      'Cache-Control':
        'public, max-age=60, s-maxage=60, stale-while-revalidate=600',
      // Make it explicit which params are part of the cache key — saves
      // accidental over-caching across users with different filters.
      Vary: 'Accept-Encoding',
    },
  });
}
