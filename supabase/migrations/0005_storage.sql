-- =============================================================================
-- 0005_storage.sql
-- Supabase Storage buckets and object-level policies.
--
-- Reminder: uploaded files go to Storage because Vercel serverless functions
-- have no persistent local filesystem.
-- =============================================================================

-- Public bucket for article images served through the Next.js image optimizer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml', 'image/gif']
)
on conflict (id) do nothing;

-- Private bucket for draft/preview assets that must not be world-readable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-private',
  'media-private',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;

-- Anyone may read the public bucket (the site needs public images).
create policy "storage_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

-- Staff may upload to either bucket; path is scoped under the user's id so a
-- user cannot overwrite another user's uploads.
create policy "storage_staff_insert"
  on storage.objects for insert
  with check (
    bucket_id in ('media', 'media-private')
    and public.is_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_staff_update"
  on storage.objects for update
  using (
    bucket_id in ('media', 'media-private')
    and public.is_staff()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_staff_delete"
  on storage.objects for delete
  using (
    bucket_id in ('media', 'media-private')
    and public.is_editor()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Private assets are readable only by staff.
create policy "storage_private_staff_read"
  on storage.objects for select
  using (bucket_id = 'media-private' and public.is_staff());