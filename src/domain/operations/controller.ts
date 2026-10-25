/**
 * @packageDocumentation
 *
 * The `/api/operations` controllers, built on the `@/core/api` framework: the
 * collection (run an operation now) and the item (read one back). Both are
 * guarded by the operator token; the route files just mount their handlers.
 */

import type { Database } from '@/core/db/client';
import { ApiController, operatorRefusal, type RouteContext } from '@/core/api';
import { getDatabase, getEnv } from '@/core/runtime';
import { absoluteLocation, problems, readJsonObject } from '@/lib/rest-json';
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
interface OperationsCtx {
  readonly request: Request;
  readonly params: Promise<Readonly<Record<string, string>>>;
  readonly env: CloudflareEnv;
  readonly db: Database;
}

/** Build the context, refusing anyone who is not the operator. */
function operatorContext(request: Request, route: RouteContext): OperationsCtx {
  const env = getEnv();
  const refused = operatorRefusal(request, env);
  if (refused) {
    throw refused;
  }
  return {
    request,
    params: route.params ?? Promise.resolve({}),
    env,
    db: getDatabase(),
  };
}

/** `POST /api/operations`: run an operation now and record it (201 + Location). */
export const operationsCollection = new ApiController<OperationsCtx>({
  context: operatorContext,
}).on<OperationRequest, OperationResource>({
  method: 'POST',
  decode: async (request) => {
    const body = await readJsonObject(
      request,
      'The operation must be a JSON object.',
    );
    if (!body.ok) {
      throw body.response;
    }
    const input = parseOperationInput(body.value);
    if (!input.ok) {
      throw problems.badRequest('The operation is not valid.', input.errors);
    }
    return input.request;
  },
  handle: async (operationRequest, ctx) => {
    const repository = new OperationRepository(ctx.db);
    const id = crypto.randomUUID();
    const { type, parameters } = operationRequest;
    await repository.start({
      id,
      type,
      parameters,
      createdAt: new Date().toISOString(),
    });
    try {
      const result = await runOperation(operationRequest, {
        db: ctx.db,
        env: ctx.env,
      });
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
      throw problems.notFound('operation');
    }
    return operationResource(row);
  },
  encode: (resource) => ({
    body: resource,
    headers: { 'Cache-Control': 'no-store' },
  }),
});
