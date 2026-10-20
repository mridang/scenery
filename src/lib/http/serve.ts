/**
 * @packageDocumentation
 *
 * How the Worker answers a request, kept out of `src/worker.ts` (which cannot be
 * type-checked, because the app it forwards to is generated at build time) so
 * that it can be checked and tested:
 *
 *  1. each request gets its own Content Security Policy nonce;
 *  2. the app is given the policy and its nonce on the request (that is where
 *     Next.js looks for it);
 *  3. a page that comes back carries the policy and the report-only Trusted
 *     Types policy;
 *  4. whatever goes back carries the site's security and cache headers.
 */

import {
  buildCsp,
  buildReportOnlyCsp,
  forwardedHeaders,
  newNonce,
} from './csp';
import { applyResponseHeaders, replacingHeaders } from './headers';
import { REPORT_ONLY_HEADER } from './reporting';

/** The app that answers requests: the generated OpenNext handler. */
export interface ServeApp {
  fetch(
    request: Request,
    env: never,
    ctx: ExecutionContext,
  ): Response | Promise<Response>;
}

/** The pieces `serve` works with, passed in so a test can supply its own. */
export interface ServeDeps {
  readonly app: ServeApp;
}

/** The response with one more header (responses from the app are read-only). */
function withHeader(response: Response, name: string, value: string): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: replacingHeaders(response.headers, { [name]: value }),
  });
}

/** Answer one request. */
export async function serve(
  request: Request,
  env: unknown,
  ctx: ExecutionContext,
  { app }: ServeDeps,
): Promise<Response> {
  const nonce = newNonce();
  const csp = buildCsp(nonce);
  const forwarded = new Request(request, {
    headers: forwardedHeaders(request.headers, csp, nonce),
  });
  const fetched = await app.fetch(forwarded, env as never, ctx);
  const isHtml = (fetched.headers.get('content-type') ?? '').startsWith(
    'text/html',
  );
  const response =
    isHtml && !fetched.headers.has('content-security-policy')
      ? withHeader(
          withHeader(fetched, 'Content-Security-Policy', csp),
          REPORT_ONLY_HEADER,
          buildReportOnlyCsp(),
        )
      : fetched;
  return applyResponseHeaders(request, response);
}
