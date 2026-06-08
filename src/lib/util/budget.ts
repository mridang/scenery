/**
 * @packageDocumentation
 *
 * A tiny countdown used to keep a unit of work under Cloudflare's
 * per-invocation subrequest cap (50 on the Free plan, 1000 on Paid).
 * Each external fetch consumes one unit; when the budget is exhausted
 * the caller stops cleanly and reports that more work remains, so a
 * surrounding Workflow can resume in a fresh step (which gets its own
 * subrequest budget).
 */

/**
 * Mutable subrequest budget.
 *
 * @public
 */
export class FetchBudget {
  private remaining: number;
  /** True once the budget has been fully consumed. */
  public exhausted = false;

  public constructor(total: number) {
    this.remaining = Math.max(0, total);
  }

  /**
   * Attempt to reserve one subrequest.
   *
   * @returns `true` if a unit was available (and consumed), `false` if
   *   the budget is spent — in which case the caller should stop.
   */
  public take(): boolean {
    if (this.remaining <= 0) {
      this.exhausted = true;
      return false;
    }
    this.remaining -= 1;
    if (this.remaining === 0) {
      this.exhausted = true;
    }
    return true;
  }

  /** Units still available. */
  public get left(): number {
    return this.remaining;
  }
}
