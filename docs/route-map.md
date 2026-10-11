# Route Map

## Public

| Route | Rendering | Access |
|---|---|---|
| `/` | Static | public |
| `/tools` | Static | public |
| `/password-generator` | Static + client island | public |
| `/passphrase-generator` | Static + client island | public |
| `/password-strength-checker` | Static + client island | public |
| `/password-entropy-calculator` | Static + client island | public |
| `/random-string-generator` | Static + client island | public |
| `/guides` | ISR | public (published only) |
| `/guides/[slug]` | ISR | public — drafts return **404** |
| `/guides/category/[slug]` | ISR | public (published only) |
| `/about` | Static | public |
| `/contact` | Static + action | public |
| `/privacy-policy` | Static | public |
| `/terms` | Static | public |
| `/cookie-policy` | Static | public |
| `/sitemap.xml` | Dynamic, cached | public |
| `/robots.txt` | Dynamic | public |

Legal pages are CMS-editable (slug-pinned) so text stays accurate.

## Admin (all `no-store`, session-guarded)

| Route | Min role |
|---|---|
| `/admin` | author |
| `/admin/articles` | author |
| `/admin/articles/new` | author |
| `/admin/articles/[id]/edit` | author (owner) / editor+ |
| `/admin/categories` | editor |
| `/admin/tags` | editor |
| `/admin/media` | author |
| `/admin/users` | admin |
| `/admin/settings` | admin |
| `/admin/seo` | admin |
| `/admin/audit-logs` | admin |
| `/login` | public (redirects to `/admin` when signed in) |
| `/auth/confirm` | public callback |
| `/auth/reset-password` | public |

## HTTP status policy

- Draft/archived/unknown article → **404** (don't leak existence).
- Unauthenticated `/admin/*` → redirect to `/login` (or 401 for API routes).
- Insufficient role → **403**.
- Unknown route → 404 with branded page.
- Suspended profile → 403 + audit log.

## API / actions

- `POST /api/contact` — rate-limited submission.
- `POST /api/revalidate` — on-demand ISR revalidation (secret-verified).
- Server Actions for all admin mutations, each with a Zod schema and role check.
- `GET /api/ads/config` — public ad slots (only when enabled).