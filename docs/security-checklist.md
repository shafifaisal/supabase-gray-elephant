# Security Checklist

The enforced security posture of iPassGenerator, and what an operator must verify
before and after launch. Items marked **[automated]** are covered by a script in
`scripts/`.

## Threat model in one line

Generated secrets never leave the browser; authorization lives in PostgreSQL RLS;
the UI is never the gatekeeper.

## Secrets & keys

- **[automated]** No `.env*` (except `.env.example`), `*.pem`, `*.key`, or
  `id_rsa` is committed — `prelaunch-check.mjs`.
- **[automated]** No service-role key material appears in committed source —
  `prelaunch-check.mjs` (scans for a `"role":"service_role"` claim).
- **[automated]** No secret-named variable is exposed via `NEXT_PUBLIC_` —
  `verify-security.mjs` (env audit) and `prelaunch-check.mjs`.
- **[automated]** No secret reaches the client bundle — `verify-security.mjs`
  scans `.next/static` for the real service-role key and high-confidence
  patterns.
- The service-role client (`src/lib/supabase/admin.ts`) is `server-only` and is
  only imported by trusted server code. A lint/architecture guard keeps it out
  of client modules.
- Rotate the service-role key immediately if it is ever exposed; it bypasses RLS.

## Database authorization

- Row Level Security is enabled on every table; least-privilege grants are
  applied (`0006_harden_grants.sql`).
- The publish invariant (`assert_publish_requires_editor`) makes author
  self-publishing impossible; privilege and authorship guards run as triggers.
- Role is never taken from client input; it is read from `public.profiles`
  server-side.
- **[manual]** `scripts/verify-rls.mjs` (structure/grants/policies) and
  `scripts/verify-auth.mjs` (39 live role/RLS assertions) must pass against the
  production project before launch. Run against a test project, never blindly on
  production.

## Transport & headers

- **[automated]** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
  `Permissions-Policy` (camera/microphone/geolocation/interest-cohort disabled),
  and HSTS — `verify-security.mjs`.
- HTTPS is enforced by Vercel’s managed certificate; HSTS is sent from the first
  response.

## Sessions & caching

- Supabase SSR cookie sessions; auth cookies are `HttpOnly` and `Secure` in
  production.
- **[automated]** `/admin/*` responses carry `Cache-Control: private, no-store`
  and redirect anonymous visitors — `verify-security.mjs`.

## Input handling & XSS

- All untrusted input is validated with Zod (articles, categories, settings,
  auth, contact).
- Admin-authored Markdown/HTML is sanitised on write **and** again on render
  (`sanitizeForRender`), so a row inserted by any path cannot execute script.
- **[automated]** Stored-XSS is exercised in `verify-content.mjs` (injected
  `<script>`/`onerror` never reaches the served page).

## Privacy invariants (AGENTS.md §1)

- Generation is client-side only; nothing is sent, stored, logged, or placed in
  a URL. **[automated]** `verify-regression.mjs` proves no external request and
  empty storage while generating.
- The strength checker is local-only; no API calls, no logging.
- There is intentionally **no** table for generated or checked passwords.
- **[automated]** No third-party analytics/ads script is present in served HTML
  while ads are off — `verify-content.mjs`.

## Consent & ads

- **[automated]** Advertising is fail-closed by default — `prelaunch-check.mjs`.
- No non-essential script loads before consent; the AdSense loader is injected
  only after the visitor accepts optional cookies — `ad-slot.tsx`.
- See `docs/adsense-readiness.md` for the EEA/UK/CH CMP requirement.

## Known limitations (recorded, not hidden)

- **Contact-form rate limiting is in-memory.** It is unreliable across Vercel
  serverless instances. Add a distributed limiter (Upstash Redis or a Postgres
  counter) before high-traffic launch.
- **No CSP yet.** If a strict Content-Security-Policy is added, it must allow
  `pagead2.googlesyndication.com` when ads are enabled, and Supabase/API hosts
  otherwise.
- Admin pages are not axe-scanned in CI (they sit behind auth); verify them
  manually behind a session.

## Launch sign-off

- [ ] `npm run verify` green
- [ ] `prelaunch-check`, `verify:security`, `verify:a11y`, `verify:regression`,
      `verify:performance` green
- [ ] `verify-rls` + `verify-auth` green against the production project
- [ ] Backups enabled (and a restore rehearsed)
- [ ] Service-role key present only in server env; never in the browser bundle
- [ ] `/admin` requires auth and is `no-store` in the live deployment
