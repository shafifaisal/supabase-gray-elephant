-- =============================================================================
-- 0007_bootstrap_admin.sql
--
-- Creates the FIRST administrator without weakening the escalation guard.
--
-- WHY: guard_profile_privileges (0004) rejects any non-'author' role unless
-- public.is_admin() is true. That is correct for every request-scoped
-- context, but it means a brand-new project has no way to bootstrap its first
-- admin — a chicken-and-egg problem.
--
-- SOLUTION: a narrowly-scoped, explicitly-called function that promotes a
-- given auth user to admin. It is:
--   * SECURITY DEFINER, so it runs as the table owner and bypasses RLS.
--   * NOT granted to anon or authenticated — it is only ever callable with the
--     service_role key from trusted server-side tooling.
--   * Idempotent and auditable.
--
-- It must NEVER be exposed to a client bundle. See scripts/bootstrap-admin.mjs.
-- =============================================================================

create or replace function public.promote_to_admin(_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  -- Only allow a role assignment that would otherwise be blocked.
  if public.is_admin() then
    raise exception 'Use the regular admin flow instead';
  end if;

  update public.profiles
  set role = 'admin'
  where id = _user_id
  returning * into result;

  if result.id is null then
    raise exception 'No profile found for user %', _user_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after_state)
  values (
    null,
    'bootstrap.admin_promoted',
    'profile',
    _user_id::text,
    jsonb_build_object('role', 'admin', 'method', 'promote_to_admin')
  );

  return result;
end;
$$;

revoke all on function public.promote_to_admin(uuid) from public;
revoke all on function public.promote_to_admin(uuid) from anon, authenticated;
grant execute on function public.promote_to_admin(uuid) to service_role;

comment on function public.promote_to_admin(uuid) is
  'Bootstrap-only: promote a user to administrator. Callable exclusively with '
  'the service_role key from trusted server-side tooling. Never expose to a client.';