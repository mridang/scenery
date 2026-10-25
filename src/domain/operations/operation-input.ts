/**
 * @packageDocumentation
 *
 * Checking the body of `POST /api/operations`: a `type` from the closed list
 * and the `parameters` that type takes. Anything not listed is refused, so a
 * typo is an error and not a silent default.
 */

import { OPERATION_TYPES, type OperationType } from '@/domain/db/enums';
import { SOURCE_SLUGS } from '@/lib/sources/types';
import { TORRENT_PROVIDERS } from '@/lib/torrents/types';
import {
  DEFAULT_OMDB_LIMIT,
  MAX_BACKFILL_PAGES,
  MAX_OMDB_LIMIT,
  MIN_OMDB_LIMIT,
  PIPELINE_STEPS,
  type OperationRequest,
  type PipelineRunParameters,
} from './types';
import { isObject } from '@/lib/core/api';

/** The checked request, or what was wrong with it. */
export type OperationInput =
  | { readonly ok: true; readonly request: OperationRequest }
  | { readonly ok: false; readonly errors: readonly string[] };

type Parameters = Readonly<Record<string, unknown>>;

/** Errors for every key of `parameters` that is not in `allowed`. */
function unknownKeys(
  parameters: Parameters,
  allowed: readonly string[],
): readonly string[] {
  return Object.keys(parameters)
    .filter((key) => !allowed.includes(key))
    .map((key) => `parameters.${key}: not a parameter of this operation.`);
}

/** The values of a list parameter that must each be one of `allowed`, or errors. */
function listOf<T extends string>(
  name: string,
  value: unknown,
  allowed: readonly T[],
): { readonly values: readonly T[]; readonly errors: readonly string[] } {
  const items: readonly unknown[] = Array.isArray(value) ? value : [];
  const bad =
    !Array.isArray(value) ||
    value.length === 0 ||
    items.some((item) => !allowed.includes(item as T)) ||
    new Set(items).size !== items.length;
  return bad
    ? {
        values: [],
        errors: [
          `parameters.${name}: a non-repeating list of ${allowed.join(', ')}.`,
        ],
      }
    : { values: items as readonly T[], errors: [] };
}

/** Check the parameters of a `pipeline_run`. */
function pipelineRun(parameters: Parameters): OperationInput {
  const errors = [
    ...unknownKeys(parameters, [
      'source',
      'backfill_pages',
      'steps',
      'torrent_providers',
    ]),
  ];
  const { source, backfill_pages: pages } = parameters;
  if (source !== undefined && !SOURCE_SLUGS.includes(source as never)) {
    errors.push(`parameters.source: one of ${SOURCE_SLUGS.join(', ')}.`);
  }
  if (
    pages !== undefined &&
    (!Number.isInteger(pages) ||
      (pages as number) < 0 ||
      (pages as number) > MAX_BACKFILL_PAGES)
  ) {
    errors.push(
      `parameters.backfill_pages: a whole number from 0 to ${MAX_BACKFILL_PAGES}.`,
    );
  }
  const steps =
    parameters['steps'] === undefined
      ? { values: PIPELINE_STEPS, errors: [] }
      : listOf('steps', parameters['steps'], PIPELINE_STEPS);
  const providers =
    parameters['torrent_providers'] === undefined
      ? undefined
      : listOf(
          'torrent_providers',
          parameters['torrent_providers'],
          TORRENT_PROVIDERS,
        );
  errors.push(...steps.errors, ...(providers?.errors ?? []));
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const checked: PipelineRunParameters = {
    ...(source === undefined
      ? {}
      : { source: source as PipelineRunParameters['source'] }),
    backfill_pages: pages === undefined ? 0 : (pages as number),
    steps: steps.values,
    ...(providers === undefined ? {} : { torrent_providers: providers.values }),
  };
  return {
    ok: true,
    request: { type: 'pipeline_run', parameters: checked },
  };
}

/** Check the parameters of an `omdb_backfill`. */
function omdbBackfill(parameters: Parameters): OperationInput {
  const errors = [...unknownKeys(parameters, ['limit'])];
  const { limit } = parameters;
  if (
    limit !== undefined &&
    (!Number.isInteger(limit) ||
      (limit as number) < MIN_OMDB_LIMIT ||
      (limit as number) > MAX_OMDB_LIMIT)
  ) {
    errors.push(
      `parameters.limit: a whole number from ${MIN_OMDB_LIMIT} to ${MAX_OMDB_LIMIT}.`,
    );
  }
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        request: {
          type: 'omdb_backfill',
          parameters: {
            limit: limit === undefined ? DEFAULT_OMDB_LIMIT : (limit as number),
          },
        },
      };
}

/** Check the body of `POST /api/operations`. */
export function parseOperationInput(
  body: Readonly<Record<string, unknown>>,
): OperationInput {
  const errors = Object.keys(body)
    .filter((key) => key !== 'type' && key !== 'parameters')
    .map((key) => `${key}: not a member of an operation.`);
  const { type, parameters = {} } = body;
  if (!OPERATION_TYPES.includes(type as OperationType)) {
    errors.push(`type: one of ${OPERATION_TYPES.join(', ')}.`);
  }
  if (!isObject(parameters)) {
    errors.push('parameters: must be an object.');
  }
  if (errors.length > 0 || !isObject(parameters)) {
    return { ok: false, errors };
  }
  switch (type as OperationType) {
    case 'pipeline_run':
      return pipelineRun(parameters);
    case 'omdb_backfill':
      return omdbBackfill(parameters);
    case 'push_trigger': {
      const extra = unknownKeys(parameters, []);
      return extra.length > 0
        ? { ok: false, errors: extra }
        : {
            ok: true,
            request: { type: 'push_trigger', parameters: {} },
          };
    }
  }
}
