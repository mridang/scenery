/**
 * @packageDocumentation
 *
 * A subrequest budget: a countdown that keeps a unit of work under
 * Cloudflare's per-invocation subrequest cap (50 on Free, 1000 on Paid).
 * Each external fetch consumes one unit; when the budget is spent the
 * caller stops cleanly and reports that more work remains, so a
 * surrounding Workflow can resume in a fresh step (which gets its own
 * subrequest budget). It lives beside the transports because it governs
 * exactly one thing: how many HTTP calls a unit of work may make.
 */

/** A mutable subrequest budget. @public */
export class FetchBudget {
  private remaining: number;
  /** True once the budget has been fully consumed. */
  public exhausted = false;

  public constructor(total: number) {
    this.remaining = Math.max(0, total);
  }

  /**
   * Reserve one subrequest.
   *
   * @returns `true` if a unit was available (and consumed), `false` if the
   *   budget is spent — in which case the caller should stop.
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
