/**
 * @packageDocumentation
 *
 * The absolute address of a resource a route has just created, for its
 * `Location` header.
 */

/** `path` resolved against the origin the request was made to. */
export function absoluteLocation(request: Request, path: string): string {
  return new URL(path, request.url).toString();
}
