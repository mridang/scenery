import { describe, expect, it, jest } from '@jest/globals';

const attributes: Record<string, unknown> = {};

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
    const workflow = new MovieWorkflow({} as never, {} as never);
    const failing = {
      do: async () => {
        throw new Error('stop here');
      },
    };
    await Promise.resolve(
      workflow.run(
        { payload: { imdbId: 'tt1' }, instanceId: 'run-7' } as never,
        failing as never,
      ),
    ).catch(() => undefined);
    expect(attributes).toEqual({
      'job.name': 'movie',
      'workflow.instance_id': 'run-7',
    });
  });
});
