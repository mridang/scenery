import { afterEach, describe, expect, it, jest } from '@jest/globals';

import {
  MaintenanceActions,
  startPipelineRun,
} from '../../../src/components/site/maintenance-actions';
import { html } from '../render';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(res: Response | Error) {
  const spy = jest.fn<typeof fetch>(() =>
    res instanceof Error ? Promise.reject(res) : Promise.resolve(res),
  );
  globalThis.fetch = spy;
  return spy;
}

describe('startPipelineRun', () => {
  it('POSTs the request as JSON to /api/pipeline-runs', async () => {
    const spy = stubFetch(Response.json({}));
    expect(await startPipelineRun({ steps: ['enrich'] })).toBeUndefined();
    expect(spy).toHaveBeenCalledWith('/api/pipeline-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"steps":["enrich"]}',
    });
  });

  it("answers the problem's detail when refused", async () => {
    stubFetch(
      Response.json({ detail: 'Send the cron secret.' }, { status: 401 }),
    );
    expect(await startPipelineRun({})).toBe('Send the cron secret.');
  });

  it('falls back to the status when the refusal is not a problem', async () => {
    stubFetch(new Response('boom', { status: 500 }));
    expect(await startPipelineRun({})).toBe('Request failed (500).');
  });

  it('says so when the server cannot be reached', async () => {
    stubFetch(new Error('offline'));
    expect(await startPipelineRun({})).toBe('The server could not be reached.');
  });
});

describe('MaintenanceActions', () => {
  it('offers the three nudges as buttons, not as a form to a route', () => {
    const out = html(<MaintenanceActions />);
    expect(out).toContain('Backfill 10 pages');
    expect(out).toContain('TMDB enrich');
    expect(out).toContain('Scrape page 1');
    expect(out).not.toContain('<form');
    expect(out).not.toContain('/api/cron');
  });
});
