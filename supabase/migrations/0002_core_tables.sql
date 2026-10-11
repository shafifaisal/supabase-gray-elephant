-- =============================================================================
-- 0002_core_tables.sql
-- Content, taxonomy, media, settings, redirects, contact and audit tables.
--
-- NOTE: there is intentionally NO table for generated passwords, passphrases
-- or strength-checker input. Those never leave the browser.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users. `role` is deliberately NOT user-writable.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role public.app_role not null default 'author',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Administrative user metadata. The role column is writable only by admins or '
  'trusted server-side code; users can never self-assign a role.';

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_position_idx on public.categories (position);

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- media: metadata only. Binary data lives in Supabase Storage.
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  bucket text not null default 'media',
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  width integer,
  height integer,
  alt_text text,
  visibility public.media_visibility not null default 'public',
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index media_uploaded_by_idx on public.media (uploaded_by);
create index media_visibility_idx on public.media (visibility);

-- ---------------------------------------------------------------------------
-- articles
-- ---------------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body_md text not null default '',
  body_html text not null default '',
  status public.article_status not null default 'draft',
  author_id uuid references public.profiles (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  featured_image_id uuid references public.media (id) on delete set null,
  seo_title text,
  meta_description text,
  canonical_url text,
  og_title text,
  og_description text,
  og_image_id uuid references public.media (id) on delete set null,
  is_noindex boolean not null default false,
  scheduled_for timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A published article must have a publication date; drafts must not need one.
  constraint articles_published_at_check check (
    status <> 'published' or published_at is not null
  ),
  -- Scheduled articles must declare when they go live.
  constraint articles_scheduled_for_check check (
    status <> 'scheduled' or scheduled_for is not null
  )
);

create index articles_status_idx on public.articles (status);
create index articles_published_at_idx on public.articles (published_at desc);
create index articles_author_id_idx on public.articles (author_id);
create index articles_category_id_idx on public.articles (category_id);
create index articles_slug_idx on public.articles (slug);

-- ---------------------------------------------------------------------------
-- article_tags
-- ---------------------------------------------------------------------------
create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (article_id, tag_id)
);

create index article_tags_tag_id_idx on public.article_tags (tag_id);

-- ---------------------------------------------------------------------------
-- article_revisions: immutable history, append-only
-- ---------------------------------------------------------------------------
create table public.article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  revision_number integer not null,
  title text not null,
  excerpt text,
  body_md text not null default '',
  body_html text not null default '',
  status public.article_status not null default 'draft',
  change_note text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  unique (article_id, revision_number)
);

create index article_revisions_article_idx on public.article_revisions (article_id);

-- ---------------------------------------------------------------------------
-- site_settings
-- ---------------------------------------------------------------------------
create table public.site_settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  is_secret boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.site_settings is
  'Site configuration. Rows with is_secret = true are NEVER exposed to the '
  'public. Credentials and integration secrets must live in environment '
  'variables, not here.';

-- ---------------------------------------------------------------------------
-- redirects
-- ---------------------------------------------------------------------------
create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  status_code smallint not null default 308 check (status_code in (301, 308)),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_logs: append-only
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);

-- ---------------------------------------------------------------------------
-- contact_messages
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null check (char_length(subject) between 1 and 200),
  message text not null check (char_length(message) between 1 and 5000),
  status public.contact_status not null default 'new',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index contact_messages_status_idx on public.contact_messages (status);
create index contact_messages_created_at_idx on public.contact_messages (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();