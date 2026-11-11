/**
 * @packageDocumentation
 *
 * The server-side REST/JSON layer for the API, in one package: the pure
 * primitives — RFC 9457 problem responses and the standard catalogue, size-
 * and type-checked body reading, and the cursor-pagination primitives — the
 * success vocabulary (`ok`/`created`/`noContent`/`page`) a handler returns, and
 * the Next-aware ApiController that wires typed endpoints to them and renders
 * the response. The browser-side helper for reading these responses lives in
 * `@/components/api`, not here.
 */
export { type ProblemBody, problem, problems } from './problem';
export {
  type Body,
  type ObjectBody,
  isObject,
  readJson,
  readJsonObject,
} from './json';
export {
  type FormBody,
  type JsonBody,
  type TextBody,
  readBodyText,
  readFormBody,
  readJsonBody,
} from './body';
export {
  type CursorPosition,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Slice,
  decodeCursor,
  encodeCursor,
  parseLimit,
  sliceAfter,
} from './pagination';
export { entityTag, ifMatchSatisfied, ifNoneMatchHit } from './etag';
export { accepted, created, noContent, ok, page } from './results';
export {
  type ApiControllerOptions,
  type ApiResponse,
  ApiController,
  type Endpoint,
  type HttpMethod,
  type RouteHandler,
} from './controller';
export type { IdContext, RouteContext } from './route-context';
