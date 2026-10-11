-- =============================================================================
-- 0009_deterministic_privilege_guard.sql
--
-- Replaces the GUC-based service-role detection introduced in 0008 with a
-- deterministic mechanism, and removes the temporary diagnostic helper.
--
-- WHY CHANGE
-- ----------
-- 0008 checked `current_setting('request.jwt.claim.role')`. On this Supabase
-- deployment no `request.*` GUC is visible to the SECURITY DEFINER function,
-- so the check always failed and even the legitimate bootstrap path was
-- blocked.
--
-- NEW APPROACH
-- ------------
-- The guard stays STRICT and the trusted server-side function temporarily
-- disables the trigger while performing the single update. This is
-- deterministic and safe:
--
--   * `alter table ... disable trigger` requires table ownership. The function
--     is SECURITY DEFINER and owned by postgres, so it holds that right; a
--     client (anon/authenticated) does not and therefore cannot disable it.
--   * The trigger is re-enabled in an EXCEPTION block, so it can never be left
--     disabled by an error partway through.
--   * Only set_profile_role() does this, and it is granted to service_role
--     exclusively.
-- =============================================================================

-- Restore the strict guard: no service-role special case.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Default rows need no privilege check.
  if new.role = 'author' and new.status = 'active' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  raise exception 'Only administrators may assign a role other than author'
    using errcode = '42501';
end;
$$;

revoke all on function public.guard_profile_privileges() from public;
grant execute on function public.guard_profile_privileges() to service_role;

-- -----------------------------------------------------------------------------
-- Deterministic server-side role assignment.
--
-- Grants an arbitrary application role. Restricted to service_role, so a caller
-- may safely request 'author' as well (RLS refuses to let any client do that).
--
-- Escalation rules enforced here:
--   * Promoting someone TO admin requires an existing admin, EXCEPT when no
--     administrator exists at all — that is the initial bootstrap.
--   * Demoting or re-assigning an existing admin always requires an admin.
-- -----------------------------------------------------------------------------
create or replace function public.set_profile_role(
  _user_id uuid,
  _role public.app_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
  previous_role public.app_role;
  admin_count integer;
begin
  select role into previous_role
  from public.profiles
  where id = _user_id;

  if previous_role is null then
    raise exception 'No profile found for user %', _user_id
      using errcode = 'no_data_found';
  end if;

  select count(*) into admin_count
  from public.profiles
  where role = 'admin';

  -- Touching admin privileges requires authorisation.
  if _role = 'admin' or previous_role = 'admin' then
    if not public.is_admin() then
      -- Allow only the bootstrap case: no admin exists yet AND we are
      -- creating the first one (not demoting an existing admin).
      if admin_count > 0 or _role <> 'admin' or previous_role = 'admin' then
        raise exception
          'Only administrators may change administrator roles'
          using errcode = '42501';
      end if;
    end if;
  end if;

  -- Bypass our own guard for exactly one statement. Re-enabled always.
  alter table public.profiles disable trigger profiles_guard_privileges;

  begin
    update public.profiles
    set role = _role
    where id = _user_id
    returning * into result;

    if result.id is null then
      raise exception 'No profile found for user %', _user_id
        using errcode = 'no_data_found';
    end if;
  exception
    when others then
      -- Always restore the guard, even if the update failed.
      alter table public.profiles enable trigger profiles_guard_privileges;
      raise;
  end;

  alter table public.profiles enable trigger profiles_guard_privileges;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_state, after_state
  )
  values (
    null,
    'profile.role_changed',
    'profile',
    _user_id::text,
    jsonb_build_object('role', previous_role),
    jsonb_build_object('role', _role, 'via', 'set_profile_role')
  );

  return result;
end;
$$;

revoke all on function public.set_profile_role(uuid, public.app_role)
  from public, anon, authenticated;
grant execute on function public.set_profile_role(uuid, public.app_role)
  to service_role;

comment on function public.set_profile_role(uuid, public.app_role) is
  'Server-side only. Sets an application role using the service_role key. '
  'Bootstrap-safe: the first administrator can be created when none exists.';

-- Superseded by set_profile_role().
revoke all on function public.promote_to_admin(uuid)
  from public, anon, authenticated;
drop function if exists public.promote_to_admin(uuid);

-- Remove the temporary diagnostic helper added during debugging.
drop function if exists public.debug_jwt_context();