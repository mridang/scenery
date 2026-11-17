<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Tailwind

Tailwind 4 no longer gives `<button>` the pointer cursor, so the base layer of the app's stylesheet carries one rule that does (buttons, `summary`, `select`, `[role='button']` and button-like inputs, never disabled ones). Keep it, and keep it identical across the apps. Do not add `cursor-pointer` to individual buttons to work around its absence, and do not restyle a link or a button to fake the other: use `<a>` or `<Link>` when the click goes to a URL, and `<button>` when it acts on the current page.

## Shared files

Shared files are byte-identical with plumbline, chowdown, broadsheet, scenery and marshall wherever the app has them. A change to one goes to all, in the same week; the per-app files are listed in plumbline's `AGENTS.md`. A lint fix in a shared file is made once and copied, never per repository.

These are the shared files that scenery has: `src/lib/core` except `http/site.ts`, `http/extras.ts`, `http/headers.ts` and `worker-extras.ts`; `src/lib/http`; `src/lib/push`; `src/lib/safe-fetch.ts`; `src/lib/cloudflare/images/{index,proxy,service}.ts`; `src/utils` except `site.ts`; `src/components/api`; `src/components/ui/{button,cn,layout,popover}.tsx`; `src/components/site/{ios-install,skip-link,use-install-prompt,bare-page}`; the shell files of `src/app` (`_metadata.ts`, `_security-txt.ts`, `manifest.ts`, `robots.ts`, `sitemap.ts`, `error.tsx`, `global-error.tsx`, `layout.tsx`, `not-found.tsx`, `.well-known/security.txt`, `csp/reports`, `health`); and their mirrors under `test/`. The test fixtures, the D1 test doubles under `test/lib/core/db` and the tests that read them stay per app until they are unified.
