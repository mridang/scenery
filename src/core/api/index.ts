/**
 * @packageDocumentation
 *
 * The framework-tier API glue: the controller framework over `@/lib/rest-json`,
 * the dynamic-segment route context, and the operator-auth response wrapper.
 */

export { ApiController, Problem } from './controller';
export type {
  ApiControllerOptions,
  ApiResponse,
  Endpoint,
  HttpMethod,
  RouteContext,
} from './controller';
export { operatorRefusal } from './operator-auth';
