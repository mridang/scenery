/**
 * @packageDocumentation
 *
 * The `/api/push/subscriptions` controllers, built on the `@/core/api`
 * framework: register a Web Push subscription (the collection) and forget one
 * (the item). The route files just mount their handlers.
 */

import type { Database } from '@/core/db/client';
import { ApiController, type RouteContext } from '@/core/api';
import { getDatabase } from '@/core/runtime';
import { absoluteLocation, problems, readJsonObject } from '@/lib/rest-json';
import {
  endpointForId,
  isSubscriptionId,
  subscriptionId,
} from '@/lib/push/subscription-id';
import { PushSubscriptionRepository } from './repository';

/** Per-request context for the push subscriptions API. */
interface PushCtx {
  readonly request: Request;
  readonly params: Promise<Readonly<Record<string, string>>>;
  readonly db: Database;
}

/** A browser `PushSubscription` that has been checked. */
interface CheckedSubscription {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

/** Build the context (no auth: a subscription endpoint is itself the secret). */
function pushContext(request: Request, route: RouteContext): PushCtx {
  return {
    request,
    params: route.params ?? Promise.resolve({}),
    db: getDatabase(),
  };
}

/** Check the JSON of a browser `PushSubscription`, or the messages for what was wrong. */
function checkSubscription(
  body: Readonly<Record<string, unknown>>,
): CheckedSubscription | readonly string[] {
  const { endpoint, keys } = body;
  const { p256dh, auth } = (keys ?? {}) as Readonly<Record<string, unknown>>;
  const errors: string[] = [];
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint)) {
    errors.push('endpoint: must be an https URL.');
  }
  if (typeof p256dh !== 'string' || !p256dh) {
    errors.push('keys.p256dh: required.');
  }
  if (typeof auth !== 'string' || !auth) {
    errors.push('keys.auth: required.');
  }
  return errors.length > 0
    ? errors
    : {
        endpoint: endpoint as string,
        p256dh: p256dh as string,
        auth: auth as string,
      };
}

/** What creating a subscription came to: the id and whether it already existed. */
interface Created {
  readonly id: string;
  readonly existed: boolean;
}

/**
 * `POST /api/push/subscriptions`: register a Web Push subscription. A repeated
 * call for the same `endpoint` replaces the keys (browsers rotate them). 201
 * with a `Location` for a new subscription, 200 for one already registered.
 */
export const subscriptionsCollection = new ApiController<PushCtx>({
  context: pushContext,
}).on<CheckedSubscription, Created>({
  method: 'POST',
  decode: async (request) => {
    const body = await readJsonObject(
      request,
      'The body must be a push subscription object.',
    );
    if (!body.ok) {
      throw body.response;
    }
    const checked = checkSubscription(body.value);
    if (Array.isArray(checked)) {
      throw problems.badRequest('The subscription is not valid.', checked);
    }
    return checked as CheckedSubscription;
  },
  handle: async (subscription, ctx) => {
    const repo = new PushSubscriptionRepository(ctx.db);
    const existed = (await repo.listAll()).some(
      (s) => s.endpoint === subscription.endpoint,
    );
    await repo.upsert(subscription, new Date().toISOString());
    return { id: await subscriptionId(subscription.endpoint), existed };
  },
  encode: (created, ctx) => ({
    status: created.existed ? 200 : 201,
    body: { id: created.id },
    headers: {
      Location: absoluteLocation(
        ctx.request,
        `/api/push/subscriptions/${created.id}`,
      ),
    },
  }),
});

/**
 * `DELETE /api/push/subscriptions/{id}`: forget a Web Push subscription. 204,
 * or 404 when there is no such subscription or the id cannot be one.
 */
export const subscriptionsItem = new ApiController<PushCtx>({
  context: pushContext,
}).on<undefined, undefined>({
  method: 'DELETE',
  handle: async (_input, ctx) => {
    const { id } = await ctx.params;
    if (!id || !isSubscriptionId(id)) {
      throw problems.notFound('push subscription');
    }
    const repo = new PushSubscriptionRepository(ctx.db);
    const endpoint = await endpointForId(
      (await repo.listAll()).map((s) => s.endpoint),
      id,
    );
    if (!endpoint) {
      throw problems.notFound('push subscription');
    }
    await repo.remove(endpoint);
    return undefined;
  },
});
