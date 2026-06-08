import type { NextRequest } from 'next/server';
import { getDB } from '@/lib/util';
import { CatalogService, parseViewOptions } from '@/lib/catalog';
import type { ScoredMovie } from '@/lib/catalog';
import { bestTrackers, buildMagnet } from '@/lib/torrents';
import { genericTransport, withRetry } from '@/lib/transport';

export const dynamic = 'force-dynamic';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) {
    return '';
  }
  const gb = bytes / 1_000_000_000;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1_000_000)} MB`;
}

function pubDate(at: string | null): string {
  const t = at ? Date.parse(at) : NaN;
  if (!Number.isFinite(t)) {
    return new Date(0).toUTCString();
  }
  return new Date(t).toUTCString();
}

function descriptionFor(s: ScoredMovie): string {
  const { row: m, studios, genres: g, cast, score } = s;
  const runtime =
    m.runtime != null && m.runtime
      ? (() => {
          const h = Math.floor(m.runtime / 60);
          const min = m.runtime % 60;
          return h > 0 ? `${h}h ${min}m` : `${min}m`;
        })()
      : null;
  const rating =
    m.vote_average != null
      ? `${m.vote_average.toFixed(1)}${
          m.vote_count != null ? ` (${m.vote_count} votes)` : ''
        }`
      : null;
  const torrent = m.best_torrent_title
    ? `${m.best_torrent_title} (${[
        m.best_quality,
        fmtSize(m.best_size_bytes),
        m.best_source,
      ]
        .filter(Boolean)
        .join(' · ')})`
    : null;
  const seeders =
    m.best_torrent_title && m.best_seeders != null
      ? String(m.best_seeders)
      : null;

  const parts: readonly (readonly [string, string | null])[] = [
    ['Score', score.toFixed(1)],
    ['Year', m.tmdb_year ? String(m.tmdb_year) : null],
    ['Genres', g.length ? g.join(', ') : null],
    ['Runtime', runtime],
    ['Rating', rating],
    ['Studios', studios.length ? studios.join(', ') : null],
    ['Director', m.director ?? null],
    ['Cast', cast.length ? cast.join(', ') : null],
    ['Torrent', torrent],
    ['Seeders', seeders],
  ];
  return parts
    .filter((p): p is readonly [string, string] => p[1] !== null)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

function feedTitle(view: string, lang: string, sort: string): string {
  const v = view === 'plan' ? '1 TB plan' : 'Catalog';
  const langPart = lang === 'all' ? 'all languages' : lang.toUpperCase();
  const sortPart = sort === 'date' ? 'newest first' : 'best first';
  return `scenery — ${v} (${langPart}, ${sortPart})`;
}

function renderItem(
  origin: string,
  s: ScoredMovie,
  trackers: readonly string[],
): string {
  const { row: m, score } = s;
  const title = m.tmdb_title ?? m.latest_release_title ?? m.imdb_id;
  const year = m.tmdb_year ? ` (${m.tmdb_year})` : '';
  const fullTitle = `${title}${year} — ${score.toFixed(1)}`;
  const imdbLink = `https://www.imdb.com/title/${m.imdb_id}/`;
  const description = descriptionFor(s);
  const guid = m.best_info_hash
    ? `${m.imdb_id}:${m.best_info_hash}`
    : m.imdb_id;

  const enclosure = m.best_info_hash
    ? `<enclosure url="${escapeXml(
        buildMagnet(m.best_info_hash, m.best_torrent_title, trackers),
      )}" length="${m.best_size_bytes ?? 0}" type="application/x-bittorrent"/>`
    : '';

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
  const { lang, sort, view } = parseViewOptions({
    lang: url.searchParams.get('lang'),
    sort: url.searchParams.get('sort'),
    view: url.searchParams.get('view'),
  });
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
  const catalog = CatalogService.fromD1(db);
  const { movies } = await catalog.view({ lang, sort, view });
  const trackers = await bestTrackers(withRetry(genericTransport()));

  // In plan view, only emit movies that actually fit.
  const eligible: readonly ScoredMovie[] =
    view === 'plan' ? movies.filter((m) => m.fits) : movies;

  // Disk-space gate: `cumBytes` is the SQL-computed running total in the
  // feed's sort order (unsized rows contribute 0), so keeping the sized
  // rows whose running total stays within the budget is a threshold
  // filter — no cumulative summing in JS. The total is monotonic, so the
  // kept rows are exactly the in-budget prefix.
  const usable: readonly ScoredMovie[] =
    budgetBytes === null
      ? eligible
      : eligible.filter(
          (m) => (m.row.best_size_bytes ?? 0) > 0 && m.cumBytes <= budgetBytes,
        );

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
${items.map((s) => renderItem(origin, s, trackers)).join('\n')}
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
