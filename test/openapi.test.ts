import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { z } from 'zod';

import { APP_MIGRATIONS } from './lib/core/db/migrations';
import { installCloudflareContext, sqliteD1 } from './lib/core/db/sqlite-d1';
import insecure from './fixtures/insecure-urls.json';
import type { HttpMethod, RouteContext } from '@/lib/core/api';

const COLLATOR = new Intl.Collator();

const ROUTE_FILE_SUFFIX = /\/?route\.ts$/u;
const TRAILING_SLASH = /\/$/u;
const OPENAPI_31_VERSION = /^3\.1\./u;
const API_PATH_PREFIX = /^\/api\//u;
const SNAKE_CASE_NAME = /^[a-z][a-z0-9_]*$/u;

/**
 * Ties `openapi.json` to the route files and the controllers behind them: the
 * spec and the code are the same contract, so drift in either fails here.
 */

const JsonObject = z.record(z.string(), z.unknown());
type Json = z.infer<typeof JsonObject>;
const StringList = z.array(z.string());
const OperationSchema = z.looseObject({
  operationId: z.string().optional(),
  tags: StringList.optional(),
  summary: z.string().optional(),
  security: z.array(z.record(z.string(), StringList)).optional(),
  requestBody: z
    .object({
      content: z.record(z.string(), z.object({ schema: JsonObject })),
    })
    .optional(),
  responses: z.record(z.string(), JsonObject),
});
type Operation = z.infer<typeof OperationSchema>;

const document = z
  .object({
    openapi: z.string(),
    paths: z.record(z.string(), z.record(z.string(), OperationSchema)),
    components: z.record(z.string(), z.record(z.string(), JsonObject)),
  })
  .parse(
    JSON.parse(
      await readFile(new URL('../openapi.json', import.meta.url), 'utf8'),
    ),
  );

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** Every `METHOD /path` in the spec. */
const documented = (): Map<string, Operation> => {
  const found = new Map<string, Operation>();
  for (const [route, item] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const operation = item[method];
      if (operation) {
        found.set(`${method.toUpperCase()} ${route}`, operation);
      }
    }
  }
  return found;
};

const API = path.join(process.cwd(), 'src/app/api');

const routeFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      if (entry.isDirectory()) {
        return routeFiles(path.join(dir, entry.name));
      }
      return entry.name === 'route.ts' ? [path.join(dir, entry.name)] : [];
    }),
  );
  return found.flat();
};

/** The documented path of a route file, with `[x]` as `{x}`. */
const pathOf = (file: string): string =>
  `/api/${path
    .relative(API, file)
    .replace(ROUTE_FILE_SUFFIX, '')
    .replaceAll(/\[([a-z_]+)\]/gu, '{$1}')}`.replace(TRAILING_SLASH, '');

/** Every `METHOD /path` a route file under src/app/api exports, with `[x]` as `{x}`. */
const registered = async (): Promise<string[]> => {
  const files = await routeFiles(API);
  const found = await Promise.all(
    files.map(async (file) => {
      const route = pathOf(file);
      const text = await readFile(file, 'utf8');
      return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].flatMap((method) =>
        new RegExp(
          String.raw`export (const \{[^}]*\b${method}\b|async function ${method}\b|function ${method}\b|const ${method}\b)`,
          'u',
        ).test(text)
          ? [`${method} ${route}`]
          : [],
      );
    }),
  );
  return found.flat();
};

/** Resolve a `#/components/...` reference. */
const resolve = (ref: string): Json =>
  JsonObject.parse(
    ref
      .slice(2)
      .split('/')
      .reduce<unknown>((node, key) => JsonObject.parse(node)[key], document),
  );

const actualType = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return Number.isInteger(value) ? 'integer' : typeof value;
};

/**
 * A small structural check of a value against a schema of this spec: type,
 * enum, const, pattern, bounds, required, additionalProperties, items,
 * uniqueItems, oneOf, date-time. Returns what is wrong, empty when it fits.
 */
function check(value: unknown, schema: Json, at = '$'): string[] {
  if (typeof schema['$ref'] === 'string') {
    return check(value, resolve(schema['$ref']), at);
  }
  if (schema['oneOf']) {
    const options = z.array(JsonObject).parse(schema['oneOf']);
    const fits = options.filter(
      (option) => check(value, option, at).length === 0,
    );
    return fits.length === 1 ? [] : [`${at}: matches ${fits.length} of oneOf`];
  }
  const errors: string[] = [];
  const types = StringList.parse([schema['type'] ?? []].flat());
  const actual = actualType(value);
  if (
    types.length > 0 &&
    !types.includes(actual) &&
    !(actual === 'integer' && types.includes('number'))
  ) {
    return [`${at}: expected ${types.join('|')}, got ${actual}`];
  }
  if ('const' in schema && value !== schema['const']) {
    errors.push(`${at}: not ${String(schema['const'])}`);
  }
  const allowedValues = z.array(z.unknown()).optional().parse(schema['enum']);
  if (allowedValues && !allowedValues.includes(value)) {
    errors.push(`${at}: not in enum`);
  }
  if (typeof value === 'string') {
    if (
      typeof schema['pattern'] === 'string' &&
      !new RegExp(schema['pattern'], 'u').test(value)
    ) {
      errors.push(`${at}: does not match pattern`);
    }
    if (schema['minLength'] && value.length < Number(schema['minLength'])) {
      errors.push(`${at}: too short`);
    }
    if (schema['format'] === 'date-time' && Number.isNaN(Date.parse(value))) {
      errors.push(`${at}: not an RFC 3339 timestamp`);
    }
  }
  if (typeof value === 'number') {
    if (schema['minimum'] !== undefined && value < Number(schema['minimum'])) {
      errors.push(`${at}: below minimum`);
    }
    if (schema['maximum'] !== undefined && value > Number(schema['maximum'])) {
      errors.push(`${at}: above maximum`);
    }
  }
  if (Array.isArray(value)) {
    if (schema['minItems'] && value.length < Number(schema['minItems'])) {
      errors.push(`${at}: too few items`);
    }
    if (schema['uniqueItems'] && new Set(value).size !== value.length) {
      errors.push(`${at}: repeated items`);
    }
    if (schema['items']) {
      for (const [index, item] of value.entries()) {
        errors.push(
          ...check(item, JsonObject.parse(schema['items']), `${at}[${index}]`),
        );
      }
    }
  }
  if (actual === 'object') {
    const object = JsonObject.parse(value);
    const properties = z
      .record(z.string(), JsonObject)
      .parse(schema['properties'] ?? {});
    for (const key of StringList.parse(schema['required'] ?? [])) {
      if (!(key in object)) {
        errors.push(`${at}.${key}: required`);
      }
    }
    if (
      schema['maxProperties'] !== undefined &&
      Object.keys(object).length > Number(schema['maxProperties'])
    ) {
      errors.push(`${at}: too many properties`);
    }
    for (const [key, member] of Object.entries(object)) {
      if (properties[key]) {
        errors.push(...check(member, properties[key], `${at}.${key}`));
      } else if (schema['additionalProperties'] === false) {
        errors.push(`${at}.${key}: not allowed`);
      } else {
        // Extra members are allowed unless the schema forbids them.
      }
    }
  }
  return errors;
}

const runOperation = jest.fn<
  (request: unknown) => Promise<Record<string, unknown>>
>(async () => ({ done: true }));
// eslint-disable-next-line tslop/no-module-mocking -- the code under test imports this module directly, so only mocking the module can stand in for it
jest.unstable_mockModule('@/domain/operations/run', () => ({ runOperation }));

/** The mounted handlers, by `METHOD /path`. */
/** A route handler: the request and its optional route context; some answer synchronously. */
type Handler = (
  request: Request,
  route?: RouteContext,
) => Promise<Response> | Response;
/** The route modules, by documented path. */
interface RouteModules {
  readonly [path: string]: Readonly<Partial<Record<HttpMethod, Handler>>>;
}
/** Every route module, by documented path; a test keeps this list and the route files in step. */
const MODULES: RouteModules = {
  '/api/operations': await import('@/app/api/operations/route'),
  '/api/operations/{id}': await import('@/app/api/operations/[id]/route'),
  '/api/push/configuration': await import('@/app/api/push/configuration/route'),
  '/api/push/subscriptions': await import('@/app/api/push/subscriptions/route'),
  '/api/push/subscriptions/{id}':
    await import('@/app/api/push/subscriptions/[id]/route'),
};

const HTTP_METHODS: readonly HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];
const handlers = new Map<string, Handler>();
for (const [route, routeModule] of Object.entries(MODULES)) {
  for (const method of HTTP_METHODS) {
    const handler = routeModule[method];
    if (handler) {
      handlers.set(`${method} ${route}`, handler);
    }
  }
}

const SECRET = 'test-secret';
const ORIGIN = 'https://app.test';
let restore: () => void;

beforeEach(async () => {
  runOperation.mockClear();
  runOperation.mockResolvedValue({ done: true });
  const made = await sqliteD1(...APP_MIGRATIONS);
  restore = installCloudflareContext(made.d1, {
    CRON_SECRET: SECRET,
    VAPID_PUBLIC_KEY: 'public-key',
  });
});

afterEach(() => restore());

/** What one test request is: the handler, the request and the path id. */
interface Call {
  readonly key: string;
  readonly path: string;
  readonly init?: RequestInit;
  readonly id?: string;
}

const AUTH = { authorization: `Bearer ${SECRET}` };
const JSON_TYPE = { 'content-type': 'application/json' };
const SUBSCRIPTION = {
  endpoint: 'https://push.test/abc',
  keys: { p256dh: 'p', auth: 'a' },
};

const send = async ({
  key,
  path: target,
  init,
  id,
}: Call): Promise<Response> => {
  const handler = handlers.get(key)!;
  return handler(
    new Request(`${ORIGIN}${target}`, {
      method: key.split(' ', 1)[0],
      ...init,
    }),
    id === undefined ? undefined : { params: Promise.resolve({ id }) },
  );
};

const body = (value: unknown, headers: Record<string, string> = {}) => ({
  headers: { ...JSON_TYPE, ...headers },
  body: JSON.stringify(value),
});

/** A refused or accepted body that is not an object, an unknown field, a wrong type. */
interface Scenario {
  readonly name: string;
  readonly call: () => Promise<Call> | Call;
}

/**
 * For each operation: the call that succeeds (the arrangement may need an
 * earlier call), and the calls that are refused. `token` says whether the
 * calls carry the operator token.
 */
interface Subject {
  readonly key: string;
  readonly valid: () => Promise<Call> | Call;
  readonly invalid: readonly Scenario[];
}

const createOperation = async (): Promise<string> => {
  const res = await send({
    key: 'POST /api/operations',
    path: '/api/operations',
    init: body({ type: 'push_trigger' }, AUTH),
  });
  const { id } = await res.json<{ id: string }>();
  return id;
};

const operationsPost = (value: unknown, headers = AUTH): Call => ({
  key: 'POST /api/operations',
  path: '/api/operations',
  init: body(value, headers),
});

const subscriptionsPost = (value: unknown): Call => ({
  key: 'POST /api/push/subscriptions',
  path: '/api/push/subscriptions',
  init: body(value),
});

const subjects: readonly Subject[] = [
  {
    key: 'POST /api/operations',
    valid: () =>
      operationsPost({
        type: 'omdb_backfill',
        parameters: { limit: 5 },
      }),
    invalid: [
      { name: 'wrong type', call: () => operationsPost({ type: 7 }) },
      {
        name: 'unknown type',
        call: () => operationsPost({ type: 'format_disk' }),
      },
      { name: 'missing type', call: () => operationsPost({}) },
      {
        name: 'unknown field',
        call: () => operationsPost({ type: 'push_trigger', extra: 1 }),
      },
      {
        name: 'unknown parameter',
        call: () =>
          operationsPost({ type: 'omdb_backfill', parameters: { sky: 1 } }),
      },
      {
        name: 'out-of-range parameter',
        call: () =>
          operationsPost({ type: 'omdb_backfill', parameters: { limit: 0 } }),
      },
      {
        name: 'wrong-typed parameter',
        call: () =>
          operationsPost({
            type: 'pipeline_run',
            parameters: { steps: [{}], backfill_pages: 'ten' },
          }),
      },
      {
        name: 'not an object',
        call: () => operationsPost([1]),
      },
      {
        name: 'not JSON',
        call: () => ({
          ...operationsPost({}),
          init: {
            headers: { ...JSON_TYPE, ...AUTH },
            body: '{nope',
          },
        }),
      },
      {
        name: 'not a JSON media type',
        call: () => ({
          ...operationsPost({}),
          init: {
            headers: { 'content-type': 'text/plain', ...AUTH },
            body: 'type=push_trigger',
          },
        }),
      },
      {
        name: 'too large',
        call: () => ({
          ...operationsPost({}),
          init: {
            headers: { ...JSON_TYPE, ...AUTH },
            body: JSON.stringify({ type: 'x'.repeat(300 * 1024) }),
          },
        }),
      },
    ],
  },
  {
    key: 'GET /api/operations/{id}',
    valid: async () => {
      const id = await createOperation();
      return {
        key: 'GET /api/operations/{id}',
        path: `/api/operations/${id}`,
        init: { headers: AUTH },
        id,
      };
    },
    invalid: [
      {
        name: 'an id that cannot be one',
        call: () => ({
          key: 'GET /api/operations/{id}',
          path: '/api/operations/nope',
          init: { headers: AUTH },
          id: 'nope',
        }),
      },
      {
        name: 'an unknown id',
        call: () => ({
          key: 'GET /api/operations/{id}',
          path: '/api/operations/0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b',
          init: { headers: AUTH },
          id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b',
        }),
      },
    ],
  },
  {
    key: 'GET /api/push/configuration',
    valid: () => ({
      key: 'GET /api/push/configuration',
      path: '/api/push/configuration',
    }),
    invalid: [],
  },
  {
    key: 'POST /api/push/subscriptions',
    valid: () => subscriptionsPost(SUBSCRIPTION),
    invalid: [
      {
        name: 'missing required',
        call: () => subscriptionsPost({ endpoint: SUBSCRIPTION.endpoint }),
      },
      {
        name: 'wrong type',
        call: () => subscriptionsPost({ endpoint: 4, keys: 'x' }),
      },
      {
        name: 'not an https endpoint',
        call: () =>
          subscriptionsPost({
            ...SUBSCRIPTION,
            endpoint: insecure.pushEndpointBare,
          }),
      },
      { name: 'not an object', call: () => subscriptionsPost('x') },
      {
        name: 'not JSON',
        call: () => ({
          ...subscriptionsPost({}),
          init: { headers: JSON_TYPE, body: '{nope' },
        }),
      },
      {
        name: 'not a JSON media type',
        call: () => ({
          ...subscriptionsPost({}),
          init: { headers: { 'content-type': 'text/plain' }, body: 'x' },
        }),
      },
      {
        name: 'too large',
        call: () => ({
          ...subscriptionsPost({}),
          init: {
            headers: JSON_TYPE,
            body: JSON.stringify({ endpoint: 'x'.repeat(300 * 1024) }),
          },
        }),
      },
    ],
  },
  {
    key: 'DELETE /api/push/subscriptions/{id}',
    valid: async () => {
      const created = await send(subscriptionsPost(SUBSCRIPTION));
      const { id } = await created.json<{ id: string }>();
      return {
        key: 'DELETE /api/push/subscriptions/{id}',
        path: `/api/push/subscriptions/${id}`,
        id,
      };
    },
    invalid: [
      {
        name: 'an id that cannot be one',
        call: () => ({
          key: 'DELETE /api/push/subscriptions/{id}',
          path: '/api/push/subscriptions/nope',
          id: 'nope',
        }),
      },
      {
        name: 'an unknown id',
        call: () => ({
          key: 'DELETE /api/push/subscriptions/{id}',
          path: `/api/push/subscriptions/${'a'.repeat(64)}`,
          id: 'a'.repeat(64),
        }),
      },
    ],
  },
];

/** The documented response for a status, or undefined. */
const responseFor = (
  operation: Operation,
  status: number,
): Json | undefined => {
  const response = operation.responses[String(status)];
  return response && typeof response['$ref'] === 'string'
    ? resolve(response['$ref'])
    : response;
};

/** Check a response against the spec: documented status, headers, problem body, schema. */
async function conforms(key: string, res: Response): Promise<string[]> {
  const operation = documented().get(key)!;
  const response = responseFor(operation, res.status);
  if (!response) {
    return [`${key}: undocumented status ${res.status}`];
  }
  const errors: string[] = [];
  const headers = z
    .record(z.string(), JsonObject)
    .parse(response['headers'] ?? {});
  for (const name of Object.keys(headers)) {
    const required = headers[name]?.['required'];
    if ((required || name === 'Retry-After') && !res.headers.get(name)) {
      errors.push(`${key} ${res.status}: missing header ${name}`);
    }
  }
  const content = z
    .record(z.string(), z.object({ schema: JsonObject }))
    .parse(response['content'] ?? {});
  const media = Object.keys(content)[0];
  if (media === undefined) {
    const text = await res.clone().text();
    return text === '' ? errors : [...errors, `${key}: unexpected body`];
  }
  if (!(res.headers.get('content-type') ?? '').startsWith(media)) {
    return [...errors, `${key} ${res.status}: content type is not ${media}`];
  }
  const schema = content[media]?.schema;
  if (!schema) {
    return [...errors, `${key} ${res.status}: no schema for ${media}`];
  }
  return [...errors, ...check(await res.clone().json(), schema)];
}

describe('openapi.json', () => {
  it('is tested through every route file', async () => {
    const files = await routeFiles(API);
    expect(
      files
        .map((file) => pathOf(file))
        .toSorted((a, b) => COLLATOR.compare(a, b)),
    ).toEqual(Object.keys(MODULES).toSorted((a, b) => COLLATOR.compare(a, b)));
  });

  it('is OpenAPI 3.1 and every reference resolves', () => {
    expect(document.openapi).toMatch(OPENAPI_31_VERSION);
    const references: string[] = [];
    JSON.stringify(document, (key, value: unknown) => {
      if (key === '$ref') {
        references.push(String(value));
      }
      return value;
    });
    for (const ref of references) {
      expect(resolve(ref)).toBeDefined();
    }
  });

  it('describes exactly the routes under src/app/api, one operation each', async () => {
    const routes = await registered();
    expect(
      [...documented().keys()].toSorted((a, b) => COLLATOR.compare(a, b)),
    ).toEqual(routes.toSorted((a, b) => COLLATOR.compare(a, b)));
  });

  it('gives every operation an id, tags, a summary, security and a problem response', () => {
    const ids = new Set<string>();
    for (const [key, operation] of documented().entries()) {
      expect(operation.operationId).toBeTruthy();
      expect(ids.has(operation.operationId!)).toBe(false);
      ids.add(operation.operationId!);
      expect(operation.tags?.length).toBeGreaterThan(0);
      expect(operation.summary).toBeTruthy();
      expect(operation.security).toBeDefined();
      expect(
        Object.keys(operation.responses).some(
          (status) => Number(status) >= 400,
        ),
      ).toBe(true);
      expect(responseFor(operation, 429)).toBeDefined();
      const schemes = Object.keys(document.components['securitySchemes'] ?? {});
      for (const requirement of operation.security ?? []) {
        for (const scheme of Object.keys(requirement)) {
          expect({ key, scheme, known: schemes.includes(scheme) }).toEqual({
            key,
            scheme,
            known: true,
          });
        }
      }
    }
  });

  it('keeps everything outside /api out of the contract', () => {
    for (const documentedPath of Object.keys(document.paths)) {
      expect(documentedPath).toMatch(API_PATH_PREFIX);
    }
  });

  it('names its properties in snake_case, except the Push API members', () => {
    const names = new Set<string>();
    JSON.stringify(document.components['schemas'], (key, value: unknown) => {
      if (key === 'properties' && value && typeof value === 'object') {
        for (const name of Object.keys(value)) {
          names.add(name);
        }
      }
      return value;
    });
    for (const name of [...names].filter((each) => each !== 'expirationTime')) {
      expect(name).toMatch(SNAKE_CASE_NAME);
    }
  });
});

describe.each(subjects)('$key', ({ key, valid, invalid }) => {
  const operation = documented().get(key)!;
  const secured = (operation.security ?? []).length > 0;

  it('has a test subject for every documented operation', () => {
    expect(
      subjects.map((s) => s.key).toSorted((a, b) => COLLATOR.compare(a, b)),
    ).toEqual(
      [...documented().keys()].toSorted((a, b) => COLLATOR.compare(a, b)),
    );
  });

  it('answers valid input with a documented success that fits its schema', async () => {
    const call = await valid();
    const res = await send(call);
    expect(res.status).toBeLessThan(300);
    expect(await conforms(key, res)).toEqual([]);
    if (res.status === 201) {
      expect(res.headers.get('location')?.startsWith(`${ORIGIN}/api/`)).toBe(
        true,
      );
    }
  });

  if (invalid.length > 0) {
    it.each(invalid.map((scenario) => [scenario.name, scenario] as const))(
      'refuses %s with a documented problem+json',
      async (_name, scenario) => {
        const res = await send(await scenario.call());
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
        expect(res.headers.get('content-type')).toBe(
          'application/problem+json',
        );
        expect(await conforms(key, res)).toEqual([]);
      },
    );
  }

  if (operation.requestBody) {
    const schema = operation.requestBody.content['application/json']?.schema;
    if (!schema) {
      throw new Error(`${key}: the request body has no JSON schema`);
    }

    it.each(
      invalid
        .filter(
          (s) =>
            !['not JSON', 'not a JSON media type', 'too large'].includes(
              s.name,
            ),
        )
        .map((scenario) => [scenario.name, scenario] as const),
    )('the schema also rejects the body of: %s', async (_name, scenario) => {
      const call = await scenario.call();
      const sent = JSON.parse(
        typeof call.init?.body === 'string' ? call.init.body : '',
      ) as unknown;
      expect(check(sent, schema)).not.toEqual([]);
    });

    it('the schema accepts the body of the valid call', async () => {
      const call = await valid();
      expect(
        check(
          JSON.parse(typeof call.init?.body === 'string' ? call.init.body : ''),
          schema,
        ),
      ).toEqual([]);
    });
  }

  if (secured) {
    it('answers 401 problem+json with a challenge to a caller with no credentials', async () => {
      const call = await valid();
      const res = await send({
        ...call,
        init: { ...call.init, headers: JSON_TYPE },
      });
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
      expect(await conforms(key, res)).toEqual([]);
    });

    it('answers 401 to the wrong token', async () => {
      const call = await valid();
      const res = await send({
        ...call,
        init: {
          ...call.init,
          headers: { ...JSON_TYPE, authorization: 'Bearer wrong' },
        },
      });
      expect(res.status).toBe(401);
    });

    it('is open where no secret is set, as the spec says', async () => {
      restore();
      const made = await sqliteD1(...APP_MIGRATIONS);
      // eslint-disable-next-line require-atomic-updates -- the test's setup runs one step at a time, so nothing else assigns it meanwhile
      restore = installCloudflareContext(made.d1, {});
      const call = await valid();
      const res = await send({
        ...call,
        init: { ...call.init, headers: JSON_TYPE },
      });
      expect(res.status).not.toBe(401);
    });
  } else {
    it('is public: it answers without a session or token', async () => {
      const call = await valid();
      const res = await send({
        ...call,
        init: { ...call.init, headers: { ...JSON_TYPE } },
      });
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).toBeLessThan(300);
    });
  }
});

describe('documented statuses', () => {
  it('are all produced by some case, except the platform rate limit', async () => {
    const seen = new Map<string, Set<number>>();
    for (const subject of subjects) {
      const first = await send(await subject.valid());
      const statuses = new Set<number>([first.status]);
      for (const scenario of subject.invalid) {
        const response = await send(await scenario.call());
        statuses.add(response.status);
      }
      if ((documented().get(subject.key)?.security ?? []).length > 0) {
        const call = await subject.valid();
        const repeated = await send({
          ...call,
          init: { ...call.init, headers: JSON_TYPE },
        });
        statuses.add(repeated.status);
      }
      seen.set(subject.key, statuses);
    }
    for (const [key, operation] of documented().entries()) {
      const produced = seen.get(key)!;
      const promised = Object.keys(operation.responses)
        .map(Number)
        .filter((status) => status !== 429 && status !== 200 && status !== 201);
      for (const status of promised) {
        expect({ key, status, made: produced.has(status) }).toEqual({
          key,
          status,
          made: true,
        });
      }
      expect([...produced].every((s) => responseFor(operation, s))).toBe(true);
    }
  });

  it('includes both 200 and 201 for a repeated subscription', async () => {
    const created = await send(subscriptionsPost(SUBSCRIPTION));
    expect(created.status).toBe(201);
    const again = await send(subscriptionsPost(SUBSCRIPTION));
    expect(again.status).toBe(200);
    expect(await conforms('POST /api/push/subscriptions', again)).toEqual([]);
  });

  it('answers a 201 operation even when the run fails', async () => {
    runOperation.mockRejectedValue(new Error('boom'));
    const res = await send(operationsPost({ type: 'push_trigger' }));
    expect(res.status).toBe(201);
    expect(await conforms('POST /api/operations', res)).toEqual([]);
  });
});
