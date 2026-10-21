'use client';

import { useState, type ReactElement } from 'react';

/** What a button asks the pipeline to do: the body of `POST /api/pipeline-runs`. */
interface PipelineRunRequest {
  readonly backfillPages?: number;
  readonly steps?: readonly ('scrape' | 'enrich' | 'torrents')[];
}

/** The sentence to show for a failed response: the problem's `detail`, else its status. */
async function failureMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') {
      return body.detail;
    }
  } catch {
    // Not a problem document: the status below is all there is to say.
  }
  return `Request failed (${res.status}).`;
}

/**
 * Start a pipeline run and wait for it. Resolves to `undefined` when it ran, or
 * to the message to show when it was refused or could not be reached.
 */
export async function startPipelineRun(
  request: PipelineRunRequest,
): Promise<string | undefined> {
  try {
    const res = await fetch('/api/pipeline-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return res.ok ? undefined : await failureMessage(res);
  } catch {
    return 'The server could not be reached.';
  }
}

const ITEM_CLASS =
  'rounded-md px-3 py-2 text-left text-[12.5px] font-medium text-[#d4d4d8] hover:bg-white/5';

/**
 * The scrape / enrich / backfill nudges in the header's menu. Each button runs
 * the pipeline once, then reloads so the page shows what it found; a refusal is
 * shown in place of the reload.
 */
export function MaintenanceActions({
  children,
}: {
  readonly children?: React.ReactNode;
}): ReactElement {
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run(request: PipelineRunRequest): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    const failure = await startPipelineRun(request);
    setBusy(false);
    if (failure) {
      setMessage(failure);
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="absolute top-[calc(100%+8px)] right-0 z-40 flex w-[180px] flex-col gap-1 rounded-xl border border-white/10 bg-[#26262d] p-2 shadow-2xl">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({ backfillPages: 10 })}
        className={ITEM_CLASS}
      >
        Backfill 10 pages
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({ steps: ['enrich'] })}
        className={ITEM_CLASS}
      >
        TMDB enrich
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({})}
        className={ITEM_CLASS}
      >
        Scrape page 1
      </button>
      {children}
      {message ? (
        <p role="alert" className="px-3 py-1 text-[12px] text-[#f87171]">
          {message}
        </p>
      ) : null}
    </div>
  );
}
