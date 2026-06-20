import { getEnv } from '../../../../lib/util';

export const dynamic = 'force-dynamic';

/**
 * Hands out the VAPID public key so the browser can call
 * `pushManager.subscribe({ applicationServerKey })`. The key isn't a
 * secret — it just identifies our app to the push service.
 */
export async function GET() {
  const env = getEnv();
  return Response.json({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
}
