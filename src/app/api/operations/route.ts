/**
 * Operator operations: the manual runs (a pipeline run, an OMDB backfill, a
 * test of the daily notification).
 *
 *   POST /api/operations {type, parameters?} → 201 + Location
 *
 * Auth: the `CRON_SECRET` as a bearer token. With no secret set (local
 * development) it is open, as the manual triggers it replaces always were. The
 * pipeline lives in the controller (`@/domain/operations/controller`).
 */

import { operationsCollection } from '@/domain/operations/controller';

export const dynamic = 'force-dynamic';

const handlers = operationsCollection.handlers();
export const POST = handlers.POST!;
