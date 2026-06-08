module.exports = {
  entry: [
    'src/app/**/{page,layout,route}.{ts,tsx}',
    'cypress/**/*.cy.{js,ts}',
    'src/**/*.test.ts',
    'test/**/*.test.ts',
  ],
  project: ['src/**/*.{ts,tsx}', 'test/**/*.ts'],
  ignoreDependencies: [
    // `cloudflare:workers` is a Workers runtime virtual module, not a
    // package; knip reads the prefix as a `cloudflare` dependency.
    'cloudflare',
    // Implicitly used: next lint config, Tailwind via PostCSS/globals.css.
    'eslint-config-next',
    'tailwindcss',
    'postcss',
  ],
  // This is an application, not a published library, so the barrel
  // re-exports under lib/*/index.ts are an internal API surface, not
  // dead code — silence the unused-exports/types reporters and keep the
  // checks that matter (unused files, missing/unused dependencies).
  rules: {
    exports: 'off',
    types: 'off',
    nsExports: 'off',
    nsTypes: 'off',
    enumMembers: 'off',
  },
};
