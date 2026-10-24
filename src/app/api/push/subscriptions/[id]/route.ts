/**
 * `DELETE /api/push/subscriptions/{id}`: forget a Web Push subscription. The
 * logic lives in the controller (`@/domain/push/controller`).
 */

import { subscriptionsItem } from '@/domain/push/controller';

export const dynamic = 'force-dynamic';

const handlers = subscriptionsItem.handlers();
export const DELETE = handlers.DELETE!;
