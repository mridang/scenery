/**
 * @packageDocumentation
 *
 * The framework-tier API glue: the controller framework over `@/lib/rest-json`,
 * the dynamic-segment route context, and the operator-auth response wrapper.
 */

export { ApiController } from './controller';
export type {
  ApiControllerOptions,
  ApiResponse,
  Endpoint,
  HttpMethod,
  RouteHandler,
} from './controller';
export type { IdContext, RouteContext } from './route-context';
export { operatorRefusal } from './operator-auth';
