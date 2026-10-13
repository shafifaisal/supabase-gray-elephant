# Database Schema

All changes are applied via checked-in SQL migrations in `supabase/migrations/`.
Never make undocumented manual changes to a database.

## Applying migrations

```bash
# local / development
node --env-file=.env.local scripts/migrate.mjs

# see what is applied vs pending
node --env-file=.env.local scripts/migrate.mjs --status
```

The runner wraps each file in a transaction and records it in
`public.schema_migrations`, so re-runs are idempotent. A failed file is rolled
back and the run stops.

## Migrations

| File | Purpose |
|---|---|
| `0001_extensions_and_enums.sql` | pgcrypto + the five enums |
| `0002_core_tables.sql` | 11 tables, constraints, indexes, `updated_at` triggers |
| `0003_rls_and_policies.sql` | RLS on every table, privilege helpers, policies, grants |
| `0004_profile_provisioning.sql` | Auto-profile on signup + privilege guard |
| `0005_storage.sql` | `media` (public) and `media-private` buckets + object policies |
| `0006_harden_grants.sql` | Revoke Supabase's default `ALL` grants; apply least privilege |
| `0007_bootstrap_admin.sql` | Initial (superseded) admin bootstrap function |
| `0008_fix_privilege_guard_for_service_role.sql` | GUC-based guard (superseded by 0009) |
| `0009_deterministic_privilege_guard.sql` | `set_profile_role()`; strict guard restored |
| `0010_fix_author_self_publish.sql` | Closes the author self-publish vulnerability |

> 0007 and 0008 are superseded but retained so the history of an already-migrated
> database remains reproducible. Do not edit an applied migration — add a new one.

## Enums

- `app_role`: `admin` | `editor` | `author`
- `account_status`: `active` | `invited` | `suspended`
- `article_status`: `draft` | `in_review` | `scheduled` | `published` | `archived`
- `media_visibility`: `public` | `private`
- `contact_status`: `new` | `read` | `archived`

## Tables

| Table | Purpose | Notes |
|---|---|---|
| `profiles` | Staff metadata | `id` = `auth.users.id`; role is not user-writable |
| `categories` | Guide categories | public read |
| `tags` | Guide tags | public read |
| `articles` | Guide content | slug unique; status drives visibility |
| `article_tags` | Join table | composite PK |
| `article_revisions` | Immutable history | append-only, no UPDATE/DELETE policy |
| `media` | Asset metadata | Storage path only |
| `site_settings` | Key/value config | `is_secret` rows never public |
| `redirects` | Managed 301/308 | public read |
| `audit_logs` | Admin trail | append-only, admin-readable |
| `contact_messages` | Form submissions | anon insert, staff read |

> **No table stores generated passwords, passphrases or checked passwords.**

## Privilege helpers

`SECURITY DEFINER` + `STABLE` + `search_path = ''`:

- `current_role()`, `current_account_status()`
- `is_admin()`, `is_editor()`, `is_staff()`
- `can_edit_article(uuid)`, `can_view_revision(uuid)`

## Role assignment

`set_profile_role(user_id, role)` — service-role only, never granted to
`anon`/`authenticated`. It temporarily disables the privilege-guard trigger
(requires table ownership, which clients do not have) and always re-enables it
in an `EXCEPTION` block.

Bootstrap rule: the first administrator may be created when none exists;
afterwards, promoting to or demoting from `admin` requires an active admin.

```bash
node --env-file=.env.local scripts/set-role.mjs user@example.com admin
```

## RLS summary

| Table | Public | Author | Editor | Admin |
|---|---|---|---|---|
| articles | published, not noindex, `published_at <= now()` | own drafts | all | all |
| categories / tags | read | – | write | write |
| article_revisions | none | own articles | read + append | read + append |
| media | `visibility = 'public'` | own uploads | all | all |
| site_settings | non-secret keys | – | – | write |
| audit_logs | none | append | none | read |
| contact_messages | insert only | – | read | read/update/delete |
| profiles | own row (role pinned) | own safe fields | read | all |

## Guards (defence in depth)

- `guard_profile_privileges` — non-author roles require an admin.
- `guard_article_authorship` — only editors may reassign authorship, change
  `is_noindex`, or set `published_at`.
- `assert_publish_requires_editor` — the invariant that makes author
  self-publishing impossible.

## Deletion behaviour

- `articles.author_id` → `ON DELETE SET NULL` (content survives user deletion)
- `articles.category_id` → `ON DELETE SET NULL`
- join tables → `ON DELETE CASCADE`
- `audit_logs.actor_id` → `ON DELETE SET NULL` (history retained)

## Verification

```bash
node --env-file=.env.local scripts/verify-rls.mjs    # structure, grants, policies
node --env-file=.env.local scripts/verify-auth.mjs   # 39 live role/RLS assertions
```

Run against a test project, never production.

## Backups

Supabase automated daily backups plus point-in-time recovery on paid tiers.
Restore procedure is documented in `docs/deployment.md`.