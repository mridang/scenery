/**
 * @packageDocumentation
 *
 * What this app adds to the Worker in `src/worker.ts`, which is the same in
 * every app: handlers besides `fetch` (a cron trigger's `scheduled`), and the
 * Workflow or Durable Object classes the Worker must export by name. Cloudflare's
 * Workflows runtime looks for Workflow classes as named exports on the deployed
 * Worker, so they are re-exported here.
 */

import { ScrapeWorkflow, MovieWorkflow, NotifyWorkflow } from '../workflows';
import { errorMessage, logError, logInfo } from './util';

export { ScrapeWorkflow, MovieWorkflow, NotifyWorkflow };

/**
 * Start one workflow instance. A workflow may transiently fail to start (rate
 * limit, local-dev simulator gaps), so the failure is logged and swallowed:
 * one bad fan-out must not sink the whole scheduled tick.
 */
async function safeCreate(
  label: string,
  workflow: Workflow | undefined,
  params: unknown,
): Promise<void> {
  if (!workflow) {
    return;
  }
  try {
    const instance = await workflow.create({ params });
    logInfo({
      event: 'workflow.created',
      workflow: label,
      instanceId: instance.id,
    });
  } catch (error) {
    logError({
      event: 'workflow.create.failed',
      workflow: label,
      error: errorMessage(error),
    });
  }
}

/**
 * The handlers this app adds to the Worker, besides `fetch`.
 *
 * `scheduled` is the cron-trigger entrypoint. It routes by the firing cron
 * expression:
 *   - 06:00 UTC → ScrapeWorkflow (scrape sources, dispatch MovieWorkflows)
 *   - 17:00 UTC → NotifyWorkflow (push top-5 new movies to subscribers)
 *
 * Anything else logs and does nothing, so a future cron addition isn't a silent
 * crash.
 */
const extraHandlers: Partial<ExportedHandler<CloudflareEnv>> = {
  scheduled(event, env, ctx) {
    switch (event.cron) {
      case '0 6 * * *':
        ctx.waitUntil(
          safeCreate('scrape', env.SCRAPE_WORKFLOW, { pageNumbers: [1] }),
        );
        break;
      case '0 17 * * *':
        ctx.waitUntil(safeCreate('notify', env.NOTIFY_WORKFLOW, {}));
        break;
      default:
        logInfo({ event: 'cron.unknown', cron: event.cron });
    }
  },
};

export default extraHandlers;
