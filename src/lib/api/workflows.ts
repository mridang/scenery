/**
 * @packageDocumentation
 *
 * The workflows that `/api/workflows/{workflow}/instances` can start, by the
 * name used in the path.
 */

/** The workflow names that exist. */
const WORKFLOW_BINDINGS = {
  scrape: 'SCRAPE_WORKFLOW',
  movie: 'MOVIE_WORKFLOW',
  notify: 'NOTIFY_WORKFLOW',
} as const;

/** The binding for `name`, or undefined when there is no such workflow. */
export function workflowBinding(
  env: Pick<
    CloudflareEnv,
    (typeof WORKFLOW_BINDINGS)[keyof typeof WORKFLOW_BINDINGS]
  >,
  name: string,
): Workflow | undefined {
  return Object.hasOwn(WORKFLOW_BINDINGS, name)
    ? env[WORKFLOW_BINDINGS[name as keyof typeof WORKFLOW_BINDINGS]]
    : undefined;
}
