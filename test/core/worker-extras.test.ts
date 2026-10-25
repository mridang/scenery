import { afterEach, describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('@/lib/cloudflare/workflows', () => ({
  ScrapeWorkflow: class ScrapeWorkflow {},
  MovieWorkflow: class MovieWorkflow {},
  NotifyWorkflow: class NotifyWorkflow {},
}));

const { default: extraHandlers } = await import('@/core/worker-extras');

/** A workflow binding that records the parameters of each instance it is asked to start. */
function binding(fails = false) {
  const created: unknown[] = [];
  return {
    created,
    create: async ({ params }: { params: unknown }) => {
      if (fails) {
        throw new Error('simulator gap');
      }
      created.push(params);
      return { id: 'instance-1' };
    },
  };
}

/** Fire the cron `cron` at the Worker and wait for the work it hands to `waitUntil`. */
async function fire(cron: string, env: Record<string, unknown>) {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise);
    },
  };
  Reflect.apply(extraHandlers.scheduled as never, undefined, [
    { cron },
    env,
    ctx,
  ]);
  await Promise.all(pending);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('scheduled', () => {
  it('starts a scrape at 06:00 UTC', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const scrape = binding();
    const notify = binding();
    await fire('0 6 * * *', {
      SCRAPE_WORKFLOW: scrape,
      NOTIFY_WORKFLOW: notify,
    });
    expect(scrape.created).toEqual([{ pageNumbers: [1] }]);
    expect(notify.created).toEqual([]);
  });

  it('starts the notifications at 17:00 UTC', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const scrape = binding();
    const notify = binding();
    await fire('0 17 * * *', {
      SCRAPE_WORKFLOW: scrape,
      NOTIFY_WORKFLOW: notify,
    });
    expect(notify.created).toEqual([{}]);
    expect(scrape.created).toEqual([]);
  });

  it('logs and carries on when a workflow cannot be started', async () => {
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await fire('0 6 * * *', { SCRAPE_WORKFLOW: binding(true) });
    expect(String(error.mock.calls[0]?.[0])).toContain(
      'workflow.create.failed',
    );
  });

  it('does nothing when the workflow is not bound', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await fire('0 6 * * *', {});
    expect(log).not.toHaveBeenCalled();
  });

  it('logs a cron it does not know and starts nothing', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const scrape = binding();
    await fire('5 5 * * *', { SCRAPE_WORKFLOW: scrape });
    expect(String(log.mock.calls[0]?.[0])).toContain('cron.unknown');
    expect(scrape.created).toEqual([]);
  });
});
