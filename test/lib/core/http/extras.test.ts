import { describe, expect, it } from '@jest/globals';

import { GENERIC_CLASSES } from '@/lib/core/http/edge-limits';
import { EDGE_LIMITS } from '@/lib/core/http/extras';

const categoryOf = (pathname: string) =>
  EDGE_LIMITS.classify(new Request(`https://app.test${pathname}`));

describe('EDGE_LIMITS', () => {
  it('counts only the classes every app has', () => {
    expect(EDGE_LIMITS.classes).toBe(GENERIC_CLASSES);
  });

  it('counts every caller by address, because the app has no sign-in', () => {
    expect(EDGE_LIMITS.sessionCookie).toBeUndefined();
  });

  it.each([
    ['/', 'site'],
    ['/movies', 'site'],
    ['/img', 'cover'],
    ['/csp/reports', 'reports'],
    ['/health', 'discovery'],
    ['/feed.xml', 'discovery'],
    ['/api/operations', 'api'],
    ['/api/push/subscriptions', 'api'],
  ])('puts %s in %s', (pathname, expected) => {
    expect(categoryOf(pathname)).toBe(expected);
  });

  it('does not count the static files', () => {
    expect(categoryOf('/_next/static/chunks/a.js')).toBeUndefined();
    expect(categoryOf('/icons/icon-192.png')).toBeUndefined();
  });
});
