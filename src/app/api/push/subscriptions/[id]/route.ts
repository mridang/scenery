import { problems } from '@/lib/rest-json/problem';
import type { IdContext } from '@/core/api/route-context';
import { PushSubscriptionRepository } from '@/domain/push';
import { endpointForId, isSubscriptionId } from '@/lib/push/subscription-id';
import { getDatabase } from '@/core/runtime';

export const dynamic = 'force-dynamic';

/**
 * `DELETE /api/push/subscriptions/{id}`: forget a Web Push subscription. The id
 * is the one `POST /api/push/subscriptions` returned (see
 * `lib/push/subscription-id.ts`). Answers 204, or 404 when there is no such
 * subscription or the id cannot be one (the client should just stop pinging us
 * either way).
 */
export async function DELETE(
  _request: Request,
  ctx: IdContext,
): Promise<Response> {
  const { id } = await ctx.params;
  if (!isSubscriptionId(id)) {
    return problems.notFound('push subscription');
  }
  const repo = new PushSubscriptionRepository(getDatabase());
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
