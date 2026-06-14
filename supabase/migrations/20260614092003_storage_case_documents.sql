-- Cases-Extras batch / R1: case-documents Storage bucket + commission-scoped
-- policies.
--
-- File-backed case documents (R1, 092002) live here. Clones the form-assets
-- bucket (20260612100007): PRIVATE, commission-scoped RLS via the first path
-- segment, objects NEVER overwritten or deleted (Architecture Rule 6) — no
-- UPDATE/DELETE policies, so every upload uses a fresh path and a soft-deleted
-- case_documents row leaves its object in place. Reads go through signed URLs.
--
-- Path convention (the action mints it):
--   case-documents/{commission_id}/{case_id}/{uuid}.{ext}
-- so (storage.foldername(name))[1] is the commission id — the same RLS idiom as
-- form-assets. The {case_id} segment is for human/debug navigation only; the
-- security boundary is the commission folder.
--
-- Differences from form-assets: a larger 25 MiB cap and a broader MIME allow-list
-- (PDF, common images, Word/Excel, CSV, plain text) — minutes, scans, registries.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-documents',
  'case-documents',
  false,
  26214400, -- 25 MiB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- The first path segment is the commission id (members of that commission read).
create policy case_documents_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'case-documents'
    and (
      app.is_admin()
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- staff_admin of the commission uploads (INSERT only).
create policy case_documents_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'case-documents'
    and (
      app.is_admin()
      or app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- No UPDATE / DELETE policies: case-documents objects are immutable for app roles
-- (Rule 6). A document "delete" is a SOFT delete on the metadata row (092002);
-- the object stays.
