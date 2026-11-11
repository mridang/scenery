/**
 * RSS rendering for the feed route. The XML itself is produced by the
 * `feed` library (escaping, channel/item structure, the atom self-link);
 * this module only maps our domain rows into feed items and builds the
 * human-readable `<description>` body.
 */
import { countOf, formatRating, formatSize } from '@/lib/intl';
import { Feed } from 'feed';

import type { ScoredMovie } from '@/domain/catalog';
import { buildMagnet } from '@/lib/magnet';

function fmtSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) {
    return '';
  }
  return formatSize(bytes);
}

/** The multi-line `<description>` body for one movie (labelled fields). */
export function descriptionFor(movie: ScoredMovie): string {
  const { row, studios, genres, cast, score } = movie;
  const runtime =
    row.runtime != null && row.runtime
      ? (() => {
          const hours = Math.floor(row.runtime / 60);
          const mins = row.runtime % 60;
          return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        })()
      : null;
  const rating =
    row.vote_average == null
      ? null
      : `${formatRating(row.vote_average)}${
          row.vote_count == null ? '' : ` (${countOf(row.vote_count, 'vote')})`
        }`;
  const torrent = row.best_torrent_title
    ? `${row.best_torrent_title} (${[
        row.best_quality,
        fmtSize(row.best_size_bytes),
        row.best_source,
      ]
        .filter(Boolean)
        .join(' · ')})`
    : null;
  const seeders =
    row.best_torrent_title && row.best_seeders != null
      ? String(row.best_seeders)
      : null;

  const parts: readonly (readonly [string, string | null])[] = [
    ['Score', formatRating(score)],
    ['Year', row.tmdb_year ? String(row.tmdb_year) : null],
    ['Genres', genres.length > 0 ? genres.join(', ') : null],
    ['Runtime', runtime],
    ['Rating', rating],
    ['Studios', studios.length > 0 ? studios.join(', ') : null],
    ['Director', row.director ?? null],
    ['Cast', cast.length > 0 ? cast.join(', ') : null],
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
  const viewLabel = view === 'plan' ? '1 TB plan' : 'Catalog';
  const langPart = lang === 'all' ? 'all languages' : lang.toUpperCase();
  const sortPart = sort === 'date' ? 'newest first' : 'best first';
  return `Scenery — ${viewLabel} (${langPart}, ${sortPart})`;
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
export function buildFeed(channel: FeedChannel): string {
  const feed = new Feed({
    id: channel.altHref,
    title: feedTitle(channel.view, channel.lang, channel.sort),
    link: channel.altHref,
    description: `Scored movie releases from Scenery, sorted ${channel.sort === 'date' ? 'by date' : 'by score'}.`,
    language: 'en-us',
    generator: 'Scenery',
    copyright: 'Scenery',
    updated: channel.updated,
    feedLinks: { rss: channel.selfHref },
  });

  for (const movie of channel.items) {
    const row = movie.row;
    const title = row.tmdb_title ?? row.latest_release_title ?? row.imdb_id;
    const year = row.tmdb_year ? ` (${row.tmdb_year})` : '';
    const releaseMs = row.latest_release_at
      ? Date.parse(row.latest_release_at)
      : Number.NaN;
    feed.addItem({
      title: `${title}${year} — ${formatRating(movie.score)}`,
      id: row.best_info_hash
        ? `${row.imdb_id}:${row.best_info_hash}`
        : row.imdb_id,
      link: `https://www.imdb.com/title/${row.imdb_id}/`,
      date: new Date(Number.isFinite(releaseMs) ? releaseMs : 0),
      description: descriptionFor(movie),
      ...(row.best_info_hash
        ? {
            enclosure: {
              url: buildMagnet(
                row.best_info_hash,
                row.best_torrent_title,
                channel.trackers,
              ),
              type: 'application/x-bittorrent',
              length: row.best_size_bytes ?? 0,
            },
          }
        : {}),
    });
  }

  return feed.rss2();
}
