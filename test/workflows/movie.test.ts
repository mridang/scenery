import { describe, expect, it, jest } from '@jest/globals';

const attributes: Record<string, unknown> = {};

// eslint-disable-next-line tslop/no-module-mocking -- the code under test imports this module directly, so only mocking the module can stand in for it
jest.unstable_mockModule(
  'cloudflare:workers',
  () => ({
    WorkflowEntrypoint: class {
      env: unknown;
      constructor(_ctx: unknown, env: unknown) {
        this.env = env;
      }
    },
    tracing: {
      getActiveSpan: () => ({
        setAttribute: (key: string, value: unknown) => {
          attributes[key] = value;
        },
      }),
    },
  }),
  { virtual: true },
);

const { MovieWorkflow } = await import('@/workflows/movie');

describe('MovieWorkflow error context', () => {
  it('names the job and the instance before any work', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the MovieWorkflow constructor takes the Worker's ExecutionContext and env, which this test never reads, so empty objects stand in
    const workflow = new MovieWorkflow({} as never, {} as never);
    const failing = {
      do: async () => {
        throw new Error('stop here');
      },
    };
    await Promise.resolve(
      workflow.run(
        {
          payload: { imdbId: 'tt1' },
          timestamp: new Date(),
          instanceId: 'run-7',
          workflowName: 'movie',
        },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the step is a stand-in with a single `do` that always throws; the workflow is only run until its first step
        failing as never,
      ),
    ).catch(() => undefined);
    expect(attributes).toEqual({
      'job.name': 'movie',
      'workflow.instance_id': 'run-7',
    });
  });
});
