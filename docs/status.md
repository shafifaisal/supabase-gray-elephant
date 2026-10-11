# Phase Status

## Phase 1 — Inspect & document ✅ COMPLETE
Greenfield repo confirmed; Node v24.16.0 / npm 11.13.0 / git 2.50.1 verified.
Created `AGENTS.md`, `.gitignore`, `.env.example`, and architecture / route-map /
database-schema / testing-plan docs.

## Phase 2 — Next.js app + layout + nav ✅ COMPLETE

**Completed**
- Scaffolded Next.js 16.4.0 (App Router, TypeScript, Turbopack, React 19.3.0).
- Tailwind CSS v4 with a light/dark OKLCH design-token theme.
- Shared layout: skip-link, sticky header, responsive nav (desktop + accessible
  mobile disclosure), three-column footer.
- Landing page `/` and tools index `/tools` built from a single tool registry.
- `robots.txt` (blocks `/admin`, `/api`, `/login`, `/auth`), branded 404 page.
- Base metadata: title template, canonical, description, robots directives.
- Added `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `vitest`, `jsdom`,
  `@playwright/test` (installed for later phases; not yet wired).
- Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `verify`.

**Files created**
`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
`vitest.config.mts`, `.gitignore`, `src/lib/site.ts`, `src/lib/tools.ts`,
`src/lib/tools.test.ts`, `src/components/layout/{header,footer,nav-links}.tsx`,
`src/components/ui/primitives.tsx`,
`src/app/{layout.tsx,page.tsx,globals.css,not-found.tsx,robots.ts}`,
`src/app/tools/page.tsx`, `docs/setup.md`, `docs/status.md`

**Migrations:** none (Phase 3)

**Verification (all run, all passing)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors |
| `npm run typecheck` | pass |
| `npm test` | 4/4 pass |
| `npm run build` | pass, 6 routes prerendered |
| Runtime smoke test | `/` → 200, `/robots.txt` → correct, unknown → 404 |
| HTML checks | title, canonical, description, skip link, single `<h1>` present |

**Security findings**
- Dev-only advisory chain (`eslint-config-next` → `fast-glob` → `micromatch` →
  `braces`, build-time DoS). Not shipped to production. The suggested
  `npm audit fix --force` would downgrade `eslint-config-next` to v14 and was
  deliberately **not** applied. Re-evaluate when Next patches the chain.
- Rendered HTML contains no service-role material.

**Fixed during phase**
- Next 16 `cacheComponents` rejected `new Date()` at prerender time; the footer
  year now resolves through a `"use cache"` build-time function.
- React lint rule `set-state-in-effect` replaced with a render-time state reset.
- `environmentMatchGlobs` removed in Vitest 5; config renamed to `.mts`.

**Remaining work / risks**
- Supabase credentials not yet provided (Phase 3 blocker).
- Vercel project not yet connected; preview deployment pending.
- Playwright installed but no e2e suite yet (Phase 8).
- Brand/domain still provisional pending availability + trademark check.

---

## Phase 3 — Supabase, migrations, RLS, auth ⬜ NEXT