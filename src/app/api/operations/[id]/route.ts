/**
 * One operation, as `POST /api/operations` left it.
 *
 *   GET /api/operations/:id → 200 (404 when there is no such operation, 401
 *   without the operator token). The logic lives in the controller
 *   (`@/domain/operations/controller`).
 */

import { operationsItem } from '@/domain/operations/controller';

export const dynamic = 'force-dynamic';

const handlers = operationsItem.handlers();
export const GET = handlers.GET!;
