-- =============================================================================
-- 0012_add_contact_mobile.sql
-- Adds an optional mobile number to contact messages so the contact form can
-- offer a phone callback. Additive and non-destructive: the column is nullable,
-- so existing rows are unaffected.
-- =============================================================================

alter table public.contact_messages
  add column if not exists mobile text;

alter table public.contact_messages
  drop constraint if exists contact_messages_mobile_check;

alter table public.contact_messages
  add constraint contact_messages_mobile_check
  check (mobile is null or char_length(mobile) between 1 and 30);

comment on column public.contact_messages.mobile is
  'Optional contact phone number supplied by the visitor.';
