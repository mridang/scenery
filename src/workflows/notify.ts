import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';

import { CatalogService, type ScoredMovie } from '../lib/catalog';
import {
  PushSubscriptionRepository,
  sendPush,
  type PushPayload,
  type PushSubscriptionRecord,
  type VapidConfig,
} from '../lib/push';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SITE_URL = 'https://scenery.apps.mrida.ng';

/** Parameters accepted by {@link NotifyWorkflow}. @public */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NotifyWorkflowParams {}

/**
 * Daily 17:00 UTC tick: surface the five highest-scoring movies first
 * seen in the last 24 h as a single Web Push to every subscribed
 * device.
 *
 * Each push is a step.do so a recoverable HTTP error (push service hot
 * patch, transient 503) is retried automatically; 404/410 ("Gone") is
 * treated as the user having unsubscribed at the browser, and the row
 * is dropped from D1.
 *
 * @public
 */
export class NotifyWorkflow extends WorkflowEntrypoint<
  CloudflareEnv,
  NotifyWorkflowParams
> {
  public override async run(
    _event: WorkflowEvent<NotifyWorkflowParams>,
    step: WorkflowStep,
  ) {
    const retry = { retries: { limit: 3, delay: '10 seconds' } } as const;

    const picks = await step.do('pick-top-5', async () =>
      pickTopFiveNew(this.env.DB),
    );
    if (picks.length === 0) {
      // Empty catalog (nothing to ever send).
      return { skipped: 'empty catalog', sent: 0 };
    }

    const payload = buildPayload(picks);

    const subscriptions = await step.do('list-subscriptions', async () =>
      new PushSubscriptionRepository(this.env.DB).listAll(),
    );
    if (subscriptions.length === 0) {
      return { skipped: 'no subscribers', sent: 0 };
    }

    const vapid: VapidConfig = {
      publicKey: this.env.VAPID_PUBLIC_KEY,
      privateKey: this.env.VAPID_PRIVATE_KEY,
      subject: this.env.VAPID_SUBJECT,
    };

    const sent = await subscriptions.reduce<Promise<number>>(
      async (accP, subscription) => {
        const acc = await accP;
        const delivered = await step.do(
          `send:${shortKey(subscription.endpoint)}`,
          retry,
          async () => deliverOne(this.env.DB, subscription, payload, vapid),
        );
        return acc + (delivered ? 1 : 0);
      },
      Promise.resolve(0),
    );

    return { sent, total: subscriptions.length, payload };
  }
}

async function deliverOne(
  db: D1Database,
  subscription: PushSubscriptionRecord,
  payload: PushPayload,
  vapid: VapidConfig,
): Promise<boolean> {
  const repo = new PushSubscriptionRepository(db);
  const result = await sendPush({ subscription, payload, vapid });
  if (result.gone) {
    await repo.remove(subscription.endpoint);
    return false;
  }
  const ok = result.status >= 200 && result.status < 300;
  if (ok) {
    await repo.markSent(subscription.endpoint, new Date().toISOString());
  }
  return ok;
}

async function pickTopFiveNew(db: D1Database): Promise<readonly ScoredMovie[]> {
  const catalog = CatalogService.fromD1(db);
  const view = await catalog.view({
    lang: 'all',
    sort: 'score',
    view: 'catalog',
  });
  // "new in the last 24 h" means we discovered it within the window —
  // movies.first_seen_at, not releases.first_posted_at. The latter is
  // the source's original post date which can be days old even for
  // movies we just scraped, and missing that distinction was hiding
  // every legitimate pick.
  const cutoff = Date.now() - ONE_DAY_MS;
  const fresh = view.movies.filter((movie) => {
    const firstSeen = movie.row.first_seen_at;
    return (
      firstSeen !== null &&
      firstSeen !== undefined &&
      Date.parse(firstSeen) >= cutoff
    );
  });
  // Fallback for low-traffic days and the manual push_trigger operation
  // smoke test: if nothing fresh, still surface the top 5 overall so
  // the notification path itself stays verifiable.
  const picks = fresh.length > 0 ? fresh : view.movies;
  return picks.slice(0, 5);
}

function buildPayload(picks: readonly ScoredMovie[]): PushPayload {
  const today = new Date().toISOString().slice(0, 10);
  const titles = picks
    .map((movie) => movie.row.tmdb_title ?? movie.row.imdb_id)
    .join(' · ');
  const top = picks[0]!;
  const image =
    top.row.poster_path !== null
      ? `https://image.tmdb.org/t/p/w500${top.row.poster_path}`
      : undefined;
  const count = picks.length;
  return {
    title: count === 1 ? '1 new movie today' : `${count} new movies today`,
    body: titles,
    image,
    tag: `daily-${today}`,
    url: SITE_URL,
  };
}

/** Endpoint URLs are long; we only need a stable short id for the step name. */
function shortKey(endpoint: string): string {
  // Take the last URL path segment — push services use a long random
  // token there, which is unique enough for distinguishing steps within
  // a single workflow instance.
  const segments = endpoint.split('/');
  const last = segments[segments.length - 1] ?? endpoint;
  return last.slice(0, 32);
}
