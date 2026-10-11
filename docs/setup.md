# Local Setup

## Prerequisites

- Node.js >= 20.9 (verified on v24.16.0)
- npm >= 10
- Git

## Install

```bash
npm install
```

## Environment

```bash
cp .env.example .env.local
```

Fill in at minimum:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (safe for browser *only* with RLS) |

Leave `SUPABASE_SERVICE_ROLE_KEY*` empty until Phase 3 — the app builds and runs
without it.

**Never commit `.env.local`.** It is already git-ignored.

## Run

```bash
npm run dev     # http://localhost:3000
```

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

## Supabase project creation (Phase 3)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Copy Project URL and the publishable/anon key into `.env.local`.
3. Install the CLI: `npm i -g supabase` (optional; the dashboard also applies SQL).
4. Link: `supabase link --project-ref <ref>` then `supabase db push`.
5. In **Authentication → URL Configuration** set:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/**`, plus the Vercel preview/prod URLs.

## Vercel (Phase 2 preview)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Import into Vercel — framework detection is automatic.
3. Set `NEXT_PUBLIC_SITE_URL` and the public Supabase vars per environment.
4. Deploy. Preview URLs deploy from any non-production branch; production from `main`.

Production must never reuse preview secrets. See `docs/deployment.md`.