/**
 * @packageDocumentation
 *
 * A tiny controller framework over the pure REST primitives in
 * `@/lib/rest-json`. Register typed endpoints and it wires the per-request
 * pipeline: build the context, `decode` the input (a thrown {@link Problem} is
 * sent as `application/problem+json`), `handle` it, then `encode` the output to
 * a JSON response with its status and headers. An endpoint grows by adding a
 * `decode`/`encode`, never by touching the Next route file, which stays a
 * one-liner: `export const { GET, POST } = controller.handlers();`.
 */

import { NextResponse } from 'next/server';

import { Problem, isProblem, problem } from '@/lib/rest-json/problem';

/** The HTTP methods an endpoint may answer. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * The Next.js route-handler context: the request and the dynamic-segment
 * params (a promise, as the App Router hands them over). It is the default
 * endpoint context; richer APIs build their own via {@link ApiControllerOptions.context}.
 */
export interface RouteContext {
  readonly request: Request;
  readonly params: Promise<Readonly<Record<string, string>>>;
}

/** What an endpoint's `encode` asks the framework to send. */
export interface ApiResponse<Output> {
  /** HTTP status; defaults to 200 (or 204 when there is no body). */
  readonly status?: number;
  /** The JSON body; omit for an empty-body response. */
  readonly body?: Output;
  /** Extra response headers (Location, Cache-Control, …). */
  readonly headers?: Readonly<Record<string, string>>;
}

/** One typed endpoint: decode the input, handle it, encode the output. */
export interface Endpoint<Input, Output, Ctx> {
  readonly method: HttpMethod;
  /** Build the typed input from the context; throw a {@link Problem} for a 4xx. */
  decode?(ctx: Ctx): Promise<Input> | Input;
  /** The work. Throw a {@link Problem} to abandon with a problem response. */
  handle(input: Input, ctx: Ctx): Promise<Output> | Output;
  /**
   * Shape the output into a response; defaults to `json(output)` with 200. The
   * wire body need not be the whole `Output` — an endpoint may keep fields it
   * only needs to choose a status (e.g. created-vs-existing) out of the body.
   */
  encode?(output: Output, ctx: Ctx): ApiResponse<unknown>;
}

/** Controller-wide hooks. */
export interface ApiControllerOptions<Ctx> {
  /** Build the per-request context; throw a {@link Problem} to reject (e.g. auth). */
  context?(route: RouteContext): Promise<Ctx> | Ctx;
  /** Map an unexpected (non-{@link Problem}) error to a response. */
  onError?(error: unknown): NextResponse;
}

/** A Next route handler for one method, as {@link ApiController.handlers} emits. */
type MethodHandler = (
  request: Request,
  route?: { readonly params: Promise<Readonly<Record<string, string>>> },
) => Promise<Response>;

/** The default 500 when an endpoint throws something that is not a {@link Problem}. */
function internalError(): NextResponse {
  return problem(
    500,
    '/problems/internal',
    'Internal Server Error',
    'The request could not be completed.',
  );
}

/** Render an endpoint's {@link ApiResponse} to a Next response. */
function render<Output>(response: ApiResponse<Output>): NextResponse {
  const headers = response.headers;
  if (response.body === undefined) {
    return new NextResponse(null, {
      status: response.status ?? 204,
      ...(headers ? { headers } : {}),
    });
  }
  return NextResponse.json(response.body, {
    status: response.status ?? 200,
    ...(headers ? { headers } : {}),
  });
}

/**
 * Registers endpoints by method and turns them into Next route handlers. The
 * default context is the {@link RouteContext}; pass `context` to build a richer
 * one (auth, env) once per request.
 */
export class ApiController<Ctx = RouteContext> {
  private readonly endpoints = new Map<
    HttpMethod,
    Endpoint<unknown, unknown, Ctx>
  >();

  public constructor(
    private readonly options: ApiControllerOptions<Ctx> = {},
  ) {}

  /** Register one endpoint. */
  public on<Input, Output>(endpoint: Endpoint<Input, Output, Ctx>): this {
    this.endpoints.set(
      endpoint.method,
      endpoint as Endpoint<unknown, unknown, Ctx>,
    );
    return this;
  }

  /** The Next route handlers, keyed by method, for `export const { … } = …`. */
  public handlers(): Partial<Record<HttpMethod, MethodHandler>> {
    const handlers: Partial<Record<HttpMethod, MethodHandler>> = {};
    for (const [method, endpoint] of this.endpoints) {
      handlers[method] = (request, route) =>
        this.run(endpoint, request, route?.params);
    }
    return handlers;
  }

  /** Run one endpoint's pipeline, mapping any {@link Problem} to its response. */
  private async run(
    endpoint: Endpoint<unknown, unknown, Ctx>,
    request: Request,
    params?: Promise<Readonly<Record<string, string>>>,
  ): Promise<Response> {
    const route: RouteContext = {
      request,
      params: params ?? Promise.resolve({}),
    };
    try {
      const ctx = this.options.context
        ? await this.options.context(route)
        : (route as unknown as Ctx);
      const input = endpoint.decode ? await endpoint.decode(ctx) : undefined;
      const output = await endpoint.handle(input, ctx);
      return render(
        endpoint.encode ? endpoint.encode(output, ctx) : { body: output },
      );
    } catch (error) {
      if (isProblem(error)) {
        return error.response;
      }
      return this.options.onError
        ? this.options.onError(error)
        : internalError();
    }
  }
}

export { Problem };
