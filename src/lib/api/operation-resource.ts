/**
 * @packageDocumentation
 *
 * Operations on the wire: the representation `/api/operations` sends.
 */

import type { OperationStatus, OperationType } from '../db/enums';
import type { OperationRow } from '../operations/repository';

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

/** The API's view of a stored operation. */
export function operationResource(
  row: Readonly<OperationRow>,
): OperationResource {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    parameters: JSON.parse(row.parameters) as unknown,
    ...(row.result === null
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
