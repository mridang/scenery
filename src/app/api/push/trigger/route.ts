import { getEnv } from '../../../../lib/util';

export const dynamic = 'force-dynamic';

/**
 * Fire the daily NotifyWorkflow on demand — same code path as the
 * 17:00 UTC cron, just kicked off from the UI button. Returns the
 * workflow-instance id so the caller can follow up via `wrangler
 * workflows instances describe`.
 *
 * The endpoint is unauthenticated because this is a single-user
 * personal tracker; worst-case spam is a few extra notifications to
 * the operator themselves.
 */
export async function POST() {
  const env = getEnv();
  try {
    const instance = await env.NOTIFY_WORKFLOW.create({ params: {} });
    return Response.json({
      ok: true,
      instanceId: instance.id,
      status: await instance.status(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
