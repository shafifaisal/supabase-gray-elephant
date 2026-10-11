# Database Schema

All changes are applied via checked-in SQL migrations in `supabase/migrations/`.
Never make undocumented manual changes to a database.

## Enums

- `app_role`: `admin` | `editor` | `author`
- `account_status`: `active` | `invited` | `suspended`
- `article_status`: `draft` | `in_review` | `scheduled` | `published` | `archived`
- `media_visibility`: `public` | `private`
- `contact_status`: `new` | `read` | `archived`

## Tables

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | Admin/staff metadata | `id` = `auth.users.id`; role is **not** user-writable |
| `categories` | Guide categories | public read |
| `tags` | Guide tags | public read |
| `articles` | Guide content | slug unique; status drives visibility |
| `article_tags` | Many-to-many join | composite PK |
| `article_revisions` | Immutable history | insert-only |
| `media` | Uploaded asset metadata | Storage path only, never raw bytes in DB |
| `site_settings` | Key/value config | `is_secret` rows never exposed publicly |
| `redirects` | Managed 301/308 | |
| `audit_logs` | Admin action trail | append-only |
| `contact_messages` | Form submissions | protected from public read |

> **No table exists for generated passwords, passphrases or checked passwords.**
> This is an intentional architectural rule.

## Privilege helper functions (SECURITY DEFINER)

`profiles.role` lives outside RLS-protected self-edit, so helpers resolve the
current user server-side:

- `public.current_role()` → role of `auth.uid()`
- `public.is_admin()`, `public.is_editor()`, `public.is_staff()`
- `public.can_edit_article(_article_id)` → author owns draft, or editor/admin

## RLS summary

| Table | Public | Author | Editor | Admin |
|---|---|---|---|---|
| articles | published only | own drafts | all | all |
| categories/tags | read | – | write | write |
| article_revisions | none | own articles | all | all |
| media | public visibility | own uploads | all | all |
| site_settings | public non-secret keys | – | – | write |
| audit_logs | none | – | read | read |
| contact_messages | insert only | – | read | read/update |
| profiles | own row | own non-role fields | read | all |

`profiles.role` can only be changed by an admin — enforced by policy, not by the UI.

## Deletion behaviour

- `articles.author_id` → `ON DELETE SET NULL` (never delete content with a user)
- `articles.category_id` → `ON DELETE SET NULL`
- `article_tags` / joins → `CASCADE`
- `audit_logs` → `ON DELETE SET NULL` for actor, retained for history

## Migrations

Applied in filename order. Flow:

```bash
supabase db push                      # local
supabase db push --linked            # dev / preview
supabase db push --linked            # production (with explicit approval)
```

Backups: Supabase automated daily backups + PITR on paid tiers. Restore and
recovery steps documented in `docs/deployment.md`.