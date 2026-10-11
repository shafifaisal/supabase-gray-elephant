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

`npm run lint` · `npm run typecheck` · `npm test` · `npm run build` ·
Playwright suite · bundle secret scan.

## Definition of test-done

A feature is not "done" until it has a passing test that would fail if the feature
regressed.