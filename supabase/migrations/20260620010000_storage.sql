-- ----------------------------------------------------------------------------
-- Consolidated baseline — Storage (private buckets + immutable object policies)
-- ----------------------------------------------------------------------------
-- The schema dump (Workstream 0 source of truth) excludes the storage schema, so
-- the five private buckets and their storage.objects RLS policies are carried
-- here verbatim from the original storage migrations (form-assets 100007,
-- case-documents 092003, meeting-attachments 090004, interview-attachments
-- 091003, nsp-evidence 121201/121301). All buckets are PRIVATE and immutable:
-- there are deliberately NO UPDATE/DELETE policies for app roles (Architecture
-- Rule 6) — every upload uses a fresh path; cloning copies the reference only.
-- This file runs AFTER patient_safety because the nsp-evidence/capa policies
-- reference app.can_read_event / app.can_write_rca / app.can_read_capa /
-- app.is_pqs_writer, which are defined there.

-- ===========================================================================
-- form-assets — image display-item assets. Path {commission_id}/{...}.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'form-assets',
  'form-assets',
  false,
  5242880, -- 5 MiB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

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

-- ===========================================================================
-- case-documents — file-backed case documents. Path {commission_id}/{case_id}/{uuid}.{ext}.
-- ===========================================================================
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

create policy case_documents_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'case-documents'
    and (
      app.is_admin()
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

create policy case_documents_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'case-documents'
    and (
      app.is_admin()
      or app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- ===========================================================================
-- meeting-attachments — file-backed meeting attachments. Path {commission_id}/{meeting_id}/{uuid}.{ext}.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-attachments',
  'meeting-attachments',
  false,
  26214400, -- 25 MiB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do nothing;

create policy meeting_attachments_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-attachments'
    and (
      app.is_admin()
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

create policy meeting_attachments_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meeting-attachments'
    and (
      app.is_admin()
      or app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- ===========================================================================
-- interview-attachments — interview evidence. Path {commission_id}/{interview_id}/{uuid}.{ext}.
-- SELECT keyed on seg [1] (commission); INSERT keyed on seg [2] (interview) via
-- app.can_write_interview so a registered interviewer can upload.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'interview-attachments',
  'interview-attachments',
  false,
  26214400, -- 25 MiB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do nothing;

create policy interview_attachments_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'interview-attachments'
    and (
      app.is_admin()
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

create policy interview_attachments_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'interview-attachments'
    and (
      app.is_admin()
      or app.can_write_interview(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

-- ===========================================================================
-- nsp-evidence — RCA + CAPA evidence (PHI-adjacent). Path nsp-evidence/{event_id}/{rca_id}/{uuid}.{ext}.
-- SELECT keyed on seg [1] (event) via can_read_event; RCA INSERT keyed on seg [2]
-- (rca) via can_write_rca. CAPA reuses the same bucket: SELECT via can_read_capa,
-- INSERT via is_pqs_writer.
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nsp-evidence',
  'nsp-evidence',
  false,
  26214400, -- 25 MiB
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain'
  ]
)
on conflict (id) do nothing;

create policy nsp_evidence_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nsp-evidence'
    and (
      app.is_admin()
      or app.can_read_event(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

create policy nsp_evidence_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nsp-evidence'
    and (
      app.is_admin()
      or app.can_write_rca(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

create policy capa_evidence_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nsp-evidence'
    and (
      app.is_admin()
      or app.can_read_capa(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

create policy capa_evidence_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nsp-evidence'
    and app.is_pqs_writer()
  );
