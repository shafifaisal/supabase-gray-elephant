-- =============================================================================
-- 0003_rls_and_policies.sql
-- Row Level Security for every exposed table.
--
-- Design rules:
--  * Helper functions are SECURITY DEFINER + STABLE with a locked search_path,
--    so they cannot be hijacked via object shadowing.
--  * Public access to articles is limited to rows that are published, not
--    noindex-hidden by policy, and whose publish time has arrived.
--  * Roles are resolved from public.profiles, never from client input.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Privilege helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_account_status()
returns public.account_status
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() in ('admin', 'editor'), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role() in ('admin', 'editor', 'author'), false);
$$;

-- Authors may edit only their own draft/in_review articles.
-- Editors and admins may edit any article.
create or replace function public.can_edit_article(_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_editor()
    or exists (
      select 1
      from public.articles a
      where a.id = _article_id
        and a.author_id = auth.uid()
        and a.status in ('draft', 'in_review')
    );
$$;

-- A revision is visible to staff who can edit its parent article.
create or replace function public.can_view_revision(_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_editor()
    or exists (
      select 1
      from public.articles a
      where a.id = _article_id
        and a.author_id = auth.uid()
    );
$$;

comment on function public.current_role() is
  'Role of the authenticated user, resolved server-side from public.profiles. '
  'Never trust a role supplied by the client.';

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.tags              enable row level security;
alter table public.media             enable row level security;
alter table public.articles          enable row level security;
alter table public.article_tags      enable row level security;
alter table public.article_revisions enable row level security;
alter table public.site_settings     enable row level security;
alter table public.redirects         enable row level security;
alter table public.audit_logs        enable row level security;
alter table public.contact_messages  enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Users may read their own row; editors/admins may read all.
create policy "profiles_select_own_or_staff"
  on public.profiles for select
  using (id = auth.uid() or public.is_editor());

-- Users may update only their own non-privileged fields. The role and status
-- columns are pinned to their current values, so a user cannot self-promote.
create policy "profiles_update_own_safe_fields"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_role()
    and status = public.current_account_status()
  );

-- Admins manage the full profile set, including role changes.
create policy "profiles_admin_all"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- No client-side inserts/deletes: profiles are provisioned by trusted code.

-- ---------------------------------------------------------------------------
-- categories & tags — publicly readable, editor-managed
-- ---------------------------------------------------------------------------

create policy "categories_public_read"
  on public.categories for select
  using (true);

create policy "categories_editor_write"
  on public.categories for all
  using (public.is_editor())
  with check (public.is_editor());

create policy "tags_public_read"
  on public.tags for select
  using (true);

create policy "tags_editor_write"
  on public.tags for all
  using (public.is_editor())
  with check (public.is_editor());

-- ---------------------------------------------------------------------------
-- articles
-- ---------------------------------------------------------------------------

-- Public: only live, published, indexable articles.
create policy "articles_public_read_published"
  on public.articles for select
  using (
    status = 'published'
    and not is_noindex
    and published_at is not null
    and published_at <= now()
  );

-- Staff: authors see their own work (any status), editors/admins see all.
create policy "articles_staff_read"
  on public.articles for select
  using (
    public.is_editor()
    or (author_id = auth.uid() and public.is_staff())
  );

-- Authors may create drafts owned by themselves.
create policy "articles_insert_author"
  on public.articles for insert
  with check (
    public.is_staff()
    and author_id = auth.uid()
    and status in ('draft', 'in_review')
  );

create policy "articles_update_authorized"
  on public.articles for update
  using (public.can_edit_article(id))
  with check (public.can_edit_article(id));

-- Only admins delete content, and never via the client surface directly.
create policy "articles_admin_delete"
  on public.articles for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- article_tags — readable when the parent article is readable
-- ---------------------------------------------------------------------------

create policy "article_tags_public_read"
  on public.article_tags for select
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_tags.article_id
        and a.status = 'published'
        and not a.is_noindex
        and a.published_at is not null
        and a.published_at <= now()
    )
    or public.is_staff()
  );

create policy "article_tags_manage"
  on public.article_tags for all
  using (public.can_edit_article(article_id))
  with check (public.can_edit_article(article_id));

-- ---------------------------------------------------------------------------
-- article_revisions — never public, append-only
-- ---------------------------------------------------------------------------

create policy "article_revisions_staff_read"
  on public.article_revisions for select
  using (public.can_view_revision(article_id));

create policy "article_revisions_staff_insert"
  on public.article_revisions for insert
  with check (public.can_edit_article(article_id));

-- No update/delete policy: revisions are immutable by design.

-- ---------------------------------------------------------------------------
-- media — public visibility only
-- ---------------------------------------------------------------------------

-- Anonymous visitors see only public assets; staff additionally see private ones.
create policy "media_public_read"
  on public.media for select
  using (visibility = 'public' or public.is_staff());

create policy "media_staff_insert"
  on public.media for insert
  with check (public.is_staff() and uploaded_by = auth.uid());

create policy "media_staff_update"
  on public.media for update
  using (public.is_staff())
  with check (public.is_staff());

create policy "media_admin_delete"
  on public.media for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- site_settings — public keys only
-- ---------------------------------------------------------------------------

create policy "site_settings_public_read"
  on public.site_settings for select
  using (not is_secret or public.is_admin());

create policy "site_settings_admin_write"
  on public.site_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- redirects — public read so the middleware can resolve them
-- ---------------------------------------------------------------------------

create policy "redirects_public_read"
  on public.redirects for select
  using (is_active);

create policy "redirects_admin_write"
  on public.redirects for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_logs — admins read, staff may append. Never updatable/deletable.
-- ---------------------------------------------------------------------------

create policy "audit_logs_admin_read"
  on public.audit_logs for select
  using (public.is_admin());

create policy "audit_logs_staff_insert"
  on public.audit_logs for insert
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- contact_messages — anonymous insert, staff read, admin update.
-- ---------------------------------------------------------------------------

create policy "contact_messages_public_insert"
  on public.contact_messages for insert
  with check (true);

create policy "contact_messages_staff_read"
  on public.contact_messages for select
  using (public.is_editor());

create policy "contact_messages_admin_update"
  on public.contact_messages for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "contact_messages_admin_delete"
  on public.contact_messages for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants: give each role only what it needs.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant usage on schema public to service_role;

grant select on public.categories, public.tags to anon, authenticated;
grant select on public.articles, public.article_tags to anon, authenticated;
grant select on public.media to anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant select on public.redirects to anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.categories, public.tags to authenticated;
grant select, insert, update, delete on public.media to authenticated;
grant select, insert, update, delete on public.articles to authenticated;
grant select, insert, update, delete on public.article_tags to authenticated;
grant select, insert on public.article_revisions to authenticated;
grant select, insert, update, delete on public.site_settings to authenticated;
grant select, insert, update, delete on public.redirects to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select, insert, update, delete on public.contact_messages to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;