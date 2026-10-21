/**
 * @packageDocumentation
 *
 * Who may start the maintenance jobs (pipeline runs, workflow instances): the
 * holder of `CRON_SECRET`, sent as a bearer token. With no secret configured the
 * jobs are open, as they always were on a local or single-user deployment.
 */

import type { NextResponse } from 'next/server';

import { problem } from './problem';

/**
 * `undefined` when the request may proceed, otherwise the 401 problem to send
 * back (with the `WWW-Authenticate` challenge a client needs to retry).
 */
export function operatorRefusal(
  request: Request,
  secret: string | undefined,
): NextResponse | undefined {
  if (!secret) {
    return undefined;
  }
  return request.headers.get('authorization') === `Bearer ${secret}`
    ? undefined
    : problem(
        401,
        '/problems/unauthorized',
        'Unauthorized',
        'Send the cron secret as a bearer token.',
        { headers: { 'WWW-Authenticate': 'Bearer' } },
      );
}
