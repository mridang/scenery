import { describe, expect, it } from '@jest/globals';

import {
  buildCsp,
  buildReportOnlyCsp,
  forwardedHeaders,
  newNonce,
  nonceOf,
} from '../../../src/lib/http/csp';

describe('newNonce', () => {
  it('is base64 of 16 bytes, and different every time', () => {
    const a = newNonce();
    expect(Buffer.from(a, 'base64')).toHaveLength(16);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(newNonce()).not.toBe(a);
  });
});

describe('buildCsp', () => {
  const csp = buildCsp('abc123==');
  const directive = (name: string) =>
    csp.split('; ').find((d) => d.startsWith(`${name} `));

  it('lets only scripts that carry the nonce run, and the ones they load', () => {
    expect(directive('script-src')).toBe(
      "script-src 'self' 'nonce-abc123==' 'strict-dynamic'",
    );
  });

  it('never allows inline script or eval', () => {
    expect(csp).not.toContain('unsafe-eval');
    expect(directive('script-src')).not.toContain('unsafe-inline');
    expect(directive('style-src')).not.toContain('unsafe-inline');
  });

  it('allows inline style attributes and nothing more inline', () => {
    expect(directive('style-src-attr')).toBe("style-src-attr 'unsafe-inline'");
    expect(directive('style-src')).toBe("style-src 'self' 'nonce-abc123=='");
  });

  it('denies by default, so only what is listed can load', () => {
    expect(directive('default-src')).toBe("default-src 'none'");
  });

  it.each([
    'script-src',
    'style-src',
    'img-src',
    'font-src',
    'connect-src',
    'manifest-src',
    'worker-src',
  ])('names %s itself, since nothing falls back to the default', (name) => {
    expect(directive(name)).toMatch(new RegExp(`^${name} 'self'`));
  });

  it('loads pictures only from this site, data and blob addresses', () => {
    expect(directive('img-src')).toBe("img-src 'self' data: blob:");
    expect(directive('connect-src')).toBe("connect-src 'self'");
    expect(directive('font-src')).toBe("font-src 'self'");
  });

  it('forbids plugins, frames, media and a rewritten <base>', () => {
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('frame-src')).toBe("frame-src 'none'");
    expect(directive('media-src')).toBe("media-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'self'");
  });

  it('only lets this site frame it, and forces https', () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'self'");
    expect(directive('form-action')).toBe("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });
});

describe('nonceOf', () => {
  it('reads the nonce back out of a policy, which is how Next.js finds it', () => {
    expect(nonceOf(buildCsp('xyz=='))).toBe('xyz==');
    expect(nonceOf("default-src 'self'")).toBeUndefined();
  });
});

describe('forwardedHeaders', () => {
  it('replaces a policy and nonce sent by the caller instead of adding to them', () => {
    const incoming = new Headers({
      'content-security-policy': "script-src 'nonce-ATTACKER'",
      'x-nonce': 'ATTACKER',
      accept: 'text/html',
    });
    const csp = buildCsp('REAL');
    const forwarded = forwardedHeaders(incoming, csp, 'REAL');
    expect(forwarded.get('content-security-policy')).toBe(csp);
    expect(nonceOf(forwarded.get('content-security-policy')!)).toBe('REAL');
    expect(forwarded.get('x-nonce')).toBe('REAL');
    expect(forwarded.get('accept')).toBe('text/html');
  });

  it('leaves the caller’s own headers object alone', () => {
    const incoming = new Headers({ accept: 'text/html' });
    forwardedHeaders(incoming, 'x', 'y');
    expect(incoming.has('content-security-policy')).toBe(false);
  });
});

describe('reporting', () => {
  it('points the policy at the report group and address', () => {
    const csp = buildCsp('abc');
    expect(csp).toContain('report-to csp-endpoint');
    expect(csp).toContain('report-uri /api/csp-reports');
  });

  it('builds a Trusted Types policy that only reports', () => {
    const policy = buildReportOnlyCsp();
    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).toContain('report-to csp-endpoint');
    expect(policy).not.toContain('default-src');
  });
});
