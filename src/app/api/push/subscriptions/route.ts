/**
 * `POST /api/push/subscriptions`: register a Web Push subscription (the JSON of
 * a browser `PushSubscription`). The logic lives in the controller
 * (`@/domain/push/controller`).
 */

import { subscriptionsCollection } from '@/domain/push/controller';

export const dynamic = 'force-dynamic';

export const { POST } = subscriptionsCollection.handlers();
