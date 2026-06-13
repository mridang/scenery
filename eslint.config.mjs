import mridang from '@mridang/eslint-defaults';
import drizzle from 'eslint-plugin-drizzle';

export default [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'out/**',
      'next-env.d.ts',
      'worker-configuration.d.ts',
      'migrations/**',
      // JSONC config — comments/trailing commas trip the strict JSON
      // language the eslint-defaults preset registers for it.
      'wrangler.jsonc',
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
    settings: {
      // `cloudflare:workers` is a Workers runtime built-in (like Node's
      // `node:` modules) — an ambient module with no file to resolve to.
      // Whitelist it globally so `import/no-unresolved` stays active for
      // everything else.
      'import/core-modules': ['cloudflare:workers'],
    },
  },
  {
    // Tailwind v4 drives styling through at-rules (@theme, @apply,
    // @custom-variant, …) that the css plugin's at-rule validator doesn't
    // know about. Tailwind owns this syntax, so disable just that check
    // for CSS while keeping the rest of the css ruleset active.
    files: ['**/*.css'],
    rules: {
      'css/no-invalid-at-rules': 'off',
    },
  },
  {
    // Drizzle safety net: a bare .delete()/.update() on the db wipes or
    // rewrites the whole table. Require a .where() on every one. Our
    // drizzle instance is reached as `this.db` in the repositories.
    files: ['src/**/*.ts'],
    plugins: { drizzle },
    rules: {
      'drizzle/enforce-delete-with-where': [
        'error',
        { drizzleObjectName: ['db'] },
      ],
      'drizzle/enforce-update-with-where': [
        'error',
        { drizzleObjectName: ['db'] },
      ],
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
];
