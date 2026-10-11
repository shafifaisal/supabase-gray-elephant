# Project Status

## Phase 1 — Inspect & document ✅ COMPLETE
Greenfield repo; environment verified. `AGENTS.md` + architecture, route-map,
schema and testing docs created.

## Phase 2 — Next.js app + layout + nav ✅ COMPLETE
Next.js 16.4.0 App Router + Tailwind v4. Shared layout, responsive nav,
landing page, tools index, robots.txt, 404. Lint/typecheck/tests/build all green.

## Phase 3 — Supabase, migrations, RLS, auth ✅ COMPLETE

**Completed**
- 10 checked-in SQL migrations applied to the live Supabase project.
- 11 tables with UUID keys, FKs, indexes, constraints, `updated_at` triggers.
- RLS enabled on every table; explicit policies per role.
- Least-privilege grants (Supabase's permissive default ACL revoked).
- Profile auto-provisioning on signup, defaulting every user to `author`.
- Guard triggers preventing role escalation, authorship reassignment and
  author-led publishing.
- Storage buckets (`media` public, `media-private`) with object-level policies.
- Supabase clients: browser, server (SSR cookies), and `server-only` service-role.
- `proxy.ts` (Next 16 replacement for `middleware.ts`) refreshing sessions and
  gating `/admin`.
- Sign-in, sign-out, password reset, password update, OAuth callback,
  forgot-password, 403 page.
- Role helpers (`requireRole`, `assertRole`, `roleAtLeast`) resolving roles from
  the database, never from the client.
- Verification tooling: `verify-rls.mjs`, `verify-auth.mjs`, `smoke-http.mjs`,
  `migrate.mjs`, `set-role.mjs`, `create-test-admin.mjs`, `cleanup-test-users.mjs`.
- Admin dashboard shell with role-aware sections.

**Migrations created**
`0001_extensions_and_enums` · `0002_core_tables` · `0003_rls_and_policies` ·
`0004_profile_provisioning` · `0005_storage` · `0006_harden_grants` ·
`0007_bootstrap_admin` · `0008_fix_privilege_guard_for_service_role` ·
`0009_deterministic_privilege_guard` · `0010_fix_author_self_publish`

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass (0 errors, 0 warnings) |
| `npm run typecheck` | pass |
| `npm test` | 28/28 pass |
| `npm run build` | pass |
| `scripts/verify-rls.mjs` | **56/56 pass** |
| `scripts/verify-auth.mjs` | **39/39 pass** (real users, real JWTs, live RLS) |
| `scripts/smoke-http.mjs` | **16/16 pass** (incl. real sign-in + admin render) |

**Security findings — two real issues found and fixed**

1. **Over-broad grants (high).** Supabase's default ACL on the `public` schema
   grants `ALL` to `anon` and `authenticated` for every new table. Migration
   0003 only added grants. RLS still blocked access, so this was not directly
   exploitable, but it left `TRUNCATE` and friends reachable and removed
   defence-in-depth. Fixed in `0006_harden_grants.sql`.

2. **Author self-publish (high).** `articles_update_authorized` used the
   `SECURITY DEFINER` helper `can_edit_article()` in its `WITH CHECK`. Postgres
   evaluates that helper's inner `SELECT` under the pre-update snapshot, so it
   observed the old `draft` status and permitted an author to set
   `status = 'published'` — bypassing editorial review entirely. Confirmed live,
   then fixed in `0010_fix_author_self_publish.sql` using direct column
   references plus two guard triggers.

Also fixed: open-redirect hole in the login `next` parameter (caught by a test),
and missing `no-store` on the admin redirect response.

**Known limitations**
- Playwright is installed but no e2e suite exists yet (Phase 8).
- Service-role and database credentials were supplied in chat and **must be
  rotated** before production.
- Admin sections beyond the dashboard are placeholders (Phase 5).

---

## Phase 4 — The five security utilities ⬜ NEXT