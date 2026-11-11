import { databaseFrom, type Database } from '@/domain/db/client';
import { beforeEach, describe, expect, it } from '@jest/globals';
// eslint-disable-next-line n/no-unsupported-features/node-builtins -- experimental API used on purpose
import type { DatabaseSync } from 'node:sqlite';

import { PushSubscriptionRepository } from '@/domain/push/repository';
import { subscriptionId } from '@/lib/push/subscription-id';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  queryPlan,
  recordStatements,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';

let d1: D1Database;
let raw: DatabaseSync;
let db: Database;

beforeEach(() => {
  const built = sqliteD1(...APP_MIGRATIONS);
  d1 = built.d1;
  raw = built.raw;
  db = databaseFrom(d1);
});

const record = {
  endpoint: 'https://push.example.test/abc',
  p256dh: 'key',
  auth: 'secret',
};

describe('PushSubscriptionRepository (SQLite-backed D1)', () => {
  it('has reports whether an endpoint is subscribed', async () => {
    const repo = new PushSubscriptionRepository(db);
    await repo.upsert(record, '2026-06-01T00:00:00Z');

    expect(await repo.has(record.endpoint)).toBe(true);
    expect(await repo.has('https://push.example.test/other')).toBe(false);
  });

  it('has looks the endpoint up by its key', async () => {
    const { d1: recorded, statements } = recordStatements(d1);
    await new PushSubscriptionRepository(databaseFrom(recorded)).has(
      record.endpoint,
    );
    const plans = statements.flatMap((sql) => queryPlan(raw, sql));
    expect(plans.some((line) => line.includes('(endpoint=?)'))).toBe(true);
    expect(plans.some((line) => line.startsWith('SCAN'))).toBe(false);
  });

  it('upsert stores the id of the endpoint, and keeps it when keys rotate', async () => {
    const repo = new PushSubscriptionRepository(db);
    await repo.upsert(record, '2026-06-01T00:00:00Z');
    await repo.upsert({ ...record, auth: 'rotated' }, '2026-06-02T00:00:00Z');
    const rows = raw.prepare('SELECT id, auth FROM push_subscriptions').all();
    expect(rows).toEqual([
      { id: await subscriptionId(record.endpoint), auth: 'rotated' },
    ]);
  });

  it('removeById forgets the subscription with that id and no other', async () => {
    const repo = new PushSubscriptionRepository(db);
    const other = { ...record, endpoint: 'https://push.example.test/other' };
    await repo.upsert(record, '2026-06-01T00:00:00Z');
    await repo.upsert(other, '2026-06-01T00:00:00Z');

    expect(await repo.removeById(await subscriptionId(record.endpoint))).toBe(
      true,
    );
    expect(await repo.has(record.endpoint)).toBe(false);
    expect(await repo.has(other.endpoint)).toBe(true);
  });

  it('removeById answers false for an id nothing has', async () => {
    const repo = new PushSubscriptionRepository(db);
    await repo.upsert(record, '2026-06-01T00:00:00Z');

    expect(await repo.removeById('0'.repeat(64))).toBe(false);
    expect(await repo.has(record.endpoint)).toBe(true);
  });

  it('removeById finds a subscription stored before ids and fills in its id', async () => {
    raw
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, 'k', 'a', 'then')`,
      )
      .run(record.endpoint);
    raw
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES ('https://push.example.test/old2', 'k', 'a', 'then')`,
      )
      .run();
    const repo = new PushSubscriptionRepository(db);

    expect(await repo.removeById(await subscriptionId(record.endpoint))).toBe(
      true,
    );
    expect(await repo.has(record.endpoint)).toBe(false);
    // The other old row was seen on the way and now carries its id.
    expect(raw.prepare('SELECT id FROM push_subscriptions').all()).toEqual([
      { id: await subscriptionId('https://push.example.test/old2') },
    ]);
  });

  it('removeById reads the one row through the id index', async () => {
    const { d1: recorded, statements } = recordStatements(d1);
    await new PushSubscriptionRepository(databaseFrom(recorded)).removeById(
      '0'.repeat(64),
    );
    const plans = statements.flatMap((sql) => queryPlan(raw, sql));
    expect(plans.length).toBeGreaterThan(0);
    expect(
      plans.every((line) => line.includes('push_subscriptions_id_idx')),
    ).toBe(true);
    expect(plans.some((line) => line.startsWith('SCAN'))).toBe(false);
    expect(plans.some((line) => line.includes('TEMP B-TREE'))).toBe(false);
  });
});
