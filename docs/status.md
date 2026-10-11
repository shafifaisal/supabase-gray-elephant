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

## Phase 6 — SEO, settings, legal pages, privacy controls ⬜ NEXT