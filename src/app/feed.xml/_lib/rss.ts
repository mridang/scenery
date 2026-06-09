/**
 * RSS rendering for the feed route. The XML itself is produced by the
 * `feed` library (escaping, channel/item structure, the atom self-link);
 * this module only maps our domain rows into feed items and builds the
 * human-readable `<description>` body.
 */
import { Feed } from 'feed';

import type { ScoredMovie } from '@/lib/catalog';
import { buildMagnet } from '@/lib/magnet';

function fmtSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) {
    return '';
  }
  const gb = bytes / 1_000_000_000;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1_000_000)} MB`;
}

/** The multi-line `<description>` body for one movie (labelled fields). */
export function descriptionFor(s: ScoredMovie): string {
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

/** The channel `<title>` for a given view/lang/sort. */
export function feedTitle(view: string, lang: string, sort: string): string {
  const v = view === 'plan' ? '1 TB plan' : 'Catalog';
  const langPart = lang === 'all' ? 'all languages' : lang.toUpperCase();
  const sortPart = sort === 'date' ? 'newest first' : 'best first';
  return `scenery — ${v} (${langPart}, ${sortPart})`;
}

/** Everything needed to render one feed document. */
export interface FeedChannel {
  readonly items: readonly ScoredMovie[];
  readonly trackers: readonly string[];
  readonly view: string;
  readonly lang: string;
  readonly sort: string;
  /** Absolute self URL for the atom self-link. */
  readonly selfHref: string;
  /** Absolute URL of the matching HTML view, for the channel link. */
  readonly altHref: string;
  /** Build timestamp for `<lastBuildDate>`. */
  readonly updated: Date;
}

/** Render the full RSS 2.0 document for a feed channel via `feed`. */
export function buildFeed(c: FeedChannel): string {
  const feed = new Feed({
    id: c.altHref,
    title: feedTitle(c.view, c.lang, c.sort),
    link: c.altHref,
    description: `Scored movie releases from scenery, sorted ${c.sort === 'date' ? 'by date' : 'by score'}.`,
    language: 'en-us',
    generator: 'scenery',
    copyright: 'scenery',
    updated: c.updated,
    feedLinks: { rss: c.selfHref },
  });

  for (const s of c.items) {
    const m = s.row;
    const title = m.tmdb_title ?? m.latest_release_title ?? m.imdb_id;
    const year = m.tmdb_year ? ` (${m.tmdb_year})` : '';
    const t = m.latest_release_at ? Date.parse(m.latest_release_at) : NaN;
    feed.addItem({
      title: `${title}${year} — ${s.score.toFixed(1)}`,
      id: m.best_info_hash ? `${m.imdb_id}:${m.best_info_hash}` : m.imdb_id,
      link: `https://www.imdb.com/title/${m.imdb_id}/`,
      date: new Date(Number.isFinite(t) ? t : 0),
      description: descriptionFor(s),
      ...(m.best_info_hash
        ? {
            enclosure: {
              url: buildMagnet(
                m.best_info_hash,
                m.best_torrent_title,
                c.trackers,
              ),
              type: 'application/x-bittorrent',
              length: m.best_size_bytes ?? 0,
            },
          }
        : {}),
    });
  }

  return feed.rss2();
}
