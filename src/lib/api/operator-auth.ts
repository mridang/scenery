/**
 * @packageDocumentation
 *
 * Who may use `/api/operations`. The operator proves it with the `CRON_SECRET`
 * as a bearer token. Where no secret is set (local development) the endpoints
 * are open, as the manual triggers always were.
 */

import type { NextResponse } from 'next/server';

import { logError } from '../util';
import { problem } from './problem';

/** The refusal to send when the caller is not the operator, or undefined when they are. */
export function operatorRefusal(
  request: Request,
  env: Pick<CloudflareEnv, 'CRON_SECRET'>,
): NextResponse | undefined {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return undefined;
  }
  if (request.headers.get('authorization') === `Bearer ${secret}`) {
    return undefined;
  }
  logError({
    event: 'operations.unauthorized',
    path: new URL(request.url).pathname,
  });
  return problem(
    401,
    '/problems/unauthorized',
    'Unauthorized',
    'Send the operator token as a Bearer Authorization header.',
    { headers: { 'WWW-Authenticate': 'Bearer' } },
  );
}
