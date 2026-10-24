/**
 * @packageDocumentation
 *
 * Operations on the wire: the representation `/api/operations` sends.
 */

import type { OperationStatus, OperationType } from '@/utils/enums';
import type { OperationRow } from './repository';

/** An operation as the API shows it. Absent members are unknown, never null. */
export interface OperationResource {
  readonly id: string;
  readonly type: OperationType;
  readonly status: OperationStatus;
  readonly parameters: unknown;
  readonly result?: unknown;
  readonly created_at: string;
  readonly finished_at?: string;
}

/**
 * How long a run may stay `running` before it is shown as failed. A run happens
 * inside one request, so one that is still unfinished after this long was cut
 * short (the Worker was stopped or redeployed) and will never write its end.
 */
export const RUN_TIMEOUT_MS = 15 * 60 * 1000;

/** The API's view of a stored operation, as of `now` (a run cut short shows as failed). */
export function operationResource(
  row: Readonly<OperationRow>,
  now: number = Date.now(),
): OperationResource {
  const abandoned =
    row.status === 'running' &&
    now - Date.parse(row.created_at) > RUN_TIMEOUT_MS;
  return {
    id: row.id,
    type: row.type,
    status: abandoned ? 'failed' : row.status,
    parameters: JSON.parse(row.parameters) as unknown,
    ...(abandoned
      ? { result: { error: 'The run did not finish.' } }
      : row.result === null
        ? {}
        : { result: JSON.parse(row.result) as unknown }),
    created_at: row.created_at,
    ...(row.finished_at === null ? {} : { finished_at: row.finished_at }),
  };
}

/** Whether `id` has the shape of an operation id (a lowercase UUID). */
export function isOperationId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    id,
  );
}
