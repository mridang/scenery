/**
 * @packageDocumentation
 *
 * The Content Security Policy: the browser's own list of what a page may load
 * and run. It is what stops a script injected into a page (through some future
 * bug) from running at all.
 *
 * Scripts are allowed only if they carry this response's one-time number (the
 * nonce), which Next.js puts on the scripts and styles it writes when it finds
 * the nonce in the policy on the incoming request. `strict-dynamic` then lets
 * those scripts load the others they need. Nothing else may run, and nothing
 * may be framed, embedded or sent anywhere but this site.
 */

import { bytesToBase64 } from '../util/base64';
import { replacingHeaders } from './headers';
import { CSP_REPORT_DIRECTIVES } from './reporting';
import { EXTRA_DIRECTIVES, IMG_SRC } from './site';

/** A fresh, unguessable nonce: 16 random bytes, base64. */
export function newNonce(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

/** The policy for one response, carrying that response's nonce. */
export function buildCsp(nonce: string): string {
  return [
    // Deny anything not named below; every kind of load the site needs is listed.
    "default-src 'none'",
    // `'self'` only matters to browsers too old to know strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src ${IMG_SRC}`,
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
    ...EXTRA_DIRECTIVES,
    ...CSP_REPORT_DIRECTIVES,
  ].join('; ');
}

/**
 * A policy that only reports, never blocks, sent next to the real one: Trusted
 * Types for scripts. With it a browser says whenever code hands a plain string
 * to something that runs it as script (`eval`, `innerHTML` on a script,
 * `script.src = …`), which is where injected code usually gets in. Nothing is
 * refused, so nothing can break; the reports show whether the site (and the
 * framework under it) could one day enforce it.
 */
export function buildReportOnlyCsp(): string {
  return ["require-trusted-types-for 'script'", ...CSP_REPORT_DIRECTIVES].join(
    '; ',
  );
}

/** The nonce in a policy, if it carries one. */
export function nonceOf(csp: string): string | undefined {
  return /'nonce-([^']+)'/.exec(csp)?.[1];
}

/**
 * The headers to forward to the app: the caller's own, with the policy and the
 * nonce set to ours. `set`, not append: a policy or nonce header sent by the
 * caller must be replaced, or Next.js could read the caller's nonce instead of
 * ours and render a page (that may then be cached) whose scripts our policy
 * refuses.
 */
export function forwardedHeaders(
  incoming: Headers,
  csp: string,
  nonce: string,
): Headers {
  return replacingHeaders(incoming, {
    'content-security-policy': csp,
    'x-nonce': nonce,
  });
}
