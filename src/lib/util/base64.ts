/**
 * @packageDocumentation
 *
 * Base64 for raw bytes. `btoa` is a global both on Cloudflare Workers and
 * under Jest, so this runs unchanged in both.
 */

/** Encode raw bytes as standard (padded) base64. */
export function bytesToBase64(bytes: Uint8Array): string {
  // btoa wants a "binary string": one character per byte.
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}
