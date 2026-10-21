import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'src/app/api');
const METHODS = ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'] as const;

interface Spec {
  readonly paths: Readonly<
    Record<
      string,
      Readonly<
        Record<
          string,
          { security?: unknown; responses?: Record<string, unknown> }
        >
      >
    >
  >;
  readonly components: { readonly schemas: Readonly<Record<string, unknown>> };
}

const spec = JSON.parse(
  readFileSync(path.join(ROOT, 'openapi/openapi.json'), 'utf8'),
) as Spec;

/** Every `METHOD /api/...` the route files export, with `[id]` written as `{id}`. */
function implemented(dir = API_DIR): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return implemented(full);
    }
    if (name !== 'route.ts') {
      return [];
    }
    const url = `/api/${path
      .relative(API_DIR, dir)
      .split(path.sep)
      .filter(Boolean)
      .map((segment) => segment.replace(/^\[(.+)\]$/, '{$1}'))
      .join('/')}`;
    const source = readFileSync(full, 'utf8');
    return METHODS.filter((method) =>
      new RegExp(`export (async )?function ${method}\\b`).test(source),
    ).map((method) => `${method} ${url}`);
  });
}

const documented = Object.entries(spec.paths).flatMap(([url, operations]) =>
  Object.keys(operations).map((method) => `${method.toUpperCase()} ${url}`),
);

describe('openapi/openapi.json', () => {
  it('describes every route under /api, and only those', () => {
    expect(documented.toSorted()).toEqual(implemented().toSorted());
  });

  it('says for every operation whether it needs a login', () => {
    for (const [url, operations] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        expect([url, method, 'security' in operation]).toEqual([
          url,
          method,
          true,
        ]);
      }
    }
  });

  it('answers every error as a problem document and documents the rate limit', () => {
    for (const operations of Object.values(spec.paths)) {
      for (const operation of Object.values(operations)) {
        const responses = operation.responses ?? {};
        expect(Object.keys(responses)).toContain('429');
        for (const [status, response] of Object.entries(responses)) {
          if (Number(status) >= 400) {
            expect(
              Object.keys((response as { content: object }).content),
            ).toEqual(['application/problem+json']);
          }
        }
      }
    }
  });

  it('names every property in snake_case', () => {
    const names: string[] = [];
    const walk = (node: unknown): void => {
      if (typeof node !== 'object' || node === null) {
        return;
      }
      const record = node as Record<string, unknown>;
      const properties = record['properties'];
      if (typeof properties === 'object' && properties !== null) {
        names.push(...Object.keys(properties));
      }
      Object.values(record).forEach(walk);
    };
    walk(spec.components.schemas);
    expect(
      names.filter((name) => !/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)),
    ).toEqual([]);
  });
});
