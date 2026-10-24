/**
 * Operator operations: the manual runs (a pipeline run, an OMDB backfill, a
 * test of the daily notification).
 *
 *   POST /api/operations {type, parameters?} → 201 + Location
 *
 * Auth: the `CRON_SECRET` as a bearer token. With no secret set (local
 * development) it is open, as the manual triggers it replaces always were.
 */

import { NextResponse } from 'next/server';

import { readJsonObject } from '@/lib/rest-json/json';
import { absoluteLocation } from '@/lib/rest-json/location';
import { parseOperationInput } from '@/domain/operations/operation-input';
import { operationResource } from '@/domain/operations/operation-resource';
import { operatorRefusal } from '@/core/api/operator-auth';
import { problems } from '@/lib/rest-json/problem';
import { OperationRepository } from '@/domain/operations/repository';
import { runOperation } from '@/domain/operations/run';
import { getDatabase, getEnv } from '@/core/runtime';
import { errorMessage, logError } from '@/utils/logging';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/operations`: run an operation now and keep a record of it. The
 * work happens inside the request. Answers 201 with the operation and its
 * `Location` whether the run succeeded or failed (its `status` says which; a
 * failure carries only the error message), 400 for a body that is not a valid
 * operation, 401 (`WWW-Authenticate: Bearer`) without the operator token, or
 * 415/413 for a body that is not JSON or too large.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const env = getEnv();
  const refused = operatorRefusal(request, env);
  if (refused) {
    return refused;
  }
  const body = await readJsonObject(
    request,
    'The operation must be a JSON object.',
  );
  if (!body.ok) {
    return body.response;
  }
  const input = parseOperationInput(body.value);
  if (!input.ok) {
    return problems.badRequest('The operation is not valid.', input.errors);
  }

  const db = getDatabase();
  const repository = new OperationRepository(db);
  const id = crypto.randomUUID();
  const { type, parameters } = input.request;
  await repository.start({
    id,
    type,
    parameters,
    createdAt: new Date().toISOString(),
  });
  try {
    const result = await runOperation(input.request, { db, env });
    await repository.finish(id, 'succeeded', result, new Date().toISOString());
  } catch (error) {
    logError({
      event: 'operations.failed',
      id,
      type,
      error: errorMessage(error),
    });
    await repository.finish(
      id,
      'failed',
      { error: errorMessage(error) },
      new Date().toISOString(),
    );
  }
  const stored = await repository.get(id);
  return NextResponse.json(operationResource(stored!), {
    status: 201,
    headers: {
      Location: absoluteLocation(request, `/api/operations/${id}`),
      'Cache-Control': 'no-store',
    },
  });
}
