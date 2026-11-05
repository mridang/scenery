/**
 * @packageDocumentation
 *
 * D1-backed store of Web Push subscriptions: insert on subscribe, delete
 * on 410 Gone or explicit unsubscribe, and a list-all for the cron tick.
 * Drizzle handles the typing so the column names match the migration.
 */

import { eq, isNull } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import type {
  PushSubscriptionRecord,
  PushSubscriptionStore,
} from '@/lib/push/types';
import { endpointForId, subscriptionId } from '@/lib/push/subscription-id';
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
    const id = await subscriptionId(record.endpoint);
    await this.db
      .insert(pushSubscriptions)
      .values({
        id,
        endpoint: record.endpoint,
        p256dh: record.p256dh,
        auth: record.auth,
        created_at: nowIso,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { id, p256dh: record.p256dh, auth: record.auth },
      });
  }

  /** Whether a subscription with this `endpoint` exists: one key lookup. */
  public async has(endpoint: string): Promise<boolean> {
    const row = await this.db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .get();
    return row !== undefined;
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

  /**
   * Drop the subscription whose API id (see `subscriptionId`) is `id`; whether
   * there was one. Reads one row through `push_subscriptions_id_idx`. Rows
   * stored before the id was (their id is NULL, found through the same index)
   * are only consulted when that finds nothing: each gets its id filled in as
   * it is seen, so the fallback reads nothing once they are all adopted.
   */
  public async removeById(id: string): Promise<boolean> {
    const removed = await this.db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, id))
      .returning({ endpoint: pushSubscriptions.endpoint });
    if (removed.length > 0) {
      return true;
    }
    const legacy = await this.db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(isNull(pushSubscriptions.id));
    for (const { endpoint } of legacy) {
      await this.db
        .update(pushSubscriptions)
        .set({ id: await subscriptionId(endpoint) })
        .where(eq(pushSubscriptions.endpoint, endpoint));
    }
    const match = await endpointForId(
      legacy.map((row) => row.endpoint),
      id,
    );
    if (match === undefined) {
      return false;
    }
    await this.remove(match);
    return true;
  }

  /** Stamp the most-recent send time for a subscription. */
  public async markSent(endpoint: string, nowIso: string): Promise<void> {
    await this.db
      .update(pushSubscriptions)
      .set({ last_sent_at: nowIso })
      .where(eq(pushSubscriptions.endpoint, endpoint));
  }
}
