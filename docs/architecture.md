# Architecture

## Design goals

1. **Privacy** — secret generation never touches the network.
2. **Server-first** — public content is rendered on the server, cached at the edge.
3. **Defense in depth** — authorization enforced in PostgreSQL RLS, re-checked server-side.
4. **Separation of concerns** — tools are pure functions; pages are thin shells.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Client Components)                                │
│  - Password / passphrase / random-string generators         │
│  - Strength checker                                         │
│  - Entropy calculator                                       │
│  ⚠ Never fetch/send a generated secret. No storage.         │
└─────────────────────────────────────────────────────────────┘
                         │ (no secrets cross this line)
┌────────────────────────▼────────────────────────────────────┐
│  Next.js Server (Vercel)                                    │
│  - App Router RSC pages, Route Handlers, Server Actions    │
│  - Supabase SSR cookie sessions                             │
│  - Service-role client (server-only)                        │
│  - Zod validation of all untrusted input                    │
│  - Sanitized Markdown → HTML                                │
└────────────────────────┬────────────────────────────────────┘
                         │ RLS-enforced
                  ┌──────▼───────┐
                  │   Supabase  │
                  │  Postgres +  │
                  │  Auth +      │
                  │  Storage     │
                  └──────────────┘
```

## Key module boundaries

| Path | Responsibility |
|---|---|
| `src/lib/crypto/` | Pure generation math. No React, no network, no I/O. Fully unit-testable. |
| `src/lib/crypto/random.ts` | Unbiased random integer + secure shuffle primitives. |
| `src/lib/crypto/wordlist.ts` | Bundled passphrase word list loader. |
| `src/lib/strength/` | Strength estimation + zxcvbn integration. |
| `src/lib/entropy/` | Entropy math and assumption modelling. |
| `src/lib/supabase/` | Server & browser clients, SSR cookie plumbing. |
| `src/lib/auth/` | Session helpers, role checks, route guards. |
| `src/lib/content/` | Markdown → sanitized HTML, excerpt, slugify. |
| `src/lib/seo/` | Metadata builders, JSON-LD, canonical URL helpers. |
| `src/lib/validation/` | Zod schemas shared by actions and API routes. |
| `src/app/` | Routing only. Business logic lives in `src/lib`. |

## Rendering strategy

| Route type | Strategy |
|---|---|
| Tool pages | Static shell + client component island |
| Guides index / category | ISR, revalidated on publish |
| Guide detail | ISR + `generateStaticParams` for hot articles |
| Admin | Dynamic, `no-store`, never cached publicly |
| Contact form | Route Handler, rate-limited |

Published articles carry an `updated_at`-based revalidation tag. Publishing or
editing a guide calls `revalidateTag`/`revalidatePath` so the public edge cache
invalidates immediately.

## Service role usage (strict)

Service role **bypasses RLS**. It is only permitted in:

- `src/lib/supabase/server-admin.ts` — used by trusted Server Actions after a
  server-side role check.
- Migration/seed tooling.

Never import it into a `"use client"` module. A lint guard rule flags any import
of `server-admin` outside `src/lib/supabase` and `src/app/admin`.

## Environment separation

Three Supabase projects:

1. **local** — `.env.local`
2. **dev/preview** — Vercel Preview env vars
3. **production** — Vercel Production env vars

Production keys are never copied into preview. Migrations are applied by an
explicit, documented `supabase db push` / `supabase migrations apply` step.

## Risks (tracked, not hidden)

- Word list licensing must be verified before bundling (Phase 4).
- zxcvbn dictionary size affects bundle budget; may need lazy loading.
- AdSense/CMP requirements change; re-verify before launch (Phase 9).
- Vercel serverless has no persistent filesystem — uploads go to Supabase Storage.