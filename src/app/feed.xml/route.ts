import type { NextRequest } from 'next/server';
import { database } from '@/domain/db/client';
import { CatalogService, parseViewOptions } from '@/domain/catalog';
import type { ScoredMovie } from '@/domain/catalog';
import { bestTrackers } from '@/lib/magnet';
import { genericTransport, withRetry } from '@/lib/transport';

import { buildFeed } from './_lib/rss';

export const dynamic = 'force-dynamic';

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
  // Disk-space gate: ?budgetGb=500 cuts items off once cumulative size
  // would overflow. Items without a measured torrent size are excluded
  // when this param is set (we can't budget what we don't measure).
  const budgetGbRaw = url.searchParams.get('budgetGb');
  const budgetBytes =
    budgetGbRaw === null
      ? null
      : Math.max(0, Number(budgetGbRaw)) * 1_000_000_000;

  const catalog = CatalogService.fromDatabase(database());
  const { movies } = await catalog.view({ lang, sort, view });
  const trackers = await bestTrackers(withRetry(genericTransport()));

  // In plan view, only emit movies that actually fit.
  const eligible: readonly ScoredMovie[] =
    view === 'plan' ? movies.filter((movie) => movie.fits) : movies;

  // `cumBytes` is the SQL-computed running total in the feed's sort order,
  // so keeping the sized rows whose total stays within budget is a simple
  // threshold filter — no cumulative summing in JS, and (since the total
  // is monotonic) the kept rows are exactly the in-budget prefix.
  const usable: readonly ScoredMovie[] =
    budgetBytes === null
      ? eligible
      : eligible.filter(
          (movie) =>
            (movie.row.best_size_bytes ?? 0) > 0 &&
            movie.cumBytes <= budgetBytes,
        );

  const qs = url.searchParams.toString();
  const xml = buildFeed({
    items: usable.slice(0, limit),
    trackers,
    view,
    lang,
    sort,
    selfHref: `${url.origin}/feed.xml?${qs}`,
    altHref: `${url.origin}/?${qs}`,
    updated: new Date(),
  });

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      // The catalog only changes once a day (the 06:00 UTC cron), so the
      // edge caches the feed for 6h and serves it stale for up to a day
      // while it revalidates. Browsers hold it briefly (5 min).
      'Cache-Control':
        'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400',
      Vary: 'Accept-Encoding',
    },
  });
}
