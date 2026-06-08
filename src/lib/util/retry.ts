/**
 * @packageDocumentation
 *
 * Lightweight retry helper. Distinguishes between "retryable" failures
 * (transport errors, HTTP 408/429/5xx) and "permanent" failures
 * (parse errors, 4xx that aren't retryable) so we don't pound an
 * endpoint into the ground on a malformed response.
 */

/**
 * Options accepted by {@link retry}.
 *
 * @public
 */
export interface RetryOptions {
  /** Number of attempts including the first. Defaults to 3. */
  readonly attempts?: number;
  /** Base delay between attempts in ms. Doubled per attempt. */
  readonly baseDelayMs?: number;
  /** Random jitter window in ms added to each delay. */
  readonly jitterMs?: number;
  /** Optional caller-supplied AbortSignal — stops retries when fired. */
  readonly signal?: AbortSignal;
}

/** Result of a retried operation, plus the attempt count used. */
export type RetryResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: string; attempts: number };

/** Sleep for the given ms, abort-aware. */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new Error('aborted');
  }
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

/**
 * Run `op` with exponential backoff + jitter. `op` decides whether a
 * particular failure is retryable by returning `{ retry: true, … }`;
 * permanent failures are surfaced immediately.
 *
 * @public
 */
export async function retry<T>(
  op: () => Promise<
    { ok: true; value: T } | { ok: false; error: string; retry: boolean }
  >,
  opts: RetryOptions = {},
): Promise<RetryResult<T>> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 200;
  const jitterMs = opts.jitterMs ?? 100;

  const attempt = async (i: number): Promise<RetryResult<T>> => {
    const r = await op();
    if (r.ok) {
      return { ok: true, value: r.value, attempts: i + 1 };
    }
    if (!r.retry || i === attempts - 1) {
      return { ok: false, error: r.error, attempts: i + 1 };
    }
    const delay = baseDelayMs * 2 ** i + Math.floor(Math.random() * jitterMs);
    await sleep(delay, opts.signal);
    return attempt(i + 1);
  };

  return attempt(0);
}

/** Decide whether an HTTP status code merits a retry. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}
