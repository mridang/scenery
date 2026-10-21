import { describe, expect, it } from '@jest/globals';

import { workflowBinding } from '../../../src/lib/api/workflows';

const env = {
  SCRAPE_WORKFLOW: { name: 'scrape' },
  MOVIE_WORKFLOW: { name: 'movie' },
  NOTIFY_WORKFLOW: { name: 'notify' },
} as unknown as Parameters<typeof workflowBinding>[0];

describe('workflowBinding', () => {
  it.each(['scrape', 'movie', 'notify'])('finds the %s workflow', (name) => {
    expect(workflowBinding(env, name)).toEqual({ name });
  });

  it.each(['cron', 'constructor', '__proto__', ''])(
    'has no workflow called %j',
    (name) => {
      expect(workflowBinding(env, name)).toBeUndefined();
    },
  );
});
