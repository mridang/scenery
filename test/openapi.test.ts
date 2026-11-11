import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { APP_MIGRATIONS } from './lib/core/db/migrations';
import { installCloudflareContext, sqliteD1 } from './lib/core/db/sqlite-d1';
import insecure from './fixtures/insecure-urls.json';

/**
 * Ties `openapi.json` to the route files and the controllers behind them: the
 * spec and the code are the same contract, so drift in either fails here.
 */

type Json = Record<string, unknown>;
interface Operation {
  readonly operationId?: string;
  readonly tags?: readonly string[];
  readonly summary?: string;
  readonly security?: readonly Record<string, readonly string[]>[];
  readonly requestBody?: {
    readonly content: Record<string, { readonly schema: Json }>;
  };
  readonly responses: Record<string, Json>;
}

const document = JSON.parse(
  await readFile(new URL('../openapi.json', import.meta.url), 'utf8'),
) as {
  readonly openapi: string;
  readonly paths: Record<string, Record<string, Operation>>;
  readonly components: Record<string, Record<string, Json>>;
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** Every `METHOD /path` in the spec. */
const documented = (): Map<string, Operation> => {
  const found = new Map<string, Operation>();
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const operation = item[method];
      if (operation) {
        found.set(`${method.toUpperCase()} ${path}`, operation);
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
  (
    '/api/' +
    path
      .relative(API, file)
      .replace(/\/?route\.ts$/, '')
      .replaceAll(/\[([a-z_]+)\]/g, '{$1}')
  ).replace(/\/$/, '');

/** Every `METHOD /path` a route file under src/app/api exports, with `[x]` as `{x}`. */
const registered = async (): Promise<string[]> => {
  const files = await routeFiles(API);
  const found = await Promise.all(
    files.map(async (file) => {
      const route = pathOf(file);
      const text = await readFile(file, 'utf8');
      return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
        .filter((method) =>
          new RegExp(
            String.raw`export (const \{[^}]*\b${method}\b|async function ${method}\b|function ${method}\b|const ${method}\b)`,
          ).test(text),
        )
        .map((method) => `${method} ${route}`);
    }),
  );
  return found.flat();
};

/** Resolve a `#/components/...` reference. */
const resolve = (ref: string): Json =>
  ref
    .slice(2)
    .split('/')
    .reduce<unknown>((node, key) => (node as Json)[key], document) as Json;

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
    const options = schema['oneOf'] as Json[];
    const fits = options.filter(
      (option) => check(value, option, at).length === 0,
    );
    return fits.length === 1 ? [] : [`${at}: matches ${fits.length} of oneOf`];
  }
  const errors: string[] = [];
  const types = [(schema['type'] as string[]) ?? []].flat();
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
  if (schema['enum'] && !(schema['enum'] as unknown[]).includes(value)) {
    errors.push(`${at}: not in enum`);
  }
  if (typeof value === 'string') {
    if (
      schema['pattern'] &&
      !new RegExp(String(schema['pattern'])).test(value)
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
      value.forEach((item, index) =>
        errors.push(...check(item, schema['items'] as Json, `${at}[${index}]`)),
      );
    }
  }
  if (actual === 'object') {
    const object = value as Json;
    const properties = (schema['properties'] ?? {}) as Record<string, Json>;
    ((schema['required'] ?? []) as string[]).forEach((key) => {
      if (!(key in object)) {
        errors.push(`${at}.${key}: required`);
      }
    });
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

const runOperation = jest.fn<(request: unknown) => Promise<unknown>>(
  async () => ({ done: true }),
);
jest.unstable_mockModule('@/domain/operations/run', () => ({ runOperation }));

/** The mounted handlers, by `METHOD /path`. */
type Handler = (
  request: Request,
  route?: { params: Promise<Record<string, string>> },
) => Promise<Response>;
/** Every route module, by documented path; a test keeps this list and the route files in step. */
const MODULES: Record<string, Record<string, unknown>> = {
  '/api/operations': await import('@/app/api/operations/route'),
  '/api/operations/{id}': await import('@/app/api/operations/[id]/route'),
  '/api/push/configuration': await import('@/app/api/push/configuration/route'),
  '/api/push/subscriptions': await import('@/app/api/push/subscriptions/route'),
  '/api/push/subscriptions/{id}':
    await import('@/app/api/push/subscriptions/[id]/route'),
};

const handlers = new Map<string, Handler>();
for (const [path, module] of Object.entries(MODULES)) {
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    if (typeof module[method] === 'function') {
      handlers.set(`${method} ${path}`, module[method] as Handler);
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

const send = ({ key, path, init, id }: Call): Promise<Response> => {
  const handler = handlers.get(key) as Handler;
  return handler(
    new Request(`${ORIGIN}${path}`, { method: key.split(' ', 1)[0], ...init }),
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
  return ((await res.json()) as { id: string }).id;
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
      const { id } = (await created.json()) as { id: string };
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
  const operation = documented().get(key) as Operation;
  const response = responseFor(operation, res.status);
  if (!response) {
    return [`${key}: undocumented status ${res.status}`];
  }
  const errors: string[] = [];
  const headers = (response['headers'] ?? {}) as Record<string, Json>;
  Object.keys(headers).forEach((name) => {
    const required = headers[name]?.['required'];
    if ((required || name === 'Retry-After') && !res.headers.get(name)) {
      errors.push(`${key} ${res.status}: missing header ${name}`);
    }
  });
  const content = (response['content'] ?? {}) as Record<
    string,
    { schema: Json }
  >;
  const media = Object.keys(content)[0];
  if (media === undefined) {
    const text = await res.clone().text();
    return text === '' ? errors : [...errors, `${key}: unexpected body`];
  }
  if (!(res.headers.get('content-type') ?? '').startsWith(media)) {
    return [...errors, `${key} ${res.status}: content type is not ${media}`];
  }
  const schema = content[media]?.schema as Json;
  return [...errors, ...check(await res.clone().json(), schema)];
}

describe('openapi.json', () => {
  it('is tested through every route file', async () => {
    const files = await routeFiles(API);
    expect(
      files.map((file) => pathOf(file)).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(Object.keys(MODULES).toSorted((a, b) => a.localeCompare(b)));
  });

  it('is OpenAPI 3.1 and every reference resolves', () => {
    expect(document.openapi).toMatch(/^3\.1\./);
    const refs: string[] = [];
    JSON.stringify(document, (key, value: unknown) => {
      if (key === '$ref') {
        refs.push(String(value));
      }
      return value;
    });
    refs.forEach((ref) => expect(resolve(ref)).toBeDefined());
  });

  it('describes exactly the routes under src/app/api, one operation each', async () => {
    const routes = await registered();
    expect(
      [...documented().keys()].toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(routes.toSorted((a, b) => a.localeCompare(b)));
  });

  it('gives every operation an id, tags, a summary, security and a problem response', () => {
    const ids = new Set<string>();
    documented().forEach((operation, key) => {
      expect(operation.operationId).toBeTruthy();
      expect(ids.has(operation.operationId as string)).toBe(false);
      ids.add(operation.operationId as string);
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
      (operation.security ?? []).forEach((requirement) =>
        Object.keys(requirement).forEach((scheme) =>
          expect({ key, scheme, known: schemes.includes(scheme) }).toEqual({
            key,
            scheme,
            known: true,
          }),
        ),
      );
    });
  });

  it('keeps everything outside /api out of the contract', () => {
    Object.keys(document.paths).forEach((path) =>
      expect(path).toMatch(/^\/api\//),
    );
  });

  it('names its properties in snake_case, except the Push API members', () => {
    const names = new Set<string>();
    JSON.stringify(document.components['schemas'], (key, value: unknown) => {
      if (key === 'properties' && value && typeof value === 'object') {
        Object.keys(value).forEach((name) => names.add(name));
      }
      return value;
    });
    [...names]
      .filter((name) => name !== 'expirationTime')
      .forEach((name) => expect(name).toMatch(/^[a-z][a-z0-9_]*$/));
  });
});

describe.each(subjects)('$key', ({ key, valid, invalid }) => {
  const operation = documented().get(key) as Operation;
  const secured = (operation.security ?? []).length > 0;

  it('has a test subject for every documented operation', () => {
    expect(
      subjects.map((s) => s.key).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual([...documented().keys()].toSorted((a, b) => a.localeCompare(b)));
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
    const schema = operation.requestBody.content['application/json']
      ?.schema as Json;

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
      const sent = JSON.parse(String(call.init?.body)) as unknown;
      expect(check(sent, schema)).not.toEqual([]);
    });

    it('the schema accepts the body of the valid call', async () => {
      const call = await valid();
      expect(check(JSON.parse(String(call.init?.body)), schema)).toEqual([]);
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
    documented().forEach((operation, key) => {
      const produced = seen.get(key) as Set<number>;
      const promised = Object.keys(operation.responses)
        .map(Number)
        .filter((status) => status !== 429 && status !== 200 && status !== 201);
      promised.forEach((status) =>
        expect({ key, status, made: produced.has(status) }).toEqual({
          key,
          status,
          made: true,
        }),
      );
      expect([...produced].every((s) => responseFor(operation, s))).toBe(true);
    });
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
