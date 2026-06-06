import type { Workflow } from "cloudflare:workers";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ASSETS: Fetcher;
    SCRAPINGANT_API_KEY: string;
    TMDB_API_KEY: string;
    CRON_SECRET?: string;
    SCRAPE_WORKFLOW?: Workflow;
    ENRICH_WORKFLOW?: Workflow;
    TORRENT_WORKFLOW?: Workflow;
  }
}

export {};
