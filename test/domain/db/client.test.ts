import { afterEach, describe, expect, it } from '@jest/globals';

import { database, databaseFrom } from '@/domain/db/client';
import { installCloudflareContext, sqliteD1 } from '../../lib/db/sqlite-d1';

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe('databaseFrom', () => {
  it('wraps a D1 binding in the app client, keeping the binding as $client', () => {
    const { d1 } = sqliteD1();
    expect(databaseFrom(d1).$client).toBe(d1);
  });
});

describe('database', () => {
  it('builds the app client from the request context binding', () => {
    const { d1 } = sqliteD1();
    restore = installCloudflareContext(d1);
    expect(database().$client).toBe(d1);
  });
});
