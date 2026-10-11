-- =============================================================================
-- 0008_fix_privilege_guard_for_service_role.sql
--
-- ISSUE
-- -----
-- guard_profile_privileges (0004) allowed a role change only when
-- public.is_admin() was true. is_admin() reads auth.uid(), which is NULL for
-- service-role requests, so the guard also blocked the legitimate
-- promote_to_admin() bootstrap path — leaving a new project unable to create
-- its first administrator.
--
-- FIX
-- ---
-- Recognise the `role` claim from the VERIFIED Supabase JWT. A client cannot
-- forge this value: it is signed by Supabase, and holding only the anon/
-- publishable key yields a token whose role claim is "anon".
--
-- Defence in depth is preserved because the RLS policy
-- profiles_update_own_safe_fields independently pins role/status to the
-- caller's current values on self-update. Even if the GUC were spoofable, the
-- policy WITH CHECK would still reject a self-promotion.
-- =============================================================================

create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'author' and new.status <> 'suspended' then
    return new;
  end if;

  -- Trusted server-side context (signed service_role JWT), or an admin.
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  raise exception 'Only administrators may assign a role other than author'
    using errcode = '42501';
end;
$$;

revoke all on function public.guard_profile_privileges() from public;
grant execute on function public.guard_profile_privileges() to service_role;

-- Re-grant execute on the helper functions the policies depend on.
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