import { describe, expect, it } from '@jest/globals';

import { GENERIC_CLASSES } from '../../../src/lib/http/edge-limits';
import { EDGE_LIMITS } from '../../../src/lib/http/extras';

const classOf = (pathname: string) =>
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
    expect(classOf(pathname)).toBe(expected);
  });

  it('does not count the static files', () => {
    expect(classOf('/_next/static/chunks/a.js')).toBeUndefined();
    expect(classOf('/icons/icon-192.png')).toBeUndefined();
  });
});
