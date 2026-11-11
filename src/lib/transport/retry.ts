/**
 * @packageDocumentation
 *
 * Retry as a transport concern: `withRetry` wraps any `fetch`-compatible
 * transport and re-issues the request on transient failures (network
 * errors, HTTP 408/429/5xx) with exponential backoff and jitter. Domain
 * code just calls `fetch` and never sees the retry loop.
 */

/** Options for {@link withRetry}. @public */
export interface RetryOptions {
  /** Total attempts including the first. Defaults to 3. */
  readonly attempts?: number;
  /** Base backoff delay in ms; doubled each attempt. Defaults to 200. */
  readonly baseDelayMs?: number;
  /** Random jitter window in ms added to each delay. Defaults to 100. */
  readonly jitterMs?: number;
}

/** Whether an HTTP status code is worth retrying. @public */
export function isRetryableStatus(status: number): boolean {
  return [408, 409, 429].includes(status) || (status >= 500 && status < 600);
}

function backoffMs(attempt: number, base: number, jitter: number): number {
  const sample = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return base * 2 ** attempt + Math.floor((sample / 2 ** 32) * jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap `transport` so transient failures are retried.
 * @public
 */
export function withRetry(
  transport: typeof fetch,
  opts: RetryOptions = {},
): typeof fetch {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 200;
  const jitterMs = opts.jitterMs ?? 100;

  return (input, init) => {
    const attempt = async (attemptNumber: number): Promise<Response> => {
      const isLast = attemptNumber === attempts - 1;
      try {
        const response = await transport(input, init);
        if (!isLast && isRetryableStatus(response.status)) {
          await sleep(backoffMs(attemptNumber, baseDelayMs, jitterMs));
          return attempt(attemptNumber + 1);
        }
        return response;
      } catch (error) {
        if (isLast) {
          throw error;
        }
        await sleep(backoffMs(attemptNumber, baseDelayMs, jitterMs));
        return attempt(attemptNumber + 1);
      }
    };
    return attempt(0);
  };
}
