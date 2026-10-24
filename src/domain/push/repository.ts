/**
 * @packageDocumentation
 *
 * D1-backed store of Web Push subscriptions: insert on subscribe, delete
 * on 410 Gone or explicit unsubscribe, and a list-all for the cron tick.
 * Drizzle handles the typing so the column names match the migration.
 */

import { eq } from 'drizzle-orm';

import type { Database } from '@/core/db/client';
import type {
  PushSubscriptionRecord,
  PushSubscriptionStore,
} from '@/lib/push/types';
import { pushSubscriptions } from '../db/schema';

/** D1-backed {@link PushSubscriptionStore}: operations over `push_subscriptions`. @public */
export class PushSubscriptionRepository implements PushSubscriptionStore {
  public constructor(private readonly db: Database) {}

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
      .insert(pushSubscriptions)
      .values({
        endpoint: record.endpoint,
        p256dh: record.p256dh,
        auth: record.auth,
        created_at: nowIso,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { p256dh: record.p256dh, auth: record.auth },
      });
  }

  /** Read every active subscription. */
  public async listAll(): Promise<readonly PushSubscriptionRecord[]> {
    return this.db
      .select({
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
      })
      .from(pushSubscriptions);
  }

  /** Drop the row keyed by `endpoint`. Idempotent. */
  public async remove(endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }

  /** Stamp the most-recent send time for a subscription. */
  public async markSent(endpoint: string, nowIso: string): Promise<void> {
    await this.db
      .update(pushSubscriptions)
      .set({ last_sent_at: nowIso })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }
}
