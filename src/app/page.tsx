import { Fragment } from 'react';
import Link from 'next/link';
import { getDB } from '@/lib/db';
import { BUDGET_BYTES, CatalogRepository, ViewBuilder } from '@/lib/catalog';
import type { Tier } from '@/lib/catalog';

/**
 * Staleness threshold for the top-of-page banner. Beyond this, the
 * banner appears and the user knows the workflow has been failing
 * silently.
 */
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

/** Known {@link ViewOptions['sort']} values, used to validate `?sort=`. */
const KNOWN_SORTS = new Set(['score', 'date']);
/** Known {@link ViewOptions['view']} values, used to validate `?view=`. */
const KNOWN_VIEWS = new Set(['catalog', 'plan']);

export const dynamic = 'force-dynamic';

function genreNames(raw: string | null, lookup: Map<number, string>): string[] {
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

function formatRuntime(min: number | null): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
function isFresh(at: string | null, nowMs: number): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && nowMs - t < DAY_MS;
}

function timeAgo(at: string | null, nowMs: number): string {
  if (!at) return 'never';
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return 'never';
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const TIER_STYLE: Record<Tier, string> = {
  A: 'border-emerald-500 bg-emerald-50/60',
  B: '',
  C: 'border-gray-300 bg-gray-50/60 opacity-70',
  '?': 'border-sky-400 bg-sky-50/40',
};
const TIER_BADGE: Record<Tier, string> = {
  A: 'bg-emerald-500 text-white',
  B: 'bg-gray-300 text-gray-700',
  C: 'bg-gray-400 text-white',
  '?': 'bg-sky-400 text-white',
};

// Visual class per prestige studio label (logic lives in catalog.ts).
const PRESTIGE_CLS: Record<string, string> = {
  Netflix: 'bg-red-600 text-white',
  'Apple TV+': 'bg-black text-white',
  Marvel: 'bg-red-700 text-white',
  HBO: 'bg-fuchsia-700 text-white',
  A24: 'bg-neutral-900 text-white',
  'Amazon MGM': 'bg-sky-700 text-white',
  Searchlight: 'bg-amber-700 text-white',
  Annapurna: 'bg-violet-700 text-white',
  Focus: 'bg-slate-700 text-white',
  NEON: 'bg-lime-500 text-black',
  'Plan B': 'bg-orange-600 text-white',
  Disney: 'bg-blue-800 text-white',
  'Warner Bros': 'bg-blue-900 text-white',
  Universal: 'bg-zinc-800 text-white',
  Paramount: 'bg-blue-700 text-white',
  'Metro-Goldwyn-Mayer': 'bg-amber-600 text-white',
  Lionsgate: 'bg-yellow-600 text-white',
};
function prestigeCls(label: string): string {
  return PRESTIGE_CLS[label] ?? 'bg-gray-700 text-white';
}

function fmtMoney(n: number | null): string | null {
  if (n == null || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${Math.round(n / 1000)}K`;
}

function fmtSize(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  const gb = bytes / 1_000_000_000;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.round(bytes / 1_000_000)} MB`;
}

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

type TorrentBadge =
  | { kind: 'ok'; cls: string; label: string }
  | { kind: 'waiting'; cls: string; label: string }
  | { kind: 'empty'; cls: string; label: string }
  | { kind: 'error'; cls: string; label: string }
  | { kind: 'pending'; cls: string; label: string };

function torrentBadge(
  status: string | null,
  // The movie's newest release post-time (MAX posted_at), which is what
  // the 24h maturity gate keys off — not when we scraped it.
  releaseAt: string | null,
  nowMs: number,
  count: number | null,
): TorrentBadge {
  if (status === 'success' && (count ?? 0) > 0) {
    return { kind: 'ok', cls: 'bg-emerald-600 text-white', label: '✓ torrent' };
  }
  if (status === 'empty') {
    return {
      kind: 'empty',
      cls: 'bg-gray-300 text-gray-700',
      label: 'no torrents',
    };
  }
  if (status === 'error') {
    return {
      kind: 'error',
      cls: 'bg-red-600 text-white',
      label: '✗ lookup err',
    };
  }
  // No lookup row yet — too fresh, or simply not searched.
  const seen = releaseAt !== null ? Date.parse(releaseAt) : NaN;
  const age = Number.isFinite(seen) ? nowMs - seen : Infinity;
  if (age < 24 * 60 * 60 * 1000) {
    const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - age) / (60 * 60 * 1000));
    return {
      kind: 'waiting',
      cls: 'bg-amber-300 text-amber-900',
      label: `⏳ wait ${hoursLeft}h`,
    };
  }
  return {
    kind: 'pending',
    cls: 'bg-sky-200 text-sky-900',
    label: '⏳ pending',
  };
}

const LANG_NAME: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  th: 'Thai',
  tr: 'Turkish',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  nl: 'Dutch',
  no: 'Norwegian',
  fi: 'Finnish',
  ar: 'Arabic',
  '?': 'Unknown',
};
function langLabel(code: string): string {
  return LANG_NAME[code] ?? code.toUpperCase();
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; sort?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const lang = (sp.lang ?? 'en').toLowerCase();
  const rawSort = (sp.sort ?? 'score').toLowerCase();
  const rawView = (sp.view ?? 'catalog').toLowerCase();
  // Reject unknown values so a typo / malicious query lands on the
  // default view rather than throwing the SQL path off.
  const sort = KNOWN_SORTS.has(rawSort) ? rawSort : 'score';
  const view = KNOWN_VIEWS.has(rawView) ? rawView : 'catalog';

  const db = getDB();
  const repo = new CatalogRepository(db);
  const viewer = new ViewBuilder(repo);
  const [stats, viewResult, genres, langs, lastUpdate] = await Promise.all([
    repo.loadStats(),
    viewer.build({ lang, sort, view }),
    repo.loadGenres(),
    repo.loadLanguageCounts(),
    repo.loadLastUpdate(),
  ]);
  const { movies: rows, plan } = viewResult;
  const planTotalFits = plan?.fits ?? 0;
  const planTotalSkipped = plan?.skipped ?? 0;
  const planBytesFits = plan?.bytesFits ?? 0;
  const nowMs = Date.now();

  const feedQs = new URLSearchParams({ lang, sort, view });
  const feedHref = `/feed.xml?${feedQs.toString()}`;
  const isStale =
    lastUpdate.scrapeAt === null ||
    nowMs - Date.parse(lastUpdate.scrapeAt) > STALE_THRESHOLD_MS;

  return (
    <main className="mx-auto max-w-5xl p-3 font-mono text-sm sm:p-6">
      <link
        rel="alternate"
        type="application/rss+xml"
        title={`scenery — ${view === 'plan' ? '1 TB plan' : 'Catalog'} (${lang}, ${sort})`}
        href={feedHref}
      />

      {isStale ? (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800 sm:text-sm">
          <span className="font-bold uppercase">⚠ stale</span> — last scrape{' '}
          <span title={lastUpdate.scrapeAt ?? ''}>
            {timeAgo(lastUpdate.scrapeAt, nowMs)}
          </span>
          . The workflow may be failing. Trigger a manual scrape, or check the
          cron logs.
        </div>
      ) : null}

      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold sm:text-xl">scenery</h1>
          <div className="text-[11px] leading-snug text-gray-500">
            scrape{' '}
            <span title={lastUpdate.scrapeAt ?? ''}>
              {timeAgo(lastUpdate.scrapeAt, nowMs)}
            </span>
            {lastUpdate.scrapeSource ? ` (${lastUpdate.scrapeSource})` : ''}
            {' · '}tmdb{' '}
            <span title={lastUpdate.enrichAt ?? ''}>
              {timeAgo(lastUpdate.enrichAt, nowMs)}
            </span>
            {' · '}torrents{' '}
            <span title={lastUpdate.torrentsAt ?? ''}>
              {timeAgo(lastUpdate.torrentsAt, nowMs)}
            </span>
            {lastUpdate.torrentsProvider
              ? ` (${lastUpdate.torrentsProvider})`
              : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={feedHref}
            className="rounded border border-orange-500 px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50"
          >
            RSS
          </a>
          <form
            action="/api/cron"
            method="post"
            className="flex flex-wrap gap-2"
          >
            <button
              type="submit"
              formAction="/api/cron?backfill=10"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-100 sm:px-3"
            >
              Backfill 10
            </button>
            <button
              type="submit"
              formAction="/api/cron?enrichOnly=1"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-100 sm:px-3"
            >
              TMDB enrich
            </button>
            <button
              type="submit"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-100 sm:px-3"
            >
              Scrape p1
            </button>
          </form>
        </div>
      </header>

      <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500">View:</span>
        <ViewChip
          view="catalog"
          active={view}
          sort={sort}
          lang={lang}
          label="Catalog"
        />
        <ViewChip
          view="plan"
          active={view}
          sort={sort}
          lang={lang}
          label="1 TB plan"
        />
        <span className="ml-4 text-gray-500">Sort:</span>
        <SortChip
          sort="score"
          active={sort}
          lang={lang}
          view={view}
          label="Score (best first)"
        />
        <SortChip
          sort="date"
          active={sort}
          lang={lang}
          view={view}
          label="Date (newest first)"
        />
      </nav>

      {view === 'plan' ? (
        <PlanSummary
          fits={planTotalFits}
          skipped={planTotalSkipped}
          bytesFits={planBytesFits}
          budget={BUDGET_BYTES}
        />
      ) : null}

      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500">Language:</span>
        <LangChip
          code="en"
          active={lang}
          sort={sort}
          count={langs.find((l) => l.code === 'en')?.count ?? 0}
        />
        {langs
          .filter((l) => l.code !== 'en' && l.code !== '?')
          .map((l) => (
            <LangChip
              key={l.code}
              code={l.code}
              active={lang}
              sort={sort}
              count={l.count}
            />
          ))}
        {langs.some((l) => l.code === '?') ? (
          <LangChip
            code="?"
            active={lang}
            sort={sort}
            count={langs.find((l) => l.code === '?')!.count}
          />
        ) : null}
        <LangChip
          code="all"
          active={lang}
          sort={sort}
          count={langs.reduce((s, l) => s + l.count, 0)}
        />
      </nav>

      <section className="mb-6 grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
        <Stat label="releases" value={stats.releases} />
        <Stat label="movies" value={stats.movies} />
        <Stat label="snapshots" value={stats.snapshots} />
        <Stat
          label="failed"
          value={stats.failed_attempts}
          highlight={stats.failed_attempts > 0}
        />
        <Stat label="tmdb ✓" value={stats.tmdb_found} />
        <Stat label="tmdb ✗" value={stats.tmdb_not_found} />
        <Stat
          label="pending"
          value={stats.tmdb_pending}
          highlight={stats.tmdb_pending > 0}
        />
      </section>

      {rows.length === 0 ? (
        <p className="text-gray-500">
          No movies yet. Click <em>Backfill 10 pages</em> to seed.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map(({ row: m, studios, score, tier, cumBytes, fits }, idx) => {
            const prev = idx > 0 ? rows[idx - 1] : null;
            const cutoffHere = view === 'plan' && prev && prev.fits && !fits;
            const names = genreNames(m.tmdb_genre_ids, genres);
            const cast = castNames(m.top_cast);
            const runtime = formatRuntime(m.runtime);
            const poster = m.poster_path
              ? `https://image.tmdb.org/t/p/w92${m.poster_path}`
              : null;
            const title = m.tmdb_title ?? m.latest_release_title ?? m.imdb_id;
            const fresh = isFresh(m.latest_release_at, nowMs);
            const budget = fmtMoney(m.budget);
            const tierClass = TIER_STYLE[tier];
            const planMode = view === 'plan';
            const planCumGb = planMode
              ? (cumBytes / 1_000_000_000).toFixed(1)
              : null;
            const planClass =
              planMode && !fits
                ? 'border-l-4 border-gray-300 bg-gray-50/60 opacity-60'
                : '';
            const freshClass = planMode
              ? planClass
              : fresh
                ? 'border-l-4 border-amber-400 bg-amber-50/60'
                : tierClass
                  ? `border-l-4 ${tierClass}`
                  : '';
            return (
              <Fragment key={m.imdb_id}>
                {cutoffHere ? (
                  <li className="my-2 flex items-center gap-2 border-y border-dashed border-purple-500 bg-purple-50 px-2 py-2 text-xs font-semibold text-purple-700 uppercase">
                    ── 1 TB cutoff ── everything below won&apos;t fit
                  </li>
                ) : null}
                <li
                  className={`flex items-start gap-2 px-2 py-3 sm:gap-3 ${freshClass}`}
                >
                  {poster ? (
                    <img
                      src={poster}
                      alt=""
                      className="h-16 w-11 flex-none bg-gray-100 object-cover sm:h-20 sm:w-14"
                    />
                  ) : (
                    <div className="h-20 w-14 flex-none bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_BADGE[tier]}`}
                      >
                        {tier}
                      </span>
                      <span className="font-mono text-[11px] text-gray-500">
                        {score.toFixed(1)}
                      </span>
                      {planMode ? (
                        <span
                          className={`font-mono text-[11px] ${
                            fits ? 'text-purple-700' : 'text-gray-400'
                          }`}
                        >
                          {planCumGb} GB
                        </span>
                      ) : null}
                      <Link
                        href={`https://www.imdb.com/title/${m.imdb_id}/`}
                        target="_blank"
                        className="truncate font-semibold hover:underline"
                      >
                        {title}
                      </Link>
                      {m.tmdb_year ? (
                        <span className="text-gray-500">({m.tmdb_year})</span>
                      ) : null}
                      {studios.map((label) => (
                        <span
                          key={label}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${prestigeCls(label)}`}
                        >
                          {label}
                        </span>
                      ))}
                      {(() => {
                        const b = torrentBadge(
                          m.torrent_status,
                          m.latest_release_at,
                          nowMs,
                          m.torrent_count,
                        );
                        return (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${b.cls}`}
                          >
                            {b.label}
                          </span>
                        );
                      })()}
                      {fresh ? (
                        <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                          new
                        </span>
                      ) : null}
                      {m.tmdb_status === 'not_found' ? (
                        <span className="text-xs text-red-500 uppercase">
                          no tmdb match
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500">
                      {names.length ? names.join(', ') : '—'}
                      {runtime ? ` · ${runtime}` : ''}
                      {m.vote_average != null
                        ? ` · ★ ${m.vote_average.toFixed(1)}${
                            m.vote_count != null ? ` (${m.vote_count})` : ''
                          }`
                        : ''}
                      {budget ? ` · ${budget} budget` : ''}
                      {m.talent_score != null && m.talent_score > 0
                        ? ` · talent ${m.talent_score.toFixed(1)}`
                        : ''}
                      {' · '}
                      <Link
                        href={`https://www.imdb.com/title/${m.imdb_id}/`}
                        target="_blank"
                        className="hover:underline"
                      >
                        {m.imdb_id}
                      </Link>
                      {' · '}
                      {m.release_count} release
                      {m.release_count === 1 ? '' : 's'}
                    </div>
                    {m.director || cast.length ? (
                      <div className="text-xs text-gray-700">
                        {m.director ? (
                          <span>
                            <span className="text-gray-500">Dir:</span>{' '}
                            {m.director}
                          </span>
                        ) : null}
                        {m.director && cast.length ? (
                          <span className="text-gray-400"> · </span>
                        ) : null}
                        {cast.length ? (
                          <span>
                            <span className="text-gray-500">With:</span>{' '}
                            {cast.join(', ')}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {m.best_info_hash ? (
                      <div className="text-xs text-emerald-700">
                        <a
                          href={magnetFor(
                            m.best_info_hash,
                            m.best_torrent_title,
                          )}
                          className="font-medium hover:underline"
                        >
                          magnet ↗
                        </a>
                        {m.best_quality ? ` · ${m.best_quality}` : ''}
                        {m.best_size_bytes
                          ? ` · ${fmtSize(m.best_size_bytes)}`
                          : ''}
                        {m.best_seeders != null
                          ? ` · 👤 ${m.best_seeders}`
                          : ''}
                        {m.best_source ? ` · ${m.best_source}` : ''}
                        {(m.torrent_count ?? 0) > 1
                          ? ` · +${(m.torrent_count ?? 0) - 1} more`
                          : ''}
                      </div>
                    ) : null}
                    {m.latest_release_title ? (
                      <div className="truncate text-xs text-gray-400">
                        {m.latest_release_title}
                      </div>
                    ) : null}
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}

      <footer className="mt-10 border-t border-gray-200 pt-4 text-[11px] text-gray-500">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
          <div>
            <span className="font-semibold uppercase">Scrape</span>{' '}
            <span title={lastUpdate.scrapeAt ?? ''}>
              {timeAgo(lastUpdate.scrapeAt, nowMs)}
            </span>
            {lastUpdate.scrapeSource ? ` (${lastUpdate.scrapeSource})` : ''}
          </div>
          <div>
            <span className="font-semibold uppercase">TMDB</span>{' '}
            <span title={lastUpdate.enrichAt ?? ''}>
              {timeAgo(lastUpdate.enrichAt, nowMs)}
            </span>
          </div>
          <div>
            <span className="font-semibold uppercase">Torrents</span>{' '}
            <span title={lastUpdate.torrentsAt ?? ''}>
              {timeAgo(lastUpdate.torrentsAt, nowMs)}
            </span>
            {lastUpdate.torrentsProvider
              ? ` (${lastUpdate.torrentsProvider})`
              : ''}
          </div>
        </div>
        <div className="mt-2 text-gray-400">
          scenery · {rows.length} movies shown · view={view} · sort={sort} ·
          lang={lang}
        </div>
      </footer>
    </main>
  );
}

function buildQuery(params: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

function LangChip({
  code,
  active,
  count,
  sort,
  view,
}: {
  code: string;
  active: string;
  count: number;
  sort: string;
  view?: string;
}) {
  const isActive = code === active;
  const label = code === 'all' ? 'All' : langLabel(code);
  return (
    <Link
      href={`/${buildQuery({ lang: code, sort, view: view ?? '' })}`}
      className={`rounded border px-2 py-0.5 ${
        isActive
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}{' '}
      <span className={isActive ? 'opacity-80' : 'text-gray-400'}>{count}</span>
    </Link>
  );
}

function SortChip({
  sort,
  active,
  lang,
  view,
  label,
}: {
  sort: string;
  active: string;
  lang: string;
  view: string;
  label: string;
}) {
  const isActive = sort === active;
  return (
    <Link
      href={`/${buildQuery({ lang, sort, view })}`}
      className={`rounded border px-2 py-0.5 ${
        isActive
          ? 'border-indigo-500 bg-indigo-500 text-white'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );
}

function ViewChip({
  view,
  active,
  sort,
  lang,
  label,
}: {
  view: string;
  active: string;
  sort: string;
  lang: string;
  label: string;
}) {
  const isActive = view === active;
  return (
    <Link
      href={`/${buildQuery({ lang, sort, view })}`}
      className={`rounded border px-2 py-0.5 ${
        isActive
          ? 'border-purple-500 bg-purple-500 text-white'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </Link>
  );
}

function PlanSummary({
  fits,
  skipped,
  bytesFits,
  budget,
}: {
  fits: number;
  skipped: number;
  bytesFits: number;
  budget: number;
}) {
  const pct = Math.min(100, (bytesFits / budget) * 100);
  const usedGb = bytesFits / 1_000_000_000;
  const budgetGb = budget / 1_000_000_000;
  const freeGb = Math.max(0, budgetGb - usedGb);
  return (
    <section className="mb-4 rounded border border-purple-200 bg-purple-50/50 p-3">
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <div>
          <span className="font-semibold">{fits.toLocaleString()}</span> movies
          fit in 1 TB ·{' '}
          <span className="font-semibold">{usedGb.toFixed(1)} GB</span> used ·{' '}
          <span className="text-gray-600">{freeGb.toFixed(1)} GB headroom</span>
        </div>
        <div className="text-gray-500">
          {skipped.toLocaleString()} won&apos;t fit · budget{' '}
          {budgetGb.toFixed(0)} GB
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-purple-100">
        <div className="h-full bg-purple-500" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border px-2 py-1 sm:py-2 ${highlight ? 'border-red-500 text-red-600' : ''}`}
    >
      <div className="text-sm font-semibold sm:text-base">{value}</div>
      <div className="text-[9px] text-gray-500 uppercase sm:text-[10px]">
        {label}
      </div>
    </div>
  );
}
