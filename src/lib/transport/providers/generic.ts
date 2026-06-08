/**
 * @packageDocumentation
 *
 * The generic transport: the platform `fetch`, with a default timeout and
 * nothing else. Bytes go straight to the target — no proxy, no anti-bot
 * tier. Used for endpoints that don't ban or challenge a Worker's egress
 * IP (e.g. TMDB).
 */

/** Options for {@link genericTransport}. @public */
export interface GenericTransportOptions {
  /** Per-request timeout in milliseconds. Defaults to 15 000. */
  readonly timeoutMs?: number;
}

/**
 * Build a {@link fetch}-compatible transport over the platform `fetch`.
 *
 * @public
 */
export function genericTransport(
  opts: GenericTransportOptions = {},
): typeof fetch {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  return (input, init) =>
    globalThis.fetch(input, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
    });
}
