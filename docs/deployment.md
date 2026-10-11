# Deployment

Production deployment for **iPassGenerator** on Vercel + Supabase.

> This document is the runbook for a human operator. It is not executed by CI.
> The automated `scripts/prelaunch-check.mjs` verifies the repository is ready
> before you start; the steps below are the manual deploy, domain, Search
> Console, and backup actions.

## 0. Pre-flight

```bash
npm ci
npm run verify          # lint + typecheck + unit/integration tests
npm run build
node scripts/prelaunch-check.mjs        # repo readiness
npm run verify:security                 # needs `npm start` running
npm run verify:a11y
npm run verify:regression
npm run verify:performance              # build-only
```

All must pass. Do not deploy on a red gate.

## 1. Environments

Three Supabase projects and three Vercel environments. **Production secrets are
never copied into preview or development.**

| Environment | Branch | Supabase | Vercel env |
|---|---|---|---|
| Local | — | local / dev | `.env.local` (git-ignored) |
| Preview | any non-`main` | dev/preview project | Preview |
| Production | `main` | production project | Production |

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, scoped per
environment. Values come from the Supabase dashboard (Project Settings → API)
and your domain.

### Browser-exposed (`NEXT_PUBLIC_*`) — safe only because RLS is on

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical origin, **no trailing slash** (e.g. `https://ipassgenerator.online`). Drives canonicals, sitemap, JSON-LD, Open Graph. |
| `NEXT_PUBLIC_SITE_NAME` | optional | Defaults to `iPassGenerator`. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable/anon key. Safe in the browser **only** with RLS enabled. |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | ads only | Real `ca-pub-…` ID. Leave blank to keep ads off. |
| `NEXT_PUBLIC_ADSENSE_ENABLED` | ads only | Must be exactly `true` to allow ads. Default `false`. |
| `NEXT_PUBLIC_ADSENSE_SLOT_GUIDES` | ads only | Ad unit slot id for the guides placement. |

### Server-only — never `NEXT_PUBLIC_`, never in the client bundle

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | yes (server actions, migrations via app) | Bypasses RLS. Server Components / Route Handlers / Server Actions only. |
| `SUPABASE_SERVICE_ROLE_KEY_SERVER_ONLY` | optional | Alternate name some Supabase setups expose. |
| `CONTACT_RATE_LIMIT_PER_HOUR` | optional | Defaults to `5`. |
| `NEXT_PUBLIC_ENABLE_VERBOSE_ERRORS` | optional | Keep `false` in production. |

### Migration/ops only (set locally or in CI, not in the app runtime)

| Variable | Notes |
|---|---|
| `POSTGRES_URL_NON_POOLING` (or `POSTGRES_URL` / `DATABASE_URL`) | Used by `scripts/migrate.mjs` to apply SQL migrations. |

`verify-security.mjs` asserts that **no secret-named variable is exposed via
`NEXT_PUBLIC_`** and that no secret reaches the client bundle — run it after the
first production build.

## 3. Vercel

1. Push the repo to GitHub and **Import** it in Vercel. Framework preset
   **Next.js** is detected automatically; build `next build`, output `.next`.

## 5. Supabase Auth URL configuration

In the **production** Supabase project → **Authentication → URL Configuration**:

- **Site URL:** `https://ipassgenerator.online`
- **Redirect URLs:** add
  - `https://ipassgenerator.online/auth/**`
  - `https://<your-preview-subdomain>.vercel.app/auth/**` (preview)
  - `http://localhost:3000/auth/**` (local)

Email confirmations and password-reset links are only valid for URLs in this
list, so a missing entry is the usual cause of “link is invalid” after deploy.

## 6. Apply database migrations

Migrations are checked into `supabase/migrations/` and applied with the repo
runner (idempotent; records applied files in `public.schema_migrations`):

```bash
# against the PRODUCTION database, from a machine with the connection string
POSTGRES_URL_NON_POOLING='postgres://…' node --env-file=.env.local scripts/migrate.mjs
POSTGRES_URL_NON_POOLING='postgres://…' node --env-file=.env.local scripts/migrate.mjs --status
```

- Never edit an applied migration — add a new numbered file.
- Bootstrap the first administrator: `node --env-file=.env.local scripts/set-role.mjs you@example.com admin`
  (only possible while no admin exists; afterwards promotion requires an admin).

## 7. Search Console

1. In [Google Search Console](https://search.google.com/search-console), add the
   **Domain property** `ipassgenerator.online`.
2. Verify via the **DNS TXT** record Google provides (add it at your registrar).
   This verifies all subdomains and both http/https variants.
3. Submit the sitemap: **Sitemaps → Add a new sitemap → `sitemap.xml`**.
   The app serves it at `https://ipassgenerator.online/sitemap.xml` and it is
   uncached, so newly published guides appear immediately.
4. Use **URL Inspection → Request indexing** for the homepage and key guides.
5. Optional: submit the same sitemap to Bing Webmaster Tools.

`robots.txt` already references the sitemap and disallows `/admin`, `/api/`,
`/login`, and `/auth/`.

## 8. Backups & recovery

Supabase managed backups (plan-dependent):

- **Daily automated backups** on all paid plans; **Point-In-Time Recovery (PITR)**
  on Pro for fine-grained restores.
- Enable PITR on the production project before launch if the plan allows.

Restore procedure:

1. **Data restore:** Supabase dashboard → Database → Backups → restore to a new
   project or PITR to a chosen timestamp. Prefer restoring to a *new* project and
   cutting over, so a bad restore never destroys the only good copy.
2. **Schema restore:** the checked-in migrations are the source of truth. To
   rebuild schema from scratch, run `scripts/migrate.mjs` against a fresh
   database, then restore data on top.
3. **Media:** assets live in Supabase Storage; include buckets in any restore.

Practice a restore at least once against a non-production project and record the
measured RTO. A backup that has never been restored is an assumption, not a fact.

## 9. Post-deploy verification

Against the **live production** origin:

```bash
BASE=https://ipassgenerator.online
curl -sI $BASE | grep -i strict-transport   # HSTS present
curl -s  $BASE/robots.txt
curl -s  $BASE/sitemap.xml | head
curl -sI $BASE/guides/does-not-exist        # expect 404 (real, not soft)
curl -s  $BASE/api/ads/config               # expect ready:false until configured
```

- Sign in to `/admin`, confirm the session works and admin responses carry
  `Cache-Control: private, no-store`.
- Run Lighthouse / PageSpeed Insights on the homepage and a tool page; record
  Core Web Vitals. (The `verify:performance` gate only checks bundle size; real
  vitals must be measured on the deployed site.)

## 10. Rollback

- **App:** Vercel → Deployments → promote the previous **Production** deployment
  (instant, no rebuild). Or `git revert` on `main` and push.
- **Database:** there is no automatic down-migration. Forward-fix with a new
  migration. For data, restore from backup/PITR (see §8).
- **Config:** environment variable changes are per-deployment; redeploy to apply.

Keep the last known-good production deployment pinned until the new one is
verified healthy.

2. Add the environment variables above for **Preview** and **Production**
   separately. Production uses the production Supabase project.
3. **Production branch = `main`.** Every push to `main` deploys to production;
   other branches and PRs deploy to preview.
4. Node version: Vercel honors `engines.node` (`>=20.9.0`). Pin a major in
   Project Settings if you want reproducible builds.
5. The security headers (HSTS, `X-Frame-Options`, etc.) are applied in
   `next.config.ts` and therefore on every deployment.

## 4. Domain & DNS

1. Vercel → Project → **Domains** → add the apex (`ipassgenerator.online`) and
   `www`.
2. At your registrar, set the DNS records Vercel shows:
   - Apex: `A` → Vercel's Anycast IP (`76.76.21.21`), or a flattened `CNAME`.
   - `www`: `CNAME` → `cname.vercel-dns.com`.
3. Wait for issuance of the managed TLS certificate (Vercel → Domains shows
   **Valid**). HSTS (`max-age=63072000; includeSubDomains; preload`) is already
   sent; only add the domain to the HSTS preload list once you are certain HTTPS
   must never be downgraded.
4. Set `NEXT_PUBLIC_SITE_URL` to the final apex origin and redeploy so
   canonicals/sitemap/JSON-LD match the live host exactly.
