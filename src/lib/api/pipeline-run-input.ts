/**
 * @packageDocumentation
 *
 * The body of `POST /api/pipeline-runs`, checked: which source to scrape, how
 * many listing pages to go back, which steps to run and which torrent providers
 * to ask. Every member is optional; an unknown member is an error so a typo
 * does not silently run the default job.
 */

import { isObject } from './json';

/** The steps a run is made of, in the order they run. */
export const PIPELINE_STEPS = ['scrape', 'enrich', 'torrents'] as const;
export type PipelineStep = (typeof PIPELINE_STEPS)[number];

/** The torrent providers a run may be limited to. */
export const TORRENT_PROVIDER_NAMES = ['torrentio', 'apibay'] as const;
export type TorrentProviderName = (typeof TORRENT_PROVIDER_NAMES)[number];

/** A validated pipeline run request. */
export interface PipelineRunInput {
  readonly source?: string;
  readonly backfillPages: number;
  readonly steps: ReadonlySet<PipelineStep>;
  readonly torrentProviders?: readonly TorrentProviderName[];
}

export type PipelineRunParse =
  | { readonly ok: true; readonly input: PipelineRunInput }
  | { readonly ok: false; readonly errors: readonly string[] };

const KNOWN_KEYS = new Set([
  'source',
  'backfillPages',
  'steps',
  'torrentProviders',
]);

function namesFrom<T extends string>(
  value: unknown,
  allowed: readonly T[],
  key: string,
  errors: string[],
): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const list = Array.isArray(value) ? (value as unknown[]) : undefined;
  const picked = list?.filter((v): v is T => allowed.includes(v as T));
  if (!list || !picked || picked.length !== list.length) {
    errors.push(`${key}: each item must be one of ${allowed.join(', ')}.`);
    return undefined;
  }
  return picked;
}

/** Check a decoded JSON body. */
export function parsePipelineRunInput(body: unknown): PipelineRunParse {
  if (!isObject(body)) {
    return { ok: false, errors: ['The body must be a JSON object.'] };
  }
  const errors: string[] = [];
  for (const key of Object.keys(body)) {
    if (!KNOWN_KEYS.has(key)) {
      errors.push(`${key}: unknown member.`);
    }
  }
  const {
    source,
    backfillPages = 0,
    steps: rawSteps,
    torrentProviders: rawProviders,
  } = body;
  if (source !== undefined && (typeof source !== 'string' || !source)) {
    errors.push('source: must be a non-empty string.');
  }
  if (
    typeof backfillPages !== 'number' ||
    !Number.isInteger(backfillPages) ||
    backfillPages < 0
  ) {
    errors.push('backfillPages: must be a whole number, 0 or more.');
  }
  const steps = namesFrom(rawSteps, PIPELINE_STEPS, 'steps', errors);
  const torrentProviders = namesFrom(
    rawProviders,
    TORRENT_PROVIDER_NAMES,
    'torrentProviders',
    errors,
  );
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    input: {
      ...(typeof source === 'string' ? { source } : {}),
      backfillPages: backfillPages as number,
      steps: new Set(steps ?? PIPELINE_STEPS),
      ...(torrentProviders ? { torrentProviders } : {}),
    },
  };
}
