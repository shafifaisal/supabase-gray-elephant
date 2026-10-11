-- =============================================================================
-- 0004_profile_provisioning.sql
-- Automatically create a public.profiles row when an auth user signs up.
--
-- SECURITY: the new user is ALWAYS granted the least-privileged role
-- ('author'). Privilege escalation happens only via an admin updating the
-- profile, or via trusted server-side code. A user can never self-assign a
-- higher role.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'author',
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Guard rail: if this trigger is ever bypassed, reject an attempt to create a
-- profile with a privileged role unless the caller is already an admin.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> 'author' and not public.is_admin() then
    raise exception 'Only administrators may assign a role other than author'
      using errcode = '42501';
  end if;

  if new.status = 'suspended' and not public.is_admin() then
    raise exception 'Only administrators may suspend an account'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_guard_privileges
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();