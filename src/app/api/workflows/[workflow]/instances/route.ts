import { absoluteLocation } from '../../../../../lib/api/location';
import { readJsonObject } from '../../../../../lib/api/json';
import { operatorRefusal } from '../../../../../lib/api/operator-auth';
import { problem, problems } from '../../../../../lib/api/problem';
import { workflowBinding } from '../../../../../lib/api/workflows';
import { getEnv } from '../../../../../lib/util';

export const dynamic = 'force-dynamic';

/**
 * `POST /api/workflows/{workflow}/instances`: start one run of a workflow
 * (`scrape`, `movie` or `notify`) in the background. The optional body is
 * `{ params }`, handed to the workflow (`movie` wants `{ imdbId }`).
 *
 * Answers 201 with `{ id, status }` and a `Location` to follow the run, 404 for
 * a workflow that does not exist, 401 when `CRON_SECRET` is set and the bearer
 * token is wrong, and 502 when the workflow service refuses to start it.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ workflow: string }> },
): Promise<Response> {
  const env = getEnv();
  const refused = operatorRefusal(request, env.CRON_SECRET);
  if (refused) {
    return refused;
  }
  const { workflow } = await ctx.params;
  const binding = workflowBinding(env, workflow);
  if (!binding) {
    return problems.notFound('workflow');
  }
  const body = request.headers.has('content-type')
    ? await readJsonObject(request, 'The body must be a JSON object.')
    : ({ ok: true, value: {} } as const);
  if (!body.ok) {
    return body.response;
  }
  const { params = {} } = body.value;
  try {
    const instance = await binding.create({ params });
    return Response.json(
      { id: instance.id, status: await instance.status() },
      {
        status: 201,
        headers: {
          Location: absoluteLocation(
            request,
            `/api/workflows/${workflow}/instances/${instance.id}`,
          ),
        },
      },
    );
  } catch {
    return problem(
      502,
      '/problems/upstream-failure',
      'Upstream failure',
      'The workflow could not be started.',
    );
  }
}
