import { describe, expect, it, jest } from '@jest/globals';

import type { NextRequest } from 'next/server';

// The auth + param-validation branches return before any DB / workflow
// work, so a stubbed runtime is all that's needed.
let mockEnv: Record<string, unknown> = {};
jest.unstable_mockModule('../../../../src/lib/util', () => ({
  getDB: () => ({}),
  getEnv: () => mockEnv,
  logInfo: () => undefined,
  logWarn: () => undefined,
  logError: () => undefined,
  safeJsonParse: () => ({ ok: false, error: 'stub' }),
}));

const { GET } = await import('../../../../src/app/api/cron/route');

function req(url: string, headers: Record<string, string> = {}): NextRequest {
  return {
    nextUrl: new URL(url),
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe('GET /api/cron — auth and validation', () => {
  it('401s when a secret is set but no auth header is sent', async () => {
    mockEnv = { CRON_SECRET: 'shh' };
    const res = await GET(req('https://x/api/cron'));
    expect(res.status).toBe(401);
  });

  it('401s on a wrong bearer token', async () => {
    mockEnv = { CRON_SECRET: 'shh' };
    const res = await GET(
      req('https://x/api/cron', { authorization: 'Bearer nope' }),
    );
    expect(res.status).toBe(401);
  });

  it('400s on an unknown query param once authorized', async () => {
    mockEnv = {}; // no secret configured → request is authorized
    const res = await GET(req('https://x/api/cron?bogus=1'));
    expect(res.status).toBe(400);
  });
});
