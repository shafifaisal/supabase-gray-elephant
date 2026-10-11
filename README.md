# iPassGenerator

Privacy-first password-security tools with a custom CMS admin panel.

**Stack:** Next.js (App Router) + TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Storage) · Vercel · Vitest + Playwright

## Principles

1. **Secrets stay on your device.** Every generator runs entirely in the browser
   using the Web Crypto API. Nothing is generated, stored or transmitted server-side.
2. **Authorization lives in the database.** Row Level Security is the source of truth;
   the UI is never the gatekeeper.
3. **Honest privacy text.** Policies describe what actually happens.

## Tools

- Password Generator
- Passphrase Generator
- Password Strength Checker (local-only)
- Password Entropy Calculator
- Random String Generator

## Local development

```bash
git clone <repo> && cd ipassgenerator
npm install
cp .env.example .env.local     # then fill in Supabase values
npm run dev
```

Full instructions: [`docs/setup.md`](docs/setup.md)

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | tsc --noEmit |
| `npm test` | unit + integration |
| `npm run test:e2e` | Playwright |
| `npm run verify` | lint + typecheck + unit/integration |
| `npm run verify:security` | headers, no-store, client-bundle secret scan |
| `npm run verify:a11y` | WCAG 2.1 A/AA on public routes |
| `npm run verify:regression` | links, privacy invariant, consent, tools |
| `npm run verify:performance` | gzip bundle budget |
| `npm run prelaunch` | pre-deploy repo readiness gate |

## Docs

| Document | Contents |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Mandatory project rules |
| [`docs/architecture.md`](docs/architecture.md) | Layers, boundaries, rendering strategy |
| [`docs/route-map.md`](docs/route-map.md) | Routes, roles, status codes |
| [`docs/database-schema.md`](docs/database-schema.md) | Tables, RLS, migrations |
| [`docs/testing-plan.md`](docs/testing-plan.md) | Test coverage map |
| `docs/setup.md` | Local setup (Phase 2) |
| `docs/deployment.md` | Vercel + Supabase deploy, domain, Search Console, backups, rollback (Phase 9) |
| `docs/security-checklist.md` | Security posture + launch sign-off (Phase 9) |
| `docs/adsense-readiness.md` | AdSense status, consent gate, enablement runbook (Phase 9) |

## Status

Phases 1–9 complete. Ads are **off and fail-closed** pending a real approved
AdSense account; the launch runbook is in `docs/deployment.md`. See
`docs/status.md` for live progress.

---

Brand note: the working name and domain are configuration (admin site settings +
`NEXT_PUBLIC_SITE_URL`), not hard-coded, so a rebrand is a settings change.
Verify domain availability and trademark clearance before launch.