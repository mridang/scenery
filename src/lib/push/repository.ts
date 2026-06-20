/**
 * @packageDocumentation
 *
 * D1-backed store of Web Push subscriptions: insert on subscribe, delete
 * on 410 Gone or explicit unsubscribe, and a list-all for the cron tick.
 * Drizzle handles the typing so the column names match the migration.
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';

import { push_subscriptions } from '../db/schema';
import type { PushSubscriptionRecord } from './types';

/** Insert + read + delete operations over the `push_subscriptions` table. @public */
export class PushSubscriptionRepository {
  private readonly db: ReturnType<typeof drizzle>;

  public constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * Upsert a subscription keyed by `endpoint`. Browsers may reissue the
   * same `endpoint` with rotated keys, so we replace the row on conflict
   * rather than treating the second call as an error.
   */
  public async upsert(
    record: PushSubscriptionRecord,
    nowIso: string,
  ): Promise<void> {
    await this.db
      .insert(push_subscriptions)
      .values({
        endpoint: record.endpoint,
        p256dh: record.p256dh,
        auth: record.auth,
        created_at: nowIso,
      })
      .onConflictDoUpdate({
        target: push_subscriptions.endpoint,
        set: { p256dh: record.p256dh, auth: record.auth },
      });
  }

  /** Read every active subscription. */
  public async listAll(): Promise<readonly PushSubscriptionRecord[]> {
    return this.db
      .select({
        endpoint: push_subscriptions.endpoint,
        p256dh: push_subscriptions.p256dh,
        auth: push_subscriptions.auth,
      })
      .from(push_subscriptions);
  }

  /** Drop the row keyed by `endpoint`. Idempotent. */
  public async remove(endpoint: string): Promise<void> {
    await this.db
      .delete(push_subscriptions)
      .where(eq(push_subscriptions.endpoint, endpoint));
  }

  /** Stamp the most-recent send time for a subscription. */
  public async markSent(endpoint: string, nowIso: string): Promise<void> {
    await this.db
      .update(push_subscriptions)
      .set({ last_sent_at: nowIso })
      .where(eq(push_subscriptions.endpoint, endpoint));
  }
}
