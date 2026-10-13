-- =============================================================================
-- 0013_grant_contact_message_delete.sql
--
-- WHY THIS MIGRATION EXISTS
-- ------------------------
-- 0006_harden_grants.sql stripped the broad default ACLs and re-granted only
-- `select, update` on public.contact_messages to authenticated. Migration 0003
-- had already created the `contact_messages_admin_delete` RLS policy, but a
-- table-level DELETE grant is required before RLS is ever consulted — without
-- it, PostgREST returns "permission denied for table contact_messages" and the
-- admin inbox delete fails.
--
-- This restores the DELETE privilege so the existing, admin-only RLS policy can
-- do its job. Authorization is still enforced by RLS (`is_admin()`), not by the
-- grant; the grant only makes the operation reachable.
-- =============================================================================

grant delete on public.contact_messages to authenticated;
