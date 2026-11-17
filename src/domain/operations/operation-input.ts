/**
 * @packageDocumentation
 *
 * Checking the body of `POST /api/operations`: a `type` from the closed list
 * and the `parameters` that type takes. Anything not listed is refused, so a
 * typo is an error and not a silent default.
 */

import { z } from 'zod';

import { OPERATION_TYPES } from '@/domain/db/enums';
import { SOURCE_SLUGS } from '@/lib/sources/types';
import { TORRENT_PROVIDERS } from '@/lib/torrents/types';
import { isObject } from '@/lib/core/api';
import {
  DEFAULT_OMDB_LIMIT,
  MAX_BACKFILL_PAGES,
  MAX_OMDB_LIMIT,
  MIN_OMDB_LIMIT,
  PIPELINE_STEPS,
} from './types';
import type { OperationRequest, PipelineRunParameters } from './types';

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

/** A whole number from `min` to `max`, or `undefined` for anything else. */
function wholeNumberIn(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  return z.number().int().min(min).max(max).safeParse(value).data;
}

/** The values of a list parameter that must each be one of `allowed`, or errors. */
function listOf<T extends string>(
  name: string,
  value: unknown,
  allowed: readonly T[],
): { readonly values: readonly T[]; readonly errors: readonly string[] } {
  const items: readonly unknown[] = Array.isArray(value) ? value : [];
  const member = z.enum(allowed);
  const values = items.flatMap((item) => {
    const parsed = member.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  const bad =
    !Array.isArray(value) ||
    value.length === 0 ||
    values.length !== items.length ||
    new Set(items).size !== items.length;
  return bad
    ? {
        values: [],
        errors: [
          `parameters.${name}: a non-repeating list of ${allowed.join(', ')}.`,
        ],
      }
    : { values, errors: [] };
}

/** Check the parameters of a `pipeline_run`. */
function pipelineRun(parameters: Parameters): OperationInput {
  const { source, backfill_pages: pages } = parameters;
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
  const knownSource = z.enum(SOURCE_SLUGS).safeParse(source).data;
  const unknownSource = source !== undefined && knownSource === undefined;
  const checkedPages = wholeNumberIn(pages, 0, MAX_BACKFILL_PAGES);
  const badPages = pages !== undefined && checkedPages === undefined;
  const errors = [
    ...unknownKeys(parameters, [
      'source',
      'backfill_pages',
      'steps',
      'torrent_providers',
    ]),
    ...(unknownSource
      ? [`parameters.source: one of ${SOURCE_SLUGS.join(', ')}.`]
      : []),
    ...(badPages
      ? [
          `parameters.backfill_pages: a whole number from 0 to ${MAX_BACKFILL_PAGES}.`,
        ]
      : []),
    ...steps.errors,
    ...(providers?.errors ?? []),
  ];
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const checked: PipelineRunParameters = {
    ...(knownSource === undefined ? {} : { source: knownSource }),
    backfill_pages: checkedPages ?? 0,
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
  const { limit } = parameters;
  const checkedLimit = wholeNumberIn(limit, MIN_OMDB_LIMIT, MAX_OMDB_LIMIT);
  const badLimit = limit !== undefined && checkedLimit === undefined;
  const errors = [
    ...unknownKeys(parameters, ['limit']),
    ...(badLimit
      ? [
          `parameters.limit: a whole number from ${MIN_OMDB_LIMIT} to ${MAX_OMDB_LIMIT}.`,
        ]
      : []),
  ];
  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        request: {
          type: 'omdb_backfill',
          parameters: {
            limit: checkedLimit ?? DEFAULT_OMDB_LIMIT,
          },
        },
      };
}

/** Check the body of `POST /api/operations`. */
export function parseOperationInput(
  body: Readonly<Record<string, unknown>>,
): OperationInput {
  const { type, parameters = {} } = body;
  const operationType = z.enum(OPERATION_TYPES).safeParse(type);
  const errors = [
    ...Object.keys(body)
      .filter((key) => key !== 'type' && key !== 'parameters')
      .map((key) => `${key}: not a member of an operation.`),
    ...(operationType.success
      ? []
      : [`type: one of ${OPERATION_TYPES.join(', ')}.`]),
    ...(isObject(parameters) ? [] : ['parameters: must be an object.']),
  ];
  if (errors.length > 0 || !isObject(parameters) || !operationType.success) {
    return { ok: false, errors };
  }
  switch (operationType.data) {
    case 'pipeline_run': {
      return pipelineRun(parameters);
    }
    case 'omdb_backfill': {
      return omdbBackfill(parameters);
    }
    default: {
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
