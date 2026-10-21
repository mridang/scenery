/**
 * One operation, as `POST /api/operations` left it.
 *
 *   GET /api/operations/:id → 200
 */

import { NextResponse } from 'next/server';

import {
  isOperationId,
  operationResource,
} from '../../../../lib/api/operation-resource';
import { operatorRefusal } from '../../../../lib/api/operator-auth';
import { problems } from '../../../../lib/api/problem';
import type { IdContext } from '../../../../lib/api/route-context';
import { OperationRepository } from '../../../../lib/operations/repository';
import { getDB, getEnv } from '../../../../lib/util';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/operations/:id`: the operation and, once it has ended, its result.
 * Answers 200, 404 when there is no such operation (an id that cannot be one is
 * the same 404), or 401 without the operator token (see `POST`).
 */
export async function GET(
  request: Request,
  { params }: IdContext,
): Promise<NextResponse> {
  const refused = operatorRefusal(request, getEnv());
  if (refused) {
    return refused;
  }
  const { id } = await params;
  const row = isOperationId(id)
    ? await new OperationRepository(getDB()).get(id)
    : undefined;
  return row
    ? NextResponse.json(operationResource(row), {
        headers: { 'Cache-Control': 'no-store' },
      })
    : problems.notFound('operation');
}
