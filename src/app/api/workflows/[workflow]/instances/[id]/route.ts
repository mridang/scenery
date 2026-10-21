import { operatorRefusal } from '../../../../../../lib/api/operator-auth';
import { problem, problems } from '../../../../../../lib/api/problem';
import { workflowBinding } from '../../../../../../lib/api/workflows';
import { getEnv } from '../../../../../../lib/util';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/workflows/{workflow}/instances/{id}`: where a started run has got
 * to. Answers 200 `{ id, status }`, 404 for an unknown workflow or run, or 401
 * when `CRON_SECRET` is set and the bearer token is wrong.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ workflow: string; id: string }> },
): Promise<Response> {
  const env = getEnv();
  const refused = operatorRefusal(request, env.CRON_SECRET);
  if (refused) {
    return refused;
  }
  const { workflow, id } = await ctx.params;
  const binding = workflowBinding(env, workflow);
  if (!binding) {
    return problems.notFound('workflow');
  }
  let instance;
  try {
    instance = await binding.get(id);
  } catch {
    return problems.notFound('workflow instance');
  }
  try {
    return Response.json(
      { id: instance.id, status: await instance.status() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return problem(
      502,
      '/problems/upstream-failure',
      'Upstream failure',
      'The workflow status is unavailable.',
    );
  }
}
