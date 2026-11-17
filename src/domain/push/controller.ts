/**
 * @packageDocumentation
 *
 * The `/api/push/subscriptions` controllers, built on the `@/lib/core/api`
 * framework: register a Web Push subscription (the collection) and forget one
 * (the item). The route files just mount their handlers.
 */

import { database } from '@/domain/db/client';
import {
  ApiController,
  created,
  isObject,
  ok,
  problems,
  readJsonObject,
} from '@/lib/core/api';
import { isSubscriptionId, subscriptionId } from '@/lib/push/subscription-id';
import { PushSubscriptionRepository } from './repository';
import type { RouteContext } from '@/lib/core/api';
import type { Database } from '@/domain/db/client';

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
    db: database(),
  };
}

/** Check the JSON of a browser `PushSubscription`, or the messages for what was wrong. */
function checkSubscription(
  body: Readonly<Record<string, unknown>>,
): CheckedSubscription | readonly string[] {
  const { endpoint, keys } = body;
  const { p256dh, auth } = isObject(keys) ? keys : {};
  const httpsEndpoint =
    typeof endpoint === 'string' && endpoint.startsWith('https://');
  const hasP256dh = typeof p256dh === 'string' && p256dh !== '';
  const hasAuth = typeof auth === 'string' && auth !== '';
  if (httpsEndpoint && hasP256dh && hasAuth) {
    return { endpoint, p256dh, auth };
  }
  return [
    ...(httpsEndpoint ? [] : ['endpoint: must be an https URL.']),
    ...(hasP256dh ? [] : ['keys.p256dh: required.']),
    ...(hasAuth ? [] : ['keys.auth: required.']),
  ];
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
    if (!('endpoint' in checked)) {
      throw problems.badRequest('The subscription is not valid.', checked);
    }
    return checked;
  },
  handle: async (subscription, ctx) => {
    const repo = new PushSubscriptionRepository(ctx.db);
    const existed = await repo.has(subscription.endpoint);
    await repo.upsert(subscription, new Date().toISOString());
    return { id: await subscriptionId(subscription.endpoint), existed };
  },
  encode: (result) => {
    const location = `/api/push/subscriptions/${result.id}`;
    return result.existed
      ? ok({ id: result.id }, { location })
      : created({ id: result.id }, location);
  },
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
    if (!(await repo.removeById(id))) {
      throw problems.notFound('push subscription');
    }
  },
});
