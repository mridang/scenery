import mridang from '@mridang/eslint-defaults';

export default [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'out/**',
      'build/**',
      'dist/**',
      'node_modules/**',
      'next-env.d.ts',
      'migrations/**',
      'public/**',
      // src/worker.ts is the wrangler entry. It imports from
      // `.open-next/worker.js` (generated post-build) and is excluded
      // from tsconfig — type-aware lint can't parse it.
      'src/worker.ts',
    ],
  },
  ...mridang.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // TypeScript checks unresolved identifiers better than eslint's
    // core no-undef, and the latter doesn't see Cloudflare Workers
    // ambient globals (D1Database, Fetcher, CloudflareEnv).
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    rules: {
      'no-undef': 'off',
      // The next/* plugin shipped via mridang's config doesn't load
      // here. Disable the unresolved rule definition rather than wire
      // the plugin since the underlying check is already covered by
      // next-config-typescript's compiler-level rules.
      '@next/next/no-img-element': 'off',
    },
  },
  {
    // `cloudflare:workers` is a virtual module the Workers runtime
    // resolves at deploy time. eslint-plugin-import has no concept of it.
    files: ['src/workflows/**/*.ts', 'src/worker.ts'],
    rules: {
      'import/no-unresolved': ['error', { ignore: ['^cloudflare:'] }],
    },
  },
];
