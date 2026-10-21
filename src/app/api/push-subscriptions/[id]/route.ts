import { problems } from '../../../../lib/api/problem';
import type { IdContext } from '../../../../lib/api/route-context';
import { PushSubscriptionRepository } from '../../../../lib/push';
import { endpointForId } from '../../../../lib/push/subscription-id';
import { getDB } from '../../../../lib/util';

export const dynamic = 'force-dynamic';

/**
 * `DELETE /api/push-subscriptions/{id}`: forget a Web Push subscription. The id
 * is the one `POST /api/push-subscriptions` returned (see
 * `lib/push/subscription-id.ts`). Answers 204, or 404 when there is no such
 * subscription (the client should just stop pinging us either way).
 */
export async function DELETE(
  _request: Request,
  ctx: IdContext,
): Promise<Response> {
  const { id } = await ctx.params;
  const repo = new PushSubscriptionRepository(getDB());
  const endpoint = await endpointForId(
    (await repo.listAll()).map((s) => s.endpoint),
    id,
  );
  if (!endpoint) {
    return problems.notFound('push subscription');
  }
  await repo.remove(endpoint);
  return new Response(null, { status: 204 });
}
