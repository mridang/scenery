# scenery

A self-hosted movie-release tracker that scrapes release sites, enriches
each title from TMDB, scores it into a ranked download queue, and finds
the best torrent for it — all running on Cloudflare Workers + D1, driven
by Cloudflare Workflows on a daily cron.

Live: `https://scenery.<subdomain>.workers.dev`

## What it does

```
 scrape            enrich                    torrents
 ──────            ──────                    ────────
 scnsrc     ──►   TMDB /find + credits  ──►  Torrentio + apibay (TPB)
 ddlvalley        + people prestige          via ScrapingAnt proxy
   │               + budget/recency score      │
   ▼                      │                     ▼
 releases ───────────►  movies  ◄────────── best torrent (by seeders,
 (D1)                   (D1, scored)          ~5 GB preferred)
```

1. **Scrape** — pulls page 1 of scnsrc and ddlvalley through ScrapingAnt
   (browser mode, to clear Cloudflare). Every page's raw HTML is snapshotted
   so results can be re-parsed without re-scraping. Each post yields an
   IMDb id.
2. **Enrich** — for each IMDb id, calls TMDB for title/year/genres, cast &
   crew, budget, and production companies. Each person's career vote-count
   becomes a "prestige" signal; the max across a film's cast+director is its
   `talent_score`.
3. **Score** — a Bayesian-weighted rating × vote-confidence, plus talent,
   log-budget, prestige-studio bonus, and an exponential recency boost from
   the TMDB release date. Movies bin into A/B/C/? tiers.
4. **Torrents** — 24 h after a release is posted, looks it up on Torrentio
   (which aggregates 1337x, TPB, YTS, RARBG…) with apibay as a fallback,
   routed through ScrapingAnt's rotating proxy so the Worker IP can't get
   rate-limit-banned. Picks the best torrent (closest to ~5 GB, most seeders).

The home page ranks everything top-to-bottom by score as a download queue,
with a 1 TB "plan" view that shows what fits. An RSS feed mirrors every view.

## Stack

- **Next.js (App Router, SSR)** on **Cloudflare Workers** via OpenNext
- **D1** (SQLite) for all state
- **Cloudflare Workflows** — granular, one step per movie/person/lookup,
  paced to stay under the Free-plan subrequest cap
- **Node 24 / TypeScript 6**, `strict` + `noUncheckedIndexedAccess`, all
  interfaces `readonly`
- **Vitest** unit tests for the scoring engine and torrent parsers
- **devbox** pins the toolchain (Node 24, cloudflared)

## Routes

| Route | What |
| --- | --- |
| `/` | Catalog, score-ranked. `?lang=`, `?sort=score\|date`, `?view=catalog\|plan` |
| `/feed.xml` | RSS of the same, honours the same params + `?budgetGb=N` |
| `/api/health` | JSON status + staleness (200 ok / 503 stale) |
| `/api/cron` | Manual pipeline trigger (gated by `CRON_SECRET`) |

## Local development

Everything runs through [devbox](https://www.jetify.com/devbox) on the
pinned Node 24 toolchain:

```sh
devbox run migrate        # apply D1 migrations to the local database
devbox run wrangler-dev   # Workers runtime locally on :3737 (bindings + workflows)
devbox run dev            # plain `next dev` on :3737 (no Workers bindings)
devbox run tunnel         # expose :3737 over a cloudflared quick tunnel
devbox run check          # test + build + lint (the pre-push gate)
devbox run test           # vitest
devbox run lint           # eslint
```

Secrets for local dev live in `.dev.vars` (gitignored):

```
SCRAPINGANT_API_KEY=...
TMDB_API_KEY=...
```

## Deploy

```sh
# one-time per environment
wrangler d1 create scenery-db          # paste the id into wrangler.jsonc
wrangler d1 migrations apply scenery-db --remote
wrangler secret put SCRAPINGANT_API_KEY
wrangler secret put TMDB_API_KEY
wrangler secret put CRON_SECRET        # any random string

# every release
devbox run deploy                      # opennext build + wrangler deploy
```

The cron (`0 6 * * *`, daily 06:00 UTC) fires `scheduled()`, which kicks
off the scrape / enrich / torrent workflows in parallel. To trigger a stage
by hand:

```sh
wrangler workflows trigger scenery-scrape   '{"pageNumbers":[1]}'
wrangler workflows trigger scenery-enrich   '{"movieLimit":80,"peopleLimit":250}'
wrangler workflows trigger scenery-torrents '{"limit":60,"paceSeconds":5}'
```

## Layout

```
src/
├── app/                  Next.js routes (page, feed.xml, api/*)
├── worker.ts             Workers entry: OpenNext handler + scheduled() + workflows
├── workflows/            ScrapeWorkflow · EnrichWorkflow · TorrentWorkflow
└── lib/
    ├── sources/          ScnsrcSource · DdlvalleySource + ScrapingAntFetcher
    ├── scraping/         ScrapeOrchestrator · ScrapingRepository
    ├── tmdb/             TmdbClient · TmdbRepository · TmdbEnricher
    ├── torrents/         TorrentLookupManager · providers (torrentio, apibay)
    ├── catalog/          CatalogRepository · ScoringEngine · ViewBuilder
    └── util/             retry · budget · proxy-fetch · logging
migrations/               D1 schema (0001 … 0011)
```
