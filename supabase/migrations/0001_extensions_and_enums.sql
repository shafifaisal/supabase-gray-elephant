-- =============================================================================
-- 0001_extensions_and_enums.sql
-- Extensions and shared enums for iPassGenerator.
-- =============================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- Enums are created with IF NOT EXISTS semantics so migrations stay re-runnable.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'editor', 'author');
  end if;

  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'invited', 'suspended');
  end if;

  if not exists (select 1 from pg_type where typname = 'article_status') then
    create type public.article_status as enum (
      'draft', 'in_review', 'scheduled', 'published', 'archived'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'media_visibility') then
    create type public.media_visibility as enum ('public', 'private');
  end if;

  if not exists (select 1 from pg_type where typname = 'contact_status') then
    create type public.contact_status as enum ('new', 'read', 'archived');
  end if;
end
$$;