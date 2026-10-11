# Testing Plan

## Tools

- **Vitest** — unit + integration (fast, jsdom for UI, node for crypto/entropy)
- **@playwright/test** — end-to-end (auth flows, admin CRUD, a11y, responsive)

## Coverage map

| Area | Level | What must be proven |
|---|---|---|
| Password generator | unit | unbiased selection, character-set inclusion, impossible-config rejection, length bounds, no Math.random |
| Passphrase generator | unit | uniform word selection, word-count, separator/capitalize options, secure shuffle |
| Random string generator | unit | length, charset options, ambiguous exclusion, validation |
| Entropy calculator | unit | formula correctness vs known values, pattern penalties |
| Privacy / network | unit + e2e | no fetch/XHR/beacon of secrets; nothing in storage/cookies/logs |
| Sanitization | unit | script, event handlers, `javascript:` URLs stripped |
| Auth | integration | sign-in/out, refresh, reset, expiry, protected redirects |
| Role authorization | integration | author/editor/admin matrix enforced |
| RLS | integration | anon/user A/user B/admin via real DB; SELECT/INSERT/UPDATE/DELETE negatives |
| Draft visibility | integration + e2e | unpublished 404 for public, visible to author |
| Articles | integration | publish/unpublish/schedule/archive, revisions, slug uniqueness |
| SEO | unit + e2e | canonical, unique titles, JSON-LD shape, 404 status |
| Sitemap | unit + e2e | only published canonical URLs; no admin/draft/noindex |
| Consent | e2e | no third-party script before consent; preferences persist & change |
| Accessibility | e2e | axe on public + admin pages; keyboard paths |
| Responsive | e2e | 360/768/1280 viewports, no horizontal scroll |
| Broken links | e2e | crawler over public routes |

## RLS test methodology

Use a dedicated **Supabase test project** (never production). For each policy:

1. Create test users via `auth.admin` (service role) with known roles.
2. Mint anon / authenticated tokens.
3. Perform each operation (SELECT/INSERT/UPDATE/DELETE).
4. Assert allowed **and denied** outcomes — a negative test that fails loudly if
   RLS is accidentally disabled.

## Privacy test (critical)

```js
// e2e — assert no secret ever leaves the browser
await page.route('**/*', r => { outbound.push(r.request().url()); r.continue(); });
await generate();
expect(outbound.filter(u => !u.includes('supabase') && !u.includes('vercel'))).toHaveLength(0);
expect(await page.evaluate(() => localStorage.length)).toBe(0);
```

Also scan built client bundles for secret-key patterns.

## Gates before release

`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · Playwright suite · bundle secret scan.

## Phase 8 verification suite (added)

Four standalone scripts gate the release. They run against a built + started
server (`npm run build && npm start`), except performance which is build-only.

| Script | npm | Proves |
|---|---|---|
| `scripts/verify-security.mjs` | `verify:security` | Security headers; `/admin` `no-store`; **no secret in client bundles** (scans `.next/static` for the real service-role key + high-confidence patterns); no secret-named env var is `NEXT_PUBLIC_`. |
| `scripts/verify-a11y.mjs` | `verify:a11y` | axe-core WCAG 2.1 A/AA on every public page; one `<h1>`; a `<main>` landmark; no horizontal scroll at 360/768/1280. |
| `scripts/verify-regression.mjs` | `verify:regression` | No broken internal links; **privacy invariant at runtime** (generation → no external request, empty storage, value not in URL); consent banner shows/accepts/persists; every tool renders. |
| `scripts/verify-performance.mjs` | `verify:performance` | Client JS bundle-size budget (gzipped total + largest chunk) — a deterministic proxy for load performance. |

No new dependencies: axe-core is injected from the existing install; Playwright
chromium is already present.

## Definition of test-done

A feature is not "done" until it has a passing test that would fail if the feature
regressed.