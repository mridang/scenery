# scenery

A self-hosted movie-release tracker that scrapes release sites, enriches each title from TMDB and OMDB, scores it into a ranked download queue, and finds the best torrent for it. It runs on Cloudflare Workers and D1, driven by Cloudflare Workflows on a daily cron.

Live: https://scenery.apps.mrida.ng

## Stack

- Next.js (App Router, SSR) on Cloudflare Workers via OpenNext
- D1 (SQLite) with Drizzle for all state
- Cloudflare Workflows: one scrape instance per run and one instance per movie, so each stays well under the subrequest cap
- devbox pins Node 24
- Jest for unit tests, Cypress for end-to-end tests
- `@mridang/eslint-defaults` for linting
- Web Push (VAPID) for the daily notification

## What it does

```
 scrape            enrich (per movie)         torrents (per movie)
 ──────            ──────────────────         ────────────────────
 scnsrc     ──►   TMDB /find + credits  ──►  Torrentio + apibay (TPB)
 ddlvalley        + people prestige          via ScrapingAnt proxy
   │              + OMDB ratings                │
   ▼                      │                     ▼
 releases ───────────►  movies  ◄────────── best torrent (by seeders,
 (D1)                   (D1, scored)          ~5 GB preferred)
```

1. **Scrape**: pulls page 1 of scnsrc and ddlvalley through ScrapingAnt (browser mode, to clear Cloudflare). Each post yields an IMDb id, and a `MovieWorkflow` instance is started for every movie (the instance id is the IMDb id, so a movie is only handled once).
2. **Enrich**: for each IMDb id, calls TMDB for title, year, genres, cast and crew, budget and production companies, then OMDB for IMDb, Metacritic and Rotten Tomatoes ratings. Each person's career vote count becomes a prestige signal; the maximum across a film's cast and director is its `talent_score`.
3. **Score**: a Bayesian-weighted rating times vote confidence, plus talent, log-budget, a prestige-studio bonus and an exponential recency boost from the TMDB release date. Movies bin into A/B/C/? tiers.
4. **Torrents**: the movie workflow sleeps 26 hours after the release is posted, then looks it up on Torrentio (which aggregates 1337x, TPB, YTS and others) with apibay as a fallback, apibay routed through ScrapingAnt's rotating proxy. It picks the best torrent (closest to about 5 GB, most seeders).

The home page ranks everything top to bottom by score as a download queue, with a 1 TB "plan" view that shows what fits. An RSS feed mirrors every view. Once a day a Web Push notification lists the five highest-scoring movies first seen in the last 24 hours.

## Routes

| Route                                                                 | What                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                   | Catalog, score-ranked. `?lang=`, `?sort=score\|date`, `?view=catalog\|plan`                                                     |
| `/feed.xml`                                                           | RSS of the same, honours the same params plus `?limit=N` and `?budgetGb=N`                                                      |
| `/magnet/{hash}`                                                      | Redirects to a magnet link built with the current best tracker list                                                             |
| `/health`                                                             | JSON status and staleness (200 ok, 503 when there has been no scrape in 48 hours)                                               |
| `POST /api/operations`                                                | Runs a manual operation (`pipeline_run`, `omdb_backfill` or `push_trigger`) and records it; `CRON_SECRET` bearer token when set |
| `GET /api/operations/{id}`                                            | One operation and its result (same token)                                                                                       |
| `GET /api/push/configuration`                                         | The VAPID public key for `pushManager.subscribe` (`vapid_public_key`)                                                           |
| `POST /api/push/subscriptions`, `DELETE /api/push/subscriptions/{id}` | Register (201, or 200 when known) and forget a Web Push subscription                                                            |
| `/img`                                                                | Image proxy: scales and caches TMDB images (`?url=&w=`)                                                                         |
| `/csp/reports`                                                        | Receives Content Security Policy violation reports                                                                              |

The REST contract is everything under `/api`; the other routes follow their own protocols. The security headers and the nonce-based Content Security Policy are added by the Worker itself (`src/lib/http`), not by Next.js.

## Local development

All commands go through devbox, which pins Node 24:

```sh
devbox run -- npm run migrate      # apply D1 migrations to the local database
devbox run -- npm run dev          # next dev on http://localhost:3737
devbox run -- npm test             # jest
devbox run -- npm run lint         # eslint
devbox run -- npm run typecheck    # tsc --noEmit
devbox run -- npm run format       # prettier
```

Secrets for local development live in `.env` (gitignored):

```
SCRAPINGANT_API_KEY=...
TMDB_API_KEY=...
OMDB_API_KEY=...
CRON_SECRET=...
VAPID_PRIVATE_KEY=...
```

## Deploy

```sh
# one-time per environment
devbox run -- npx wrangler d1 create scenery-db          # paste the id into wrangler.jsonc
devbox run -- npx wrangler d1 migrations apply DB --remote
devbox run -- npx wrangler secret put SCRAPINGANT_API_KEY
devbox run -- npx wrangler secret put TMDB_API_KEY
devbox run -- npx wrangler secret put OMDB_API_KEY
devbox run -- npx wrangler secret put CRON_SECRET        # any random string
devbox run -- npx wrangler secret put VAPID_PRIVATE_KEY

# every release
devbox run -- npm run deploy                             # opennextjs-cloudflare build && wrangler deploy
```

The custom domain `scenery.apps.mrida.ng` requires the `apps.mrida.ng` zone on the Cloudflare account; the `workers.dev` subdomain is disabled. The public VAPID key and subject are plain `vars` in `wrangler.jsonc`.

GitHub Actions (`deploy.yml`) applies the D1 migrations and deploys on pushes to `master`.

## Operations

Two crons are declared in `wrangler.jsonc`, and `src/worker.ts` routes on the expression that fired:

- `0 6 * * *` (06:00 UTC) starts `ScrapeWorkflow`, which scrapes the sources and starts a `MovieWorkflow` for each movie.
- `0 17 * * *` (17:00 UTC) starts `NotifyWorkflow`, which sends the daily push.

The three workflows are `scenery-scrape`, `scenery-movie` and `scenery-notify`. To start one by hand:

```sh
devbox run -- npx wrangler workflows trigger scenery-scrape '{"pageNumbers":[1]}'
devbox run -- npx wrangler workflows trigger scenery-movie '{"imdbId":"tt0000000"}'
devbox run -- npx wrangler workflows trigger scenery-notify '{}'
```

## Layout

```
src/
├── app/                  Next.js routes (page, feed.xml, magnet, api/*)
├── worker.ts             Workers entry: OpenNext handler + scheduled() + workflow exports
├── workflows/            ScrapeWorkflow · MovieWorkflow · NotifyWorkflow
└── lib/
    ├── sources/          ScnsrcSource · DdlvalleySource
    ├── scraping/         ScrapeOrchestrator · ScrapingRepository
    ├── tmdb/             TmdbClient · TmdbRepository · TmdbEnricher
    ├── omdb/             OmdbEnricher
    ├── torrents/         TorrentLookupManager · providers (torrentio, apibay)
    ├── transport/        generic, proxy and browser fetchers · retry
    ├── catalog/          CatalogRepository · scoring · view building
    ├── push/             push subscriptions and sending
    ├── http/             security headers, CSP and nonce, CSP reports
    └── util/             logging and runtime helpers
migrations/               D1 schema (0001 … 0013)
```
