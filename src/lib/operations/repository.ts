/**
 * @packageDocumentation
 *
 * D1-backed record of operator operations: one row when a run starts, updated
 * when it ends, read back by `GET /api/operations/{id}`.
 */

import { eq } from 'drizzle-orm';

import { createDatabase, type Database } from '../db/client';
import type { OperationStatus, OperationType } from '../db/enums';
import { operations } from '../db/schema';

/** A stored operation. */
export type OperationRow = typeof operations.$inferSelect;

/** Insert, finish and read operations over the `operations` table. */
export class OperationRepository {
  private readonly db: Database;

  public constructor(d1: D1Database) {
    this.db = createDatabase(d1);
  }

  /** Record that an operation of `type` has started. */
  public async start(row: {
    readonly id: string;
    readonly type: OperationType;
    readonly parameters: unknown;
    readonly createdAt: string;
  }): Promise<void> {
    await this.db.insert(operations).values({
      id: row.id,
      type: row.type,
      status: 'running',
      parameters: JSON.stringify(row.parameters),
      created_at: row.createdAt,
    });
  }

  /** Record how an operation ended. */
  public async finish(
    id: string,
    status: Exclude<OperationStatus, 'running'>,
    result: unknown,
    finishedAt: string,
  ): Promise<void> {
    await this.db
      .update(operations)
      .set({ status, result: JSON.stringify(result), finished_at: finishedAt })
      .where(eq(operations.id, id));
  }

  /** The operation with this id, or undefined. */
  public async get(id: string): Promise<OperationRow | undefined> {
    const [row] = await this.db
      .select()
      .from(operations)
      .where(eq(operations.id, id));
    return row;
  }
}
