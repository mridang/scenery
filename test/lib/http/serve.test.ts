import { describe, expect, it } from '@jest/globals';

import { nonceOf } from '../../../src/lib/http/csp';
import { serve, type ServeApp } from '../../../src/lib/http/serve';

const ctx = {} as ExecutionContext;

/** An app that records the request it was given and answers with `response`. */
function appAnswering(response: () => Response): {
  app: ServeApp;
  seen: Request[];
} {
  const seen: Request[] = [];
  return {
    seen,
    app: {
      fetch(request) {
        seen.push(request);
        return response();
      },
    },
  };
}

const html = () =>
  new Response('<p>hi</p>', { headers: { 'content-type': 'text/html' } });
const get = (pathname = '/', headers: Record<string, string> = {}) =>
  new Request(`https://scenery.test${pathname}`, { headers });

describe('serve', () => {
  it('gives the app a policy and its nonce on the request', async () => {
    const { app, seen } = appAnswering(html);
    await serve(get(), {}, ctx, { app });
    const csp = seen[0]?.headers.get('content-security-policy') ?? '';
    expect(nonceOf(csp)).toBe(seen[0]?.headers.get('x-nonce'));
  });

  it('replaces a policy and nonce sent by the caller', async () => {
    const { app, seen } = appAnswering(html);
    await serve(
      get('/', {
        'content-security-policy': "script-src 'nonce-EVIL'",
        'x-nonce': 'EVIL',
      }),
      {},
      ctx,
      { app },
    );
    expect(seen[0]?.headers.get('x-nonce')).not.toBe('EVIL');
  });

  it('sends a page with the policy of its nonce and the security headers', async () => {
    const { app, seen } = appAnswering(html);
    const out = await serve(get(), {}, ctx, { app });
    const csp = out.headers.get('content-security-policy') ?? '';
    expect(nonceOf(csp)).toBe(seen[0]?.headers.get('x-nonce'));
    expect(out.headers.has('content-security-policy-report-only')).toBe(false);
    expect(out.headers.get('x-content-type-options')).toBe('nosniff');
    expect(out.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  });

  it('uses a new nonce for every request', async () => {
    const { app, seen } = appAnswering(html);
    await serve(get(), {}, ctx, { app });
    await serve(get(), {}, ctx, { app });
    expect(seen[0]?.headers.get('x-nonce')).not.toBe(
      seen[1]?.headers.get('x-nonce'),
    );
  });

  it('does not put a page policy on a response that is not a page', async () => {
    const { app } = appAnswering(
      () =>
        new Response('{}', { headers: { 'content-type': 'application/json' } }),
    );
    const out = await serve(get('/api/health'), {}, ctx, { app });
    expect(out.headers.get('content-security-policy')).toBe(
      "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
    );
    expect(out.headers.has('content-security-policy-report-only')).toBe(false);
    expect(out.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('keeps the policy a route set itself', async () => {
    const { app } = appAnswering(
      () =>
        new Response('x', {
          headers: {
            'content-type': 'text/html',
            'content-security-policy': "default-src 'none'",
          },
        }),
    );
    const out = await serve(get(), {}, ctx, { app });
    expect(out.headers.get('content-security-policy')).toBe(
      "default-src 'none'",
    );
  });
});
