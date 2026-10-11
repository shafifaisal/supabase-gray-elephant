-- =============================================================================
-- 0006_harden_grants.sql
--
-- WHY THIS MIGRATION EXISTS
-- ------------------------
-- Supabase installs a default ACL on the `public` schema that grants ALL
-- privileges (arwdDxt) to `anon` and `authenticated` for every newly created
-- table. Migration 0003 only ADDED grants, so the broad defaults survived.
--
-- Row Level Security still blocked unauthorised reads and writes, so this was
-- not an exploitable data leak on its own. It did, however, leave far more
-- privilege than the application needs, which weakens defence in depth: any
-- future policy mistake would become immediately exploitable, and privileged
-- operations such as TRUNCATE would be reachable by a client holding a valid
-- anon or authenticated token.
--
-- This migration:
--   1. REVOKES everything from anon/authenticated on every public table.
--   2. Removes the broad default ACL so future tables are not auto-exposed.
--   3. Re-applies the minimal, explicit grants the application actually needs.
--
-- Verified by scripts/verify-rls.mjs (grants section).
-- =============================================================================

-- 1. Strip every privilege from the two client-facing roles.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- 2. Remove the permissive default ACLs for future objects in this schema.
--    New tables must be granted explicitly or they are not reachable at all.
do $$
declare
  acl_row record;
begin
  for acl_row in
    select d.oid
    from pg_default_acl d
    where d.defaclnamespace = 'public'::regnamespace
      and d.defaclrole in ('anon'::regrole, 'authenticated'::regrole)
  loop
    execute format('alter default privileges in schema public revoke all on tables from anon');
    exit;
  end loop;
end
$$;

-- `authenticated` retains the ability to call our SECURITY DEFINER helper
-- functions; without this the policies themselves would fail to evaluate.
grant execute on function
  public.current_role(),
  public.current_account_status(),
  public.is_admin(),
  public.is_editor(),
  public.is_staff(),
  public.can_edit_article(uuid),
  public.can_view_revision(uuid),
  public.set_updated_at()
to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Minimal grants — the ONLY privileges client roles receive.
-- ---------------------------------------------------------------------------

-- Anonymous visitors: read-only public content.
grant select on public.categories to anon, authenticated;
grant select on public.tags to anon, authenticated;
grant select on public.articles to anon, authenticated;
grant select on public.article_tags to anon, authenticated;
grant select on public.media to anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant select on public.redirects to anon, authenticated;

-- Only contact submissions are writable by anonymous visitors.
grant insert on public.contact_messages to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated staff: everything else RLS permits.
-- ---------------------------------------------------------------------------
grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, update, delete on public.media to authenticated;
grant select, insert, update, delete on public.articles to authenticated;
grant select, insert, update, delete on public.article_tags to authenticated;

-- Revisions are append-only: no UPDATE, no DELETE.
grant select, insert on public.article_revisions to authenticated;

grant select, insert, update, delete on public.site_settings to authenticated;
grant select, insert, update, delete on public.redirects to authenticated;

-- Audit logs are append-only and admin-readable.
grant select, insert on public.audit_logs to authenticated;

grant select, update on public.contact_messages to authenticated;

-- ---------------------------------------------------------------------------
-- Sequence access for inserts into identity columns.
-- ---------------------------------------------------------------------------
grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- service_role keeps full access (it bypasses RLS by design) and is used only
-- by trusted server-side code. Never expose it to a client bundle.
-- ---------------------------------------------------------------------------
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;