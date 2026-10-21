import { absoluteLocation } from '../../../lib/api/location';
import { readJsonObject } from '../../../lib/api/json';
import { problems } from '../../../lib/api/problem';
import { PushSubscriptionRepository } from '../../../lib/push';
import { subscriptionId } from '../../../lib/push/subscription-id';
import { getDB } from '../../../lib/util';

export const dynamic = 'force-dynamic';

/** A subscription that has been checked. */
type Checked =
  | {
      readonly ok: true;
      readonly endpoint: string;
      readonly p256dh: string;
      readonly auth: string;
    }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Check the JSON of a browser `PushSubscription`. */
function checkSubscription(body: Readonly<Record<string, unknown>>): Checked {
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
    ? { ok: false, errors }
    : {
        ok: true,
        endpoint: endpoint as string,
        p256dh: p256dh as string,
        auth: auth as string,
      };
}

/**
 * `POST /api/push-subscriptions`: register a Web Push subscription (the JSON of
 * a browser `PushSubscription`). A repeated call for the same `endpoint`
 * replaces the keys (browsers can rotate them) instead of failing.
 *
 * Answers 201 with a `Location` for a new subscription, 200 for one that was
 * already registered, 400 for a subscription that is not valid, or 415/413 for
 * a body that is not JSON or too large.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJsonObject(
    request,
    'The body must be a push subscription object.',
  );
  if (!body.ok) {
    return body.response;
  }
  const checked = checkSubscription(body.value);
  if (!checked.ok) {
    return problems.badRequest(
      'The subscription is not valid.',
      checked.errors,
    );
  }
  const { endpoint, p256dh, auth } = checked;
  const repo = new PushSubscriptionRepository(getDB());
  const existed = (await repo.listAll()).some((s) => s.endpoint === endpoint);
  await repo.upsert({ endpoint, p256dh, auth }, new Date().toISOString());
  const id = await subscriptionId(endpoint);
  return Response.json(
    { id },
    {
      status: existed ? 200 : 201,
      headers: {
        Location: absoluteLocation(request, `/api/push-subscriptions/${id}`),
      },
    },
  );
}
