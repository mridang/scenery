/**
 * @packageDocumentation
 *
 * The `/api/operations` controllers, built on the `@/core/api` framework: the
 * collection (run an operation now) and the item (read one back). Both are
 * guarded by the operator token; the route files just mount their handlers.
 */

import type { Database } from '@/core/db/client';
import { ApiController, Problem, type RouteContext } from '@/core/api';
import { operatorRefusal } from '@/core/api/operator-auth';
import { getDatabase, getEnv } from '@/core/runtime';
import { absoluteLocation } from '@/lib/rest-json/location';
import { readJsonObject } from '@/lib/rest-json/json';
import { problems } from '@/lib/rest-json/problem';
import { errorMessage, logError } from '@/utils/logging';
import { parseOperationInput } from './operation-input';
import {
  isOperationId,
  operationResource,
  type OperationResource,
} from './operation-resource';
import { OperationRepository } from './repository';
import { runOperation } from './run';
import type { OperationRequest } from './types';

/** Per-request context for the operator operations API. */
interface OperationsCtx extends RouteContext {
  readonly env: CloudflareEnv;
  readonly db: Database;
}

/** Build the context, refusing anyone who is not the operator. */
async function operatorContext(route: RouteContext): Promise<OperationsCtx> {
  const env = getEnv();
  const refused = operatorRefusal(route.request, env);
  if (refused) {
    throw new Problem(refused);
  }
  return {
    request: route.request,
    params: route.params,
    env,
    db: getDatabase(),
  };
}

/** `POST /api/operations`: run an operation now and record it (201 + Location). */
export const operationsCollection = new ApiController<OperationsCtx>({
  context: operatorContext,
}).on<OperationRequest, OperationResource>({
  method: 'POST',
  decode: async (ctx) => {
    const body = await readJsonObject(
      ctx.request,
      'The operation must be a JSON object.',
    );
    if (!body.ok) {
      throw new Problem(body.response);
    }
    const input = parseOperationInput(body.value);
    if (!input.ok) {
      throw new Problem(
        problems.badRequest('The operation is not valid.', input.errors),
      );
    }
    return input.request;
  },
  handle: async (request, ctx) => {
    const repository = new OperationRepository(ctx.db);
    const id = crypto.randomUUID();
    const { type, parameters } = request;
    await repository.start({
      id,
      type,
      parameters,
      createdAt: new Date().toISOString(),
    });
    try {
      const result = await runOperation(request, { db: ctx.db, env: ctx.env });
      await repository.finish(
        id,
        'succeeded',
        result,
        new Date().toISOString(),
      );
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
    return operationResource((await repository.get(id))!);
  },
  encode: (resource, ctx) => ({
    status: 201,
    body: resource,
    headers: {
      Location: absoluteLocation(ctx.request, `/api/operations/${resource.id}`),
      'Cache-Control': 'no-store',
    },
  }),
});

/** `GET /api/operations/:id`: the operation and, once ended, its result. */
export const operationsItem = new ApiController<OperationsCtx>({
  context: operatorContext,
}).on<undefined, OperationResource>({
  method: 'GET',
  handle: async (_input, ctx) => {
    const { id } = await ctx.params;
    const row = isOperationId(id ?? '')
      ? await new OperationRepository(ctx.db).get(id ?? '')
      : undefined;
    if (!row) {
      throw new Problem(problems.notFound('operation'));
    }
    return operationResource(row);
  },
  encode: (resource) => ({
    body: resource,
    headers: { 'Cache-Control': 'no-store' },
  }),
});
