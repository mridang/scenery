export default {
  entry: ['open-next.config.ts'],
  ignore: ['public/**'],
  // Knip reads the `cloudflare:workers` import of the Workflows as a package
  // called `cloudflare`.
  ignoreDependencies: ['cloudflare'],
  tags: ['+public'],
};
