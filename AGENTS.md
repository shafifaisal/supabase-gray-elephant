# AGENTS.md — iPassGenerator

Project instructions for AI agents and human contributors. **Read this before writing any code.**

Working brand: **iPassGenerator** (`ipassgenerator.online`).
This is a privacy-first password-security tools website with a custom CMS admin panel.

---

## 1. Non-negotiable security rules

These are not style preferences. Violating any of them is a bug.

1. **All secret generation is client-side and local only.**
   Passwords, passphrases and random strings MUST NOT be sent to any server,
   analytics provider, error tracker or external API. They MUST NOT be written to
   PostgreSQL, Supabase Storage, cookies, `localStorage`, `sessionStorage`,
   IndexedDB, URLs, React state that gets serialized, server logs or telemetry.

2. **Never use `Math.random()` for anything security-sensitive.**
   Use `crypto.getRandomValues()` with unbiased rejection sampling and a
   cryptographically secure shuffle (Fisher–Yates driven by CSPRNG).

3. **Never store or transmit strength-checker input.**
   The password strength checker is local-only. No API calls, no logging,
   no error messages containing the input, no "report weak password" features.

4. **Never expose the Supabase service-role or secret key to the browser.**
   Only `NEXT_PUBLIC_*` publishable keys may reach a client bundle.
   All privileged work happens in Server Components / Route Handlers / Server Actions.

5. **Never commit secrets.** No `.env` files, keys, tokens or credentials in git.

6. **Never trust role information from the client.**
   Authorization is enforced by PostgreSQL Row Level Security and server-side
   checks against the authenticated Supabase session. UI hiding is cosmetic only.

7. **Never trust user-supplied role or profile fields.**
   A user must not be able to self-assign `admin`. Profiles are written by trusted
   server-side code or by an admin, never by the end user.

8. **Never render untrusted HTML without sanitization.**
   Public article content passes through an allowlist sanitizer or a strictly
   configured Markdown renderer that strips raw HTML.

9. **Do not create database tables for generated secrets.**
   There is intentionally no table for passwords, passphrases or checked passwords.

10. **Do not claim Google AdSense approval is guaranteed.** Never fabricate
    publisher IDs, ad clicks or advertising metrics.

---

## 2. Mandatory workflow rules

- **Inspect before coding.** Read this file, the repo layout and existing config first.
- **Identify existing features before changing files.** Do not blind-overwrite.
- **Small, testable phases.** One concern at a time.
- **Never delete files, tables, migrations or user data without explicit permission.**
- **Never reset or wipe a database without explicit permission.**
- **Never overwrite environment files or credentials blindly.**
- **Do not install unnecessary dependencies.** Justify every new package.
- **After every change set, run:** `npm run lint`, `npm run typecheck`, `npm test`.
- **Report honestly.** Changed files, tests run + results, blockers, open risks.
  Never claim something is complete or working unless it was actually verified by
  running it. "Implemented but unverified" must be stated as such.

---

## 3. Required stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript, currently supported release |
| Rendering | React Server Components by default; `"use client"` only for interactivity |
| Hosting | Vercel |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth with SSR cookie sessions |
| Authorization | PostgreSQL Row Level Security |
| Media | Supabase Storage (only where media is required) |
| Styling | Tailwind CSS |
| Validation | Zod |
| Tests | Vitest (unit/integration) + Playwright (e2e) |
| Package manager | npm (established in this repo) |

**Forbidden:** Laravel, MySQL, a separate PHP backend, self-hosted long-running
servers, or unnecessary infrastructure. (An XAMPP install exists on this machine
but is explicitly out of scope.)

---

## 4. Privacy invariants

- Privacy Policy, Terms and cookie/consent text must describe **actual** behaviour.
  Never claim "we collect nothing" while hosting, analytics or ads exist.
- No non-essential script (analytics, ads, consent platform) may load before the
  required consent is granted.
- For personalized ads in the EEA/UK/CH, use a Google-certified CMP and follow the
  current IAB TCF requirements. Re-check these before launch — they change.
- Collect the minimum personal data. The contact form stores a message, not secrets.

---

## 5. Route protection summary

- Public routes render only `status = 'published'` content.
- Drafts, revisions, private settings and `/admin/*` must return 404 (not 403) to
  non-authorized users where existence itself is sensitive.
- Admin responses must set `Cache-Control: private, no-store`.
- All `/admin/*` routes require an authenticated, active, role-authorized session.

---

## 6. Content rules

- All editorial content must be original. Do not copy competitor text, logos or assets.
- AI-assisted drafts stay in `draft` and require human editorial review before publishing.
- No thin/duplicate pages created purely to inflate page count.
- Never invent reviews, ratings, awards or statistics.

---

## 7. Command reference

```bash
npm run dev          # local dev server
npm run build        # production build
npm run start        # serve production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit + integration
npm run test:e2e     # Playwright
```

Environment variables are documented in `.env.example` and `docs/setup.md`.
Never paste real values into tracked files, issues, logs or chat.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
