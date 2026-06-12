-- Phase 1 / M7: form-assets Storage bucket + commission-scoped policies.
--
-- Images referenced by `image` display items live here. Path convention:
--   form-assets/{commission_id}/{...immutable filename...}
-- Access mirrors commission access: members read, staff_admin of that
-- commission uploads. Objects are NEVER overwritten or deleted (Architecture
-- Rule 6) — there are deliberately no UPDATE/DELETE policies for app roles, so
-- every upload must use a fresh path and version cloning copies the reference
-- only. The bucket is private; reads go through signed URLs / the API under
-- these RLS policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'form-assets',
  'form-assets',
  false,
  5242880, -- 5 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- The first path segment is the commission id.
create policy form_assets_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-assets'
    and (
      app.is_admin()
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

create policy form_assets_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'form-assets'
    and (
      app.is_admin()
      or app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- No UPDATE / DELETE policies: form-assets objects are immutable for app roles.
