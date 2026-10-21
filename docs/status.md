# Project Status

## Phase 1 — Inspect & document ✅ COMPLETE
Greenfield repo; environment verified. `AGENTS.md` + architecture, route-map,
schema and testing docs created.

## Phase 2 — Next.js app + layout + nav ✅ COMPLETE
Next.js 16.4.0 App Router + Tailwind v4. Shared layout, responsive nav,
landing page, tools index, robots.txt, 404. Lint/typecheck/tests/build green.

## Phase 3 — Supabase, migrations, RLS, auth ✅ COMPLETE
10 migrations applied. RLS on all tables, least-privilege grants, guard
triggers, storage, auth, admin shell. Two real vulnerabilities found and fixed
(over-broad Supabase default grants; author self-publish via snapshot-evaluated
`SECURITY DEFINER` helper).

## Phase 4 — The five security utilities ✅ COMPLETE

**Completed**
- `src/lib/crypto/random.ts` — unbiased `randomInt` via rejection sampling,
  CSPRNG Fisher–Yates shuffle, `randomChoice`. No `Math.random` anywhere.
- `src/lib/crypto/password.ts` — character sets, ambiguous filtering,
  group-coverage guarantee, impossible-config rejection, random-string generator.
- `src/lib/crypto/passphrase.ts` — uniform word selection, separators,
  capitalisation, number/symbol options, duplicate-free mode, offline-cracking
  time formatting.
- `src/lib/crypto/wordlist.ts` — EFF Large Wordlist (7,776 words) bundled with
  full CC BY 3.0 attribution; regenerable via `scripts/build-wordlist.mjs`.
- `src/lib/entropy/calculator.ts` — pool sizing, `H = L·log₂(N)`, pattern
  detection (repeats, sequences, keyboard walks, years, repeated chunks),
  strength banding with explicit caveats.
- `src/lib/strength/analyse.ts` — zxcvbn via the maintained `@zxcvbn-ts` port.
- Five tool pages with copy / regenerate / show-hide / validation, accessible
  labelling, and per-tool explanatory copy.

**Key design decision**
Generation happens inside a client-side effect (`useClientSecret`), never during
render. Next 16 refuses to prerender a Client Component that touches
`crypto.getRandomValues()`, and it is right to: a secret must never exist in
server-rendered HTML or the RSC payload.

**Files created**
`src/lib/crypto/{random,password,passphrase,wordlist}.ts` + 4 test files,
`src/lib/entropy/calculator.ts` + test,
`src/lib/strength/analyse.ts` + test,
`src/lib/hooks/{use-copy,use-client-secret}.ts`,
`src/components/tools/{controls,buttons,password-generator,passphrase-generator,
password-strength-checker,entropy-calculator,random-string-generator}.tsx`,
`src/app/{password-generator,passphrase-generator,password-strength-checker,
password-entropy-calculator,random-string-generator}/page.tsx`,
`scripts/{build-wordlist,verify-tools}.mjs`

**Migrations:** none this phase

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **131/131** (run 8× consecutively for flake checking) |
| `npm run build` | pass, 17 routes |
| `scripts/verify-tools.mjs` (Playwright/Chromium) | **30/30** |
| Client-bundle secret scan | clean (only React-internal `Math.random`) |

**Browser-verified privacy guarantees** — all pass:
- No same-origin API requests while generating
- No request bodies contain a secret
- Nothing written to `localStorage`
- Nothing written to `sessionStorage`
- No cookie holds a generated secret
- Server HTML contains no user input

**Statistical testing**
Uniformity is tested, not assumed: chi-squared over 80,000 draws, 8-bucket
distribution checks for word selection, and permutation-distribution checks for
the shuffle. Bands were widened after one flaky run so they are ~4–5 sigma —
tight enough to catch real bias, loose enough not to flake.

**Issues found and fixed during this phase**
- `describeOfflineGuessing` had a mis-mapped unit table (45 bits reported as
  "29 seconds" instead of "29 minutes"). Caught by a test.
- zxcvbn scores `password` as 2 / ~27 bits, not 0–1. This is inherent to the
  algorithm's guessing-cost model; the behaviour is now documented in a test so
  a future library change is noticed, and the UI shows bits alongside the score.
- My own test assumptions were wrong four times (pool size 86 not 94; entropy
  thresholds). Each was corrected against measured ground truth rather than
  adjusted to pass.

**Open risks**
- Playwright browsers installed locally; CI still needs `playwright install`.
- Word list is bundled at ~100 KB raw (gzip well below that). Acceptable now,
  revisit if the bundle budget tightens.
- zxcvbn dictionaries add to client JS; lazy-loading is a Phase 8 option.

## Phase 5 — Administration panel & article workflow ✅ COMPLETE

**Completed**
- Markdown → HTML with a strict allowlist sanitizer (`marked` + `sanitize-html`,
  both MIT). Sanitised on write **and** again on render.
- Article workflow: create, edit, publish, unpublish, schedule, archive, restore,
  delete; draft / in_review / scheduled / published / archived states.
- Immutable revision history appended on every save; no UPDATE or DELETE policy.
- Duplicate-slug validation, SEO fields, Open Graph, canonical, noindex toggle,
  category assignment, featured-image field.
- Live Markdown preview via `/api/preview`, which uses the *same* sanitizer as
  published output and requires authentication.
- Admin panel: dashboard, articles, categories, media, users, settings, SEO,
  audit logs — with role-aware navigation.
- Public routes: `/guides`, `/guides/[slug]`, `/guides/category/[slug]`, sitemap,
  `/about`, `/contact` with a rate-limited, honeypot-protected form.
- Three original draft guides seeded (`scripts/seed.mjs`), all left as drafts
  for editorial review.
- Audit logging on every state change.

**Key architectural decisions**
- Public content reads use a **cookie-free anon client** + `"use cache"`; admin
  reads use the **SSR cookie client**. Public routes cache; admin never does.
- `generateStaticParams` is deliberately absent. Next 16 `cacheComponents`
  requires it to return at least one entry, which a fresh CMS cannot guarantee,
  and enumerating slugs would require a rebuild per publish.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **160/160** |
| `npm run build` | pass, 33 routes |
| `scripts/verify-content.mjs` | **20/20** |
| `scripts/verify-tools.mjs` | **30/30** |
| `scripts/smoke-http.mjs` | **16/16** |
| `scripts/verify-rls.mjs` | **56/56** |
| `scripts/verify-auth.mjs` | **39/39** |

**Security findings — two real issues found and fixed**

1. **Stored XSS via direct DB insert (high).** Content was sanitised only on
   write. A row inserted by a migration, seed, or older build would be served
   verbatim. Verified by injecting `<script>` through the service role and
   observing it served. Fixed with `sanitizeForRender()` on output.

2. **Stale sitemap (medium).** `"use cache"` meant newly published articles
   never reached `/sitemap.xml` until the cache expired. Fixed with an
   uncached `getPublishedSlugsLive()` used by the sitemap.

**Known limitations — recorded, not hidden**
- **Soft 404.** Article and category routes are partially prerendered, so Next
  flushes a 200 status before `notFound()` can run. The response body is the
  branded 404 page and `noindex` metadata is set, but the status is 200.
  Security is unaffected — draft title and body are verifiably absent from the
  response. Tracked for Phase 6.
- Contact-form rate limiting is in-memory, which is unreliable across Vercel
  serverless instances. Needs a distributed limiter before launch.
- Media upload UI is not wired to Storage yet (metadata table and buckets are
  ready); a placeholder screen says so plainly rather than pretending.

---

## Phase 6 — SEO, settings, legal pages, privacy controls ✅ COMPLETE

**Completed**
- **Soft-404 fixed (carried over from Phase 5).** `cacheComponents` is now
  `false` in `next.config.ts`. Public content still uses the `"use cache"` data
  layer and `revalidatePath`, but article and category routes resolve their data
  before streaming, so `notFound()` commits a **real HTTP 404**. Verified live:
  an unknown/draft slug returns 404, not 200.
- **Security headers** on every response: `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (camera,
  microphone, geolocation, interest-cohort all disabled) and HSTS.
- **Public settings layer** (`src/lib/settings/public.ts`). Layers CMS overrides
  from `site_settings` on top of the static `siteConfig`, via the cookie-free
  anon client so RLS still applies. Secret rows are re-filtered in code as
  defence in depth. Every accessor falls back to static config and never throws
  on a public page. Feature toggles **fail closed**.
- **SEO module** (`src/lib/seo/structured-data.ts` + `components/seo/json-ld.tsx`).
  Organization + WebSite JSON-LD graph in the root layout, BreadcrumbList on
  article pages, all serialised through one escaping rule (`<`, `>`, `&` →
  unicode escapes) so structured data can never become an XSS vector.
- **Legal pages** — `/privacy-policy`, `/terms`, `/cookie-policy`. Static,
  indexable, canonical, dated, and CMS-overridable via `legal_*_html` settings
  (sanitised on render). Copy describes **actual** behaviour: hosting/analytics/
  ads are disclosed honestly, and the tools' client-side guarantee is stated
  accurately.
- **Privacy/consent control** (`components/privacy/consent-banner.tsx`). Records
  a first-party consent cookie. Loads **nothing** before consent; no analytics
  or ad script is referenced anywhere in served HTML — the Google Analytics and
  AdSense loaders are client-only and gated on the stored decision. Uses
  `useSyncExternalStore` so it is never server-rendered (no hydration mismatch,
  invisible to no-JS/crawlers). Choice is persisted and re-read.
- Footer and contact surfaces now use the effective (CMS-overridable) brand name
  and footer text.

**Files created**
`src/lib/settings/public.ts` (+ test), `src/lib/seo/structured-data.ts` (+ test),
`src/components/seo/json-ld.tsx`, `src/components/layout/legal-page.tsx`,
`src/components/privacy/consent-banner.tsx` (+ jsdom test),
`src/app/{privacy-policy,terms,cookie-policy}/page.tsx`.

**Files changed**
`next.config.ts` (cacheComponents off + headers), `src/app/layout.tsx`
(JSON-LD + banner), `src/components/layout/footer.tsx` (dynamic brand/footer),
`src/app/admin/settings/page.tsx` (legal + description presets),
`src/app/sitemap.ts` (`force-dynamic` — see finding 1),
`src/app/guides/[slug]/page.tsx` (breadcrumb JSON-LD, shared `JsonLd`),
`scripts/verify-content.mjs` (soft-404 is now a hard assertion; Phase 6 checks),
plus encoding cleanup (stray BOM + mojibake) on 7 WIP files.

**Security findings — one real regression found and fixed**
1. **Frozen sitemap (medium).** With `cacheComponents` disabled, `/sitemap.xml`
   had no dynamic marker, so Next prerendered it once at build time and served
   it from the Full Route Cache — defeating `getPublishedSlugsLive()` and hiding
   articles published after the last build. Found because the verify script
   inserts fixtures directly (bypassing publish-time `revalidatePath`). Fixed
   with `export const dynamic = "force-dynamic"` on the sitemap route.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **187/187** (was 160; +27 new) |
| `npm run build` | pass, legal pages static, sitemap dynamic |
| `scripts/verify-content.mjs` (live DB + server) | **40/40** |

Live-verified: unknown slug → real 404; three legal pages → 200 with `<h1>`,
canonical, indexable, dated; home emits Organization + WebSite JSON-LD; article
emits BreadcrumbList; no third-party analytics/ads script in served HTML.

**Known limitations — recorded, not hidden**
- Contact-form rate limiting is still in-memory (needs a distributed limiter
  before launch). Unchanged this phase.
- AdSense/CMP wiring is Phase 7; the consent mechanism is in place and tested,
  but no ad or analytics script exists yet, so "Accept all" and "Essential only"
  currently lead to the same outcome (nothing loads). The banner says so.
- Media upload UI is still a documented placeholder. Unchanged this phase.

---

## Phase 7 — Optional AdSense + consent management ✅ COMPLETE

**Completed**
- **Ad config layer** (`src/lib/ads/config.ts`). Pure, fail-closed resolution:
  ads are `ready` only when (a) the admin `adsense_enabled` setting is on, (b) a
  syntactically valid `NEXT_PUBLIC_ADSENSE_CLIENT_ID` (`ca-pub-<digits>`) is
  present, and (c) the deployment switch `NEXT_PUBLIC_ADSENSE_ENABLED` is
  exactly `"true"`. Any missing precondition → off. **No publisher ID is ever
  fabricated**; when not ready, the resolved ID is `null`.
- **Consent-gated loader** (`src/components/ads/ad-slot.tsx` + `src/lib/ads/use-consent.ts`).
  The AdSense `<script>` is injected **only after** the visitor grants optional
  ("accept all") consent, read from the first-party `ip_consent` cookie via
  `useSyncExternalStore` (server snapshot = no consent, so the script is never in
  server HTML and there is no hydration mismatch). Not configured → renders
  nothing. Configured but no consent → an honest, inert placeholder with no
  script and no request.
- **Placement**: one clearly-labelled, responsive, non-intrusive unit on
  `/guides` only, placed after content and visually separated. AdSense is never
  placed on a tool page, and ad config is fully independent of password
  generation.
- **Public API** `GET /api/ads/config` — returns only non-sensitive readiness
  (`ready`, `reason`, `message`, `consentRequired`, and the real `publisherId`
  only when ready). `no-store`. Never returns a secret or a fake ID.
- **Admin**: `/admin/seo` now shows an advertising-readiness panel with the exact
  reason ads are on/off; `/admin/settings` hint updated to state the three
  preconditions and that approval is never guaranteed.
- **Honest legal copy**: privacy policy and cookie policy updated to describe
  AdSense accurately (runs only when enabled + consented; Google is a separate
  controller; no analytics at all). Consent banner copy updated. `UPDATED` dates
  bumped.

**Files created**
`src/lib/ads/config.ts` (+ test), `src/lib/ads/server.ts`,
`src/lib/ads/use-consent.ts`, `src/components/ads/ad-slot.tsx` (+ jsdom test),
`src/app/api/ads/config/route.ts`.

**Files changed**
`src/app/guides/page.tsx` (ad slot), `src/app/admin/seo/page.tsx` (readiness
panel), `src/app/admin/settings/page.tsx` (hint), `src/app/privacy-policy/page.tsx`
+ `src/app/cookie-policy/page.tsx` (accurate ads copy + date),
`src/components/privacy/consent-banner.tsx` (copy), `.env.example` (slot +
kill-switch docs), `scripts/verify-content.mjs` (Phase 7 checks), docs.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **199/199** (was 187; +12 new) |
| `npm run build` | pass, 34 routes incl. `/api/ads/config` |
| `scripts/verify-content.mjs` (live DB + server) | **46/46** |

Live-verified: `/api/ads/config` → `ready:false`, `publisherId:null`,
`consentRequired:true`, `no-store`; `/guides` served HTML contains **no**
AdSense script or `<ins>` while ads are off.

**Known limitations — recorded, not hidden**
- **Ads are OFF in this environment** and correctly so: there is no real,
  approved AdSense publisher ID, so the config fails closed. Turning ads on
  requires a genuine ID, the deploy switch, the admin setting, AND a visitor
  consenting. Approval is never claimed or guaranteed.
- **EEA/UK/CH personalized ads need a Google-certified CMP + IAB TCF.** The
  consent mechanism is first-party and adequate for the current "ads off /
  non-personalized" posture. Before enabling personalized ads for those regions,
  a certified CMP must be integrated and IAB TCF re-verified (requirements
  change). Tracked for Phase 9 readiness.
- AdSense script loads from Google's CDN only after consent; a strict CSP, if
  ever added, must allow `pagead2.googlesyndication.com` when ads are enabled.

---

## Phase 8 — Security, accessibility, performance, regression testing ✅ COMPLETE

**Completed**
- **`scripts/verify-security.mjs`** — security headers on responses; `/admin`
  `no-store`; **client-bundle secret scan** (`.next/static/**/*.js` checked for
  the real service-role key value + high-confidence patterns); audit that no
  `SECRET/KEY/TOKEN`-named env var is `NEXT_PUBLIC_`. **10/10.**
- **`scripts/verify-a11y.mjs`** — Playwright + injected axe-core: WCAG 2.1 A/AA
  on every public page, one `<h1>`, a `<main>` landmark, no horizontal scroll at
  360/768/1280. **91/91.**
- **`scripts/verify-regression.mjs`** — broken-link crawl over public routes;
  **runtime privacy invariant** (generate → no external request, empty
  localStorage/sessionStorage, value absent from URL); consent banner
  show/accept/persist; every tool renders. **14/14.**
- **`scripts/verify-performance.mjs`** — deterministic client-JS bundle budget
  (gzipped total + largest chunk). **3/3** (248 KB total / 70 KB largest vs 400/160 budgets).

**Two real accessibility defects found and fixed**
1. **Passphrase separator radios had no accessible name.** The space and glyph
   separators produced empty/ambiguous labels (axe `label`, critical). Fixed
   with an explicit `aria-label` per option (`Separator: Hyphen`, `… Space`, …).
2. **Insufficient colour contrast.** The strength checker rendered its privacy
   notice with the red `ErrorMessage` (`text-danger` on a tinted background) —
   both a contrast failure and a semantic misuse (an info message styled as an
   alert). Switched to the neutral `PrivacyNotice` (matching every other tool
   page) and darkened the `--color-danger`/`--color-success`/`--color-warning`
   tokens for light mode + added dark-mode overrides, so genuine error text
   (form validation, auth) also clears 4.5:1.

**Files created**
`scripts/verify-security.mjs`, `scripts/verify-a11y.mjs`,
`scripts/verify-regression.mjs`, `scripts/verify-performance.mjs`.

**Files changed**
`src/components/tools/passphrase-generator.tsx` (radio `aria-label`),
`src/components/tools/password-strength-checker.tsx` (`PrivacyNotice`),
`src/app/globals.css` (contrast-safe semantic colours, light + dark),
`package.json` (4 `verify:*` scripts), `docs/testing-plan.md`, `docs/status.md`.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **199/199** |
| `npm run build` | pass, 34 routes |
| `verify:security` | **10/10** |
| `verify:a11y` | **91/91** |
| `verify:regression` | **14/14** |
| `verify:performance` | **3/3** |
| `scripts/verify-content.mjs` (regression check) | **46/46** |

---

## Phase 9 — Deployment, domain, Search Console, backups, AdSense readiness ✅ COMPLETE (preparational)

This phase produced the launch artifacts and an automated pre-flight gate. The
documented steps are **preparational**: actually executing a production deploy,
real DNS changes, live Search Console verification, a genuine backup restore, or
AdSense submission/approval **cannot be done from this environment** and are
explicitly left as operator actions. Nothing below claims they were performed.

**Completed**
- **`scripts/prelaunch-check.mjs`** — a dependency-free pre-deployment gate
  (**29/29**). Verifies: no committed secrets (no `.env*`, `*.pem`/`*.key`,
  no `service_role` key material); `.gitignore` protects env + `.vercel` + keys;
  `.env.example` documents every required var and exposes no secret-named
  `NEXT_PUBLIC_` var; required files/routes exist (robots, sitemap, legal pages,
  ads config, security headers); ads are fail-closed by default; and the launch
  docs are present and non-trivial. Wired as `npm run prelaunch`.
- **`docs/deployment.md`** — the operator runbook: full env-var matrix (browser
  vs server, per environment), Vercel setup (production branch `main`), domain +
  DNS records, Supabase Auth URL/redirect configuration, applying migrations,
  Search Console verification + sitemap submission, backups/PITR + restore
  procedure, post-deploy live verification commands, and rollback.
- **`docs/security-checklist.md`** — the enforced posture mapped to automated
  checks, plus recorded **known limitations** (in-memory contact rate limit,
  no CSP yet, admin pages not axe-scanned) and a launch sign-off list.
- **`docs/adsense-readiness.md`** — an honest report: **ads OFF / fail-closed,
  no approved account, approval not guaranteed.** Documents the consent-gated
  fail-closed architecture, what remains (real `ca-pub-` ID, Google approval, a
  certified CMP + IAB TCF for EEA/UK/CH, sufficient content, `ads.txt`), and the
  operator runbook to enable. The example `/api/ads/config` JSON is copied from
  the real route, not invented.

**Files created**
`docs/deployment.md`, `docs/security-checklist.md`, `docs/adsense-readiness.md`,
`scripts/prelaunch-check.mjs`.

**Files changed**
`package.json` (`prelaunch` script), `docs/status.md`.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `node scripts/prelaunch-check.mjs` | **29/29** |

**Explicitly NOT performed here (operator actions)**
- Pushing to Vercel / a real production deploy or preview build.
- Real DNS/domain changes and TLS issuance at the registrar.
- Live Google Search Console verification and sitemap submission.
- Confirming real Supabase backups or executing a restore rehearsal.
- AdSense account approval and serving ads.
- Real Core Web Vitals measurement (only the deterministic bundle budget is automated).

**Remaining before go-live**
1. Set production env vars in Vercel (§2) — never copy secrets into preview.
2. Run `verify-rls` + `verify-auth` against the production project.
3. Enable Supabase backups/PITR and rehearse one restore (§8).
4. Verify Search Console and submit `sitemap.xml` (§7).
5. Keep ads disabled until §3 of `adsense-readiness.md` is fully satisfied.


**Known limitations — recorded, not hidden**
- The a11y suite covers **public** pages. Admin pages sit behind auth and are
  not axe-scanned here; their status text (`text-success`/`text-warning`) now
  uses contrast-safe tokens but has not been machine-verified behind a session.
- Performance is gated on **bundle size**, a deterministic proxy. Real-world
  Core Web Vitals should be measured on the deployed preview (Phase 9) with
  Lighthouse/PSI; cold-start and network timings are intentionally not asserted
  in CI because they are flaky.
- `test:e2e` (`playwright test`) still has no spec files; the repo uses the
  standalone `verify-*.mjs` scripts instead, consistent with prior phases.

---

## Phase 9 — Deploy production, domain, Search Console, backups, AdSense readiness ⬜ NEXT

---

## Media upload — wired to Supabase Storage ✅ COMPLETE (unverified against a live bucket)

**Completed**
- **`src/app/admin/media/actions.ts`** — `uploadMediaAction`. Validates the file
  (image MIME allow-list, 5 MB cap mirrored from `0005_storage.sql`), derives the
  object extension from the MIME type, writes the binary to the `media` (public)
  or `media-private` bucket under a path prefixed with the uploader's id
  (`<uid>/<uuid>.<ext>`, satisfying `storage_staff_insert`), then inserts the
  `media` metadata row with `uploaded_by = auth.uid()`. An orphaned object is
  removed if the metadata insert fails. Records a `media.uploaded` audit entry and
  revalidates `/admin/media`. Runs entirely server-side with the cookie/RLS
  client — no service-role key, no filesystem writes.
- **`src/components/admin/media-uploader.tsx`** — client uploader using
  `useActionState` + the shared `ActionButton`; resets the form on success and
  surfaces `error`/`fieldErrors`.
- **`src/app/admin/media/page.tsx`** — placeholder copy replaced with the
  uploader; list and select unchanged.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | 226/226 |
| `npm run build` | pass |

**Known limitations — recorded, not hidden**
- Not exercised against a live Supabase project from this environment (no
  running dev server / credentials were used). The Storage upload + metadata
  write are **implemented but unverified end-to-end**.
- `width`/`height` are stored as `null` for uploads made from the media library
  page (no dependency added there). The article featured-image path *does* parse
  dimensions server-side (see below). Thumbnails and delete/alt-text editing are
  not part of this change.
- Bucket objects created by an author can only be deleted by an editor, and the
  `media` row only by an admin (per existing policies); no delete UI was added.

---

## Article featured images & thumbnails ✅ COMPLETE (live bucket unverified)

**Completed**
- **Upload + preview in the article editor** (`article-editor.tsx`). A "Featured
  image" section lets staff pick a file, validates it client-side (type, ≤5 MB,
  600×315 minimum), uploads immediately, and previews it. The stored media id
  rides along in a hidden `featured_image_id` field; choosing a new file replaces
  the image and a Remove button clears it. Preserves the existing form layout.
- **Server-side authority** (`src/lib/media/featured-image.ts` +
  `src/lib/media/image-info.ts`). The declared MIME type is ignored — the bytes
  are sniffed (PNG/JPEG/WebP magic numbers) and the true dimensions are read from
  the container header. Images must be 600×315…8000×8000. Objects are written to
  the public `media` bucket at `<uid>/<uuid>.<ext>` (satisfying storage RLS) and a
  `media` row records size, dimensions and `uploaded_by`. Auth is re-checked in
  the action (`requireRole("author")`); no service-role key is used.
- **Old-image cleanup** — replacing or deleting an article deletes the previous
  asset, but only when no article still references it (best effort; an author may
  lack the delete role, in which case an admin clears it later).
- **Public thumbnails** via `components/articles/article-thumbnail.tsx` and
  `article-card.tsx`: fixed 16:9, `object-fit: cover`, inline placeholder when an
  article has no image (never a broken-image icon), lazy-loaded (the article hero
  is `priority`). Shown on the homepage ("Latest articles"), `/articles`,
  category pages, related reading, the article hero, and `/articles?q=` search
  results.
- **Search** — `/articles?q=` now filters published articles by title/excerpt
  (the surface already advertised by the WebSite search action).
- **SEO/social** — `og:image` and `twitter:image` use the absolute Supabase
  public URL, and the Article JSON-LD gains an `image`. `next.config.ts` allows
  the `**.supabase.co` public-storage path so the image optimizer can resize.
- **Alt text (SEO)** — a single `src/lib/seo/alt-text.ts` builder now feeds every
  image: the header/footer logo (`logoAlt`) and article thumbnails
  (`articleImageAlt`, which prefers the editor description and falls back to the
  title). The article editor also has an **Alt text** field that saves to the
  media row (`media_staff_update`) so editors control image SEO after upload;
  blank resets to the title fallback. The hero is an intentionally decorative CSS
  background (`aria-hidden`), so it correctly carries no alt. New images should
  take their alt from this module rather than an inline string.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm test` | **243/243** (+17 overall) |
| `npm run build` | pass (`/articles` now dynamic for `?q`) |
| `node scripts/prelaunch-check.mjs` | 29/29 |

**Known limitations — recorded, not hidden**
- Not exercised against a live Supabase bucket from this environment. Upload,
  storage RLS and public URL resolution are **implemented but unverified
  end-to-end**. Requires migrations applied and the `media` bucket to exist.
- Dimension limits are also checked in the browser for fast feedback; the server
  repeats them and is the authority.
- There is no separate control for the existing `og_image_id` column; the
  featured image is used for Open Graph, and `og_image_id` is left untouched.

---

## Google Analytics 4 (consent-gated, fail-closed) ✅ COMPLETE (live property unverified)

**Completed**
- **Analytics config layer** (`src/lib/analytics/config.ts`). Pure, fail-closed
  resolution: analytics is enabled only when the admin `analytics_enabled`
  setting is on **and** a syntactically valid `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  (`G-<alphanumerics>`) is present. A malformed value fails closed rather than
  being embedded into a script URL. **No ID is ever fabricated**; when disabled
  the resolved ID is `null`.
- **Consent-gated loader** (`src/components/analytics/google-analytics.tsx`).
  gtag.js is injected **only after** the visitor grants optional ("accept all")
  consent, read from the first-party `ip_consent` cookie via the existing
  `useHasOptionalConsent` hook (shared with AdSense). Before consent the loader
  makes **no request at all** — it does not even ask the server whether analytics
  is configured (the readiness fetch happens only after consent), so a visitor
  who declines causes zero analytics traffic.
- **Public API** `GET /api/analytics/config` — returns only non-sensitive
  readiness (`enabled`, `measurementId` when enabled, `consentRequired`).
  `no-store`. Never returns a secret; a missing/invalid ID is `null`, never
  fabricated.
- **Honest legal copy**: privacy policy, cookie policy and consent banner updated
  to describe Google Analytics 4 accurately (runs only when enabled + consented;
  names the `_ga` cookies; states plainly that generated secrets are never sent).
  `UPDATED` dates bumped to 2026-10-13. The banner no longer claims "we never run
  third-party analytics", which would otherwise have become false.

**Files created**
`src/lib/analytics/config.ts` (+ test),
`src/components/analytics/google-analytics.tsx` (+ jsdom test),
`src/app/api/analytics/config/route.ts`.

**Files changed**
`src/app/layout.tsx` (mount the loader), `src/components/privacy/consent-banner.tsx`
(copy), `src/app/privacy-policy/page.tsx` + `src/app/cookie-policy/page.tsx`
(accurate copy + dates), `src/app/admin/settings/page.tsx` (hint),
`scripts/verify-content.mjs` (analytics checks), `docs/status.md`,
`docs/adsense-readiness.md`.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **272/272** (was 259; +13 new: config + jsdom loader) |
| `npm run build` | pass, 32 pages |
| `GET /api/analytics/config` (dev) | `{"enabled":false,"measurementId":null,"consentRequired":true}`, `no-store` |
| production HTML scan | no `googletagmanager` / `google-analytics` / `gtag` in served HTML |

**Known limitations — recorded, not hidden**
- **Analytics is OFF in this environment** and correctly so: the admin
  `analytics_enabled` setting defaults to `false`, so the config fails closed.
  Turning it on requires the Vercel env var `NEXT_PUBLIC_GA_MEASUREMENT_ID` **and**
  the admin setting **and** a visitor consenting.
- Not exercised against a **live GA property** from this environment: the loader,
  consent gate and config resolution are unit-tested and the build is verified,
  but no real GA hit was observed in a browser here.
- The value `NEXT_PUBLIC_GA_MEASUREMENT_ID` is read **server-side** in the
  force-dynamic API route (it is not inlined into the client bundle), so adding
  it on Vercel requires a redeploy to take effect.


---

## Phase: admin settings actually appear on the site (2026-10-13)

**Reported symptom.** An admin set Brand name, Tagline, Footer text, Contact
email and Site description in `/admin/settings`; the rows were saved (verified
against the database) but the public site never changed.

**Root causes.** Three independent defects:

1. **No revalidation.** Every public page is prerendered at build (`○` in the
   route table). `saveSettingAction`/`deleteSettingAction` called
   `revalidatePath("/admin/settings")` only, so the baked HTML kept serving the
   build-time values until a redeploy. A stale `.next` also showed how fragile
   this was: an incremental build reused a cached render and baked the *old*
   value.
2. **Settings were never wired.** `site_tagline` and `site_description` had
   helpers that nothing called; `brand_name` reached only the footer (not the
   header wordmark, `<title>` suffix or structured data); `contact_email`
   reached only the legal pages; `maintenance_mode` was stored but no holding
   page existed. The admin hints promised behaviour that was not implemented.
3. **Legal/about body copy** hard-coded `siteConfig.name` rather than the
   effective brand.

**Fix.**

- **Revalidation**: settings save/delete now also call
  `revalidatePath("/", "layout")`, so the whole statically-prerendered site is
  regenerated on demand.
- **Wiring** (all through `getSiteIdentity()`/the existing helpers):
  - brand name → header wordmark, `<title>` template suffix, footer,
    Organization/WebSite JSON-LD, article publisher/author, legal/about body.
  - tagline → first sentence of the footer blurb and the default page title.
  - site description → homepage meta description and the JSON-LD description.
  - contact email → contact page (mailto) as well as the legal pages.
  - maintenance mode → a real 503 holding page served from the Edge proxy.
- **Maintenance mode**: `src/proxy.ts` gates public *navigations* only; `/admin`,
  `/login`, `/api`, `/_next` and file-like paths are bypassed so the owner can
  always switch it back off. The flag is read through the anon key (RLS still
  applies), memoised for 15 s in the isolate, and **fails closed** — any error,
  missing config or unparseable value leaves the site up.
- `getPublicSettings` is now wrapped in React `cache`, so a request reads
  `site_settings` once instead of once per helper.
- `asBoolean` moved to `src/lib/settings/parse.ts` (no `server-only`, no React)
  so the proxy and the settings layer share one implementation.

**Files created**
`src/lib/maintenance.ts` (+ test), `src/lib/settings/parse.ts`, `src/proxy.test.ts`.

**Files changed**
`src/app/layout.tsx` (async `generateMetadata` + identity + header prop),
`src/components/layout/header.tsx`, `src/components/layout/nav-links.tsx`,
`src/components/layout/footer.tsx`, `src/app/contact/page.tsx`,
`src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/privacy-policy/page.tsx`,
`src/app/terms/page.tsx`, `src/app/cookie-policy/page.tsx`,
`src/app/articles/[slug]/page.tsx`, `src/app/articles/category/[slug]/page.tsx`,
`src/app/admin/settings/actions.ts`, `src/app/admin/settings/page.tsx`,
`src/lib/settings/public.ts`, `src/lib/seo/structured-data.ts`,
`src/lib/settings/public.test.ts`, `src/lib/seo/structured-data.test.ts`,
`src/proxy.ts`.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **295/295** (was 275; +20 new: identity, maintenance, proxy gate) |
| `npm run build` | pass, 32 pages; `/`, `/about`, `/contact`, `/privacy-policy`, `/terms`, `/cookie-policy` still `○ (Static)` |
| `next start` route check | `/`, `/contact`, `/about`, `/privacy-policy`, `/terms`, `/cookie-policy`, `/articles`, `/tools`, `/api/analytics/config` all 200 |
| baked-HTML check | DB tagline in the footer blurb; DB contact email on the contact page, the legal pages and in JSON-LD; brand name in the privacy/terms/about/cookie body; `/api/analytics/config` returns `{"enabled":true,"measurementId":"G-…",…}` |
| proxy test | maintenance ON ⇒ public navigation 503, `/admin` and `/api` never 503, read failure ⇒ still 200 |

**Known limitations — recorded, not hidden**
- `revalidatePath("/", "layout")` was verified by the route table, the build and
  the unit/proxy tests, but was **not** exercised against the live Supabase
  database from this environment (that needs an authenticated admin session and
  a real write). The mechanism is the same one the article publish actions
  already rely on to refresh the statically-prerendered homepage.
- Maintenance mode was tested with a stubbed settings read (`src/proxy.test.ts`)
  and confirmed OFF against the real database; it was not switched ON against
  live data.
- Metadata is regenerated at build/revalidation time, so a title/meta change
  appears after the save-triggered revalidation completes.

## GA measurement ID bundled as a default (2026-10-13)

**Request.** The owner supplied the standard gtag.js snippet for a GA4
measurement ID (since retired — see the replacement entry below) and asked that
it replace the current analytics code. The chosen approach (confirmed with the
owner) keeps the consent gate and embeds the ID, so GA fires without needing a
Vercel environment variable.

**Change** (`src/lib/analytics/config.ts`)
- Added `DEFAULT_GA_MEASUREMENT_ID` — the owner's own public GA4 ID, not a
  placeholder (the value was later replaced; the retired ID is intentionally not
  reproduced here). `gaMeasurementId()` now uses
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` when set, otherwise the bundled default; an
  explicitly configured but malformed value still fails closed (returns null).
- The consent gate is unchanged: gtag.js is still injected only after the
  visitor grants optional consent, so AGENTS.md §4 holds.

**Files changed**
`src/lib/analytics/config.ts`, `src/lib/analytics/config.test.ts`,
`src/components/analytics/google-analytics.tsx` (doc comment),
`src/app/admin/settings/page.tsx` (hint), `.env.example` (comment).

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **297/297** (was 295; +2: bundled-default fallback, malformed-config fail-closed) |
| runtime | `GET /api/analytics/config` → `{"enabled":true,"measurementId":"G-…","consentRequired":true}` |

**Note.** The fallback path (no env var) is covered by unit tests; the local dev
server reads `.env.local`, which already sets the same value, so the runtime
check exercises the env path. Set the env var in Vercel only if you ever need to
override the bundled default.

## GA measurement ID replaced (2026-10-16)

**Request.** The owner deleted the GA4 property holding the previously bundled ID
(since retired), created a new property, and supplied the standard gtag.js
snippet for the replacement ID `G-FM1QKB6H5P`.

**Change** (`src/lib/analytics/config.ts`)
- `DEFAULT_GA_MEASUREMENT_ID` updated to `G-FM1QKB6H5P`. This is the only
  behavioural change; the consent gate, the fail-closed validation, the
  `/api/analytics/config` contract and the `verify-content.mjs` consent assertion
  are all unchanged, so AGENTS.md §4 still holds.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` in `.env.local` (untracked) set to the same
  value so local development does not silently keep using the retired ID.

**Files changed**
`src/lib/analytics/config.ts`, `src/lib/analytics/config.test.ts`,
`src/components/analytics/google-analytics.test.tsx`, `docs/status.md`.

**Database**
`site_settings.analytics_enabled` was set to `false` while the property was
deleted, then returned to `true` once the replacement property existed. No schema
change and no migration; the toggle is a plain JSONB boolean.

**Verification (all executed)**
| Gate | Result |
|---|---|
| `npm run lint` | pass, 0 errors/warnings |
| `npm run typecheck` | pass |
| `npm test` | **320/320** across 27 files |
| database | anon/RLS read of `analytics_enabled` → `true` |

**Not verified.** The production `/api/analytics/config` response was not
re-checked after this change, because it still reflects the previous deployment
until this commit is pushed and Vercel redeploys.

**Risk — Vercel environment override.** `gaMeasurementId()` prefers
`NEXT_PUBLIC_GA_MEASUREMENT_ID` over the bundled default. If that variable were
still pinned to the retired ID in the Vercel project, production would keep
sending hits to the deleted property and the bundled default would be ignored.

**Resolved (verified 2026-10-21).** Production was re-checked against the live
deployment: `GET https://ipassgenerator.online/api/analytics/config` returns
`{"enabled":true,"measurementId":"G-FM1QKB6H5P","consentRequired":true}`. The
retired ID is not in use; the Vercel variable is either unset or set to the
current ID. No further action needed unless the ID changes again.

**Note.** GA4 property deletion resets all historical reporting, so the new
property starts with no data. Realtime will also undercount for as long as the
consent gate is in place: visitors who decline optional consent send nothing,
which is the intended privacy behaviour rather than a defect.
