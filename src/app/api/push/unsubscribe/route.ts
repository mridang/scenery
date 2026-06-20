import { PushSubscriptionRepository } from '../../../../lib/push';
import { getDB } from '../../../../lib/util';

export const dynamic = 'force-dynamic';

interface UnsubscribeBody {
  readonly endpoint?: string;
}

/**
 * Forget a Web Push subscription. Idempotent: missing rows return 200
 * the same as deleted ones — the client should just stop pinging us.
 */
export async function POST(request: Request) {
  const body = (await safeJson(request)) as UnsubscribeBody;
  if (!body.endpoint) {
    return Response.json(
      { ok: false, error: 'missing endpoint' },
      { status: 400 },
    );
  }
  const repo = new PushSubscriptionRepository(getDB());
  await repo.remove(body.endpoint);
  return Response.json({ ok: true });
}

async function safeJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
