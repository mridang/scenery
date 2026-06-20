import { PushSubscriptionRepository } from '../../../../lib/push';
import { getDB } from '../../../../lib/util';

export const dynamic = 'force-dynamic';

/** Request body shape: the JSON of a browser PushSubscription. */
interface SubscribeBody {
  readonly endpoint?: string;
  readonly keys?: {
    readonly p256dh?: string;
    readonly auth?: string;
  };
}

/**
 * Register or refresh a Web Push subscription. Idempotent: a repeated
 * call for the same `endpoint` overwrites the keys (browsers can rotate
 * them) instead of erroring.
 */
export async function POST(request: Request) {
  const body = (await safeJson(request)) as SubscribeBody;
  if (
    !body.endpoint ||
    !body.keys?.p256dh ||
    !body.keys.auth ||
    !/^https:\/\//.test(body.endpoint)
  ) {
    return Response.json(
      { ok: false, error: 'invalid subscription' },
      { status: 400 },
    );
  }
  const repo = new PushSubscriptionRepository(getDB());
  await repo.upsert(
    {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    },
    new Date().toISOString(),
  );
  return Response.json({ ok: true });
}

async function safeJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
