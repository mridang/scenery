import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  SECURITY_HEADERS,
  applyResponseHeaders,
  replacingHeaders,
  resourcePolicyFor,
} from '../../../src/lib/http/headers';

const at = (pathname: string) => new Request(`https://scenery.test${pathname}`);
const html = (headers: Record<string, string> = {}) =>
  new Response('<p>hi</p>', {
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });

describe('public/_headers', () => {
  it('gives static files the same security headers as the Worker gives pages', () => {
    const file = readFileSync(
      path.join(process.cwd(), 'public/_headers'),
      'utf8',
    );
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(file).toContain(`${name}: ${value}`);
    }
  });

  it('caches the icons for a day and lets other sites load them', () => {
    const file = readFileSync(
      path.join(process.cwd(), 'public/_headers'),
      'utf8',
    );
    const block = file.split('\n/icons/*\n')[1]?.split('\n/')[0] ?? '';
    expect(block).toContain('Cache-Control: public, max-age=86400');
    expect(block).toContain('Cross-Origin-Resource-Policy: cross-origin');
  });

  it('re-checks the service worker every time', () => {
    const file = readFileSync(
      path.join(process.cwd(), 'public/_headers'),
      'utf8',
    );
    expect(file.split('\n/sw.js\n')[1]).toContain('Cache-Control: no-cache');
  });
});

describe('applyResponseHeaders', () => {
  it('adds the security headers to every response', async () => {
    const out = applyResponseHeaders(at('/'), html());
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(out.headers.get(name)).toBe(value);
    }
    expect(await out.text()).toBe('<p>hi</p>');
  });

  it('points the browser at the reporting endpoint', () => {
    expect(
      applyResponseHeaders(at('/'), html()).headers.get('Reporting-Endpoints'),
    ).toBe('csp-endpoint="/api/csp-reports"');
  });

  it('keeps the security headers a route set itself', () => {
    const out = applyResponseHeaders(
      at('/'),
      html({
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "frame-ancestors 'none'",
      }),
    );
    expect(out.headers.get('X-Frame-Options')).toBe('DENY');
    expect(out.headers.get('Content-Security-Policy')).toBe(
      "frame-ancestors 'none'",
    );
  });

  it('marks pages noindex, as the site is private', () => {
    expect(
      applyResponseHeaders(at('/'), html()).headers.get('X-Robots-Tag'),
    ).toBe('noindex, nofollow');
  });

  it('lets pages be restored by the back button but never shared', () => {
    const out = applyResponseHeaders(
      at('/'),
      html({
        'Cache-Control':
          'private, no-cache, no-store, max-age=0, must-revalidate',
      }),
    );
    expect(out.headers.get('Cache-Control')).toBe('private, no-cache');
  });

  it('leaves the cache rules of the API alone', () => {
    const api = applyResponseHeaders(
      at('/api/health'),
      new Response('{}', {
        headers: {
          'content-type': 'application/json',
          'Cache-Control': 'private, max-age=0',
        },
      }),
    );
    expect(api.headers.get('Cache-Control')).toBe('private, max-age=0');
  });

  it.each([
    '/site.webmanifest',
    '/icon.svg',
    '/apple-touch-icon.png',
    '/favicon.ico',
    '/android-chrome-192x192.png',
  ])('lets a browser keep %s for a day', (pathname) => {
    const out = applyResponseHeaders(at(pathname), new Response('x'));
    expect(out.headers.get('cache-control')).toContain('max-age=86400');
  });

  it.each(['/favicon.ico', '/icons/a.svg', '/feed.xml', '/site.webmanifest'])(
    'serves %s to other sites and does not mark it noindex',
    (pathname) => {
      const out = applyResponseHeaders(at(pathname), new Response('x'));
      expect(out.headers.get('cross-origin-resource-policy')).toBe(
        'cross-origin',
      );
      expect(out.headers.has('x-robots-tag')).toBe(false);
    },
  );

  it('keeps the status of a redirect', () => {
    const out = applyResponseHeaders(
      at('/'),
      Response.redirect('https://scenery.test/x', 307),
    );
    expect(out.status).toBe(307);
    expect(out.headers.get('Location')).toBe('https://scenery.test/x');
  });
});

describe('Cross-Origin-Resource-Policy', () => {
  it('keeps pages and data to this site', () => {
    for (const path of ['/', '/api/health', '/api/img', '/magnet/abc']) {
      expect(resourcePolicyFor(path)).toBe('same-site');
    }
  });

  it('opens the files other sites embed or fetch on purpose', () => {
    for (const path of [
      '/icon.svg',
      '/icon.png',
      '/apple-touch-icon.png',
      '/android-chrome-512x512.png',
      '/favicon-32x32.png',
      '/site.webmanifest',
      '/feed.xml',
      '/icons/a.svg',
    ]) {
      expect(resourcePolicyFor(path)).toBe('cross-origin');
    }
  });

  it('is sent on every response, and a route may set its own', () => {
    expect(
      applyResponseHeaders(at('/'), html()).headers.get(
        'Cross-Origin-Resource-Policy',
      ),
    ).toBe('same-site');
    expect(
      applyResponseHeaders(
        at('/'),
        html({ 'Cross-Origin-Resource-Policy': 'same-origin' }),
      ).headers.get('Cross-Origin-Resource-Policy'),
    ).toBe('same-origin');
  });
});

describe('Strict-Transport-Security', () => {
  it('lasts two years, covers subdomains and asks to be preloaded', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });
});

describe('replacingHeaders', () => {
  it('sets new headers and replaces ones of the same name, in any case', () => {
    const original = new Headers({ 'X-A': '1', 'Content-Type': 'text/html' });
    const changed = replacingHeaders(original, { 'x-a': '2', 'X-B': '3' });
    expect(changed.get('x-a')).toBe('2');
    expect(changed.get('x-b')).toBe('3');
    expect(changed.get('content-type')).toBe('text/html');
  });

  it('leaves the original headers as they were', () => {
    const original = new Headers({ 'X-A': '1' });
    replacingHeaders(original, { 'X-A': '2' });
    expect(original.get('x-a')).toBe('1');
  });

  it('keeps every cookie', () => {
    const original = new Headers();
    original.append('Set-Cookie', 'a=1');
    original.append('Set-Cookie', 'b=2');
    expect(replacingHeaders(original, { 'X-A': '1' }).getSetCookie()).toEqual([
      'a=1',
      'b=2',
    ]);
  });
});
