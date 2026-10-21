import { getEnv } from '../../../../lib/util';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/push/configuration`: the VAPID public key the browser passes to
 * `pushManager.subscribe({ applicationServerKey })`. The key isn't a secret —
 * it just identifies our app to the push service — so it may be cached.
 */
export function GET(): Response {
  const env = getEnv();
  return Response.json(
    { vapid_public_key: env.VAPID_PUBLIC_KEY },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
