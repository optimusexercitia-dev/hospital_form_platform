-- Phase 11 / B2 (4 of 4): interview-attachments Storage bucket + object policies.
--
-- File-backed interview evidence (signed transcripts, scanned documents, slide
-- decks). Clones the meeting-attachments / case-documents bucket: PRIVATE, objects
-- NEVER overwritten or deleted (Architecture Rule 6) — no UPDATE/DELETE policies,
-- so every upload uses a fresh path and a soft-deleted case_interview_attachments
-- row leaves its object in place. Reads go through signed URLs.
--
-- 25 MiB cap + the case-documents MIME allow-list (PDF, common images, Word/Excel/
-- PowerPoint, CSV, plain text). **NO audio MIME types** — audio recordings are
-- linked by external_url (resolved decision 8), never uploaded as bytes.
--
-- Path convention (the upload action mints it):
--   interview-attachments/{commission_id}/{interview_id}/{uuid}.{ext}
-- so (storage.foldername(name))[1] is the commission id (the READ boundary) and
-- (storage.foldername(name))[2] is the interview id (the WRITE boundary — the key
-- difference from meetings, where INSERT keyed on the commission with
-- is_staff_admin_of). INSERT keys on [2] so a REGISTERED INTERVIEWER — even a
-- plain staff member who can_write_interview — can upload evidence, matching the
-- participant write grant.

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

-- SELECT: the first path segment is the commission id (members of that commission read).
create policy interview_attachments_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'interview-attachments'
    and (
      app.is_admin()
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- INSERT: keyed on the SECOND path segment (interview_id) via app.can_write_interview,
-- so a registered interviewer (not just staff_admin) can upload. The server action
-- mints the path in the exact {commission}/{interview}/{uuid} shape.
create policy interview_attachments_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'interview-attachments'
    and (
      app.is_admin()
      or app.can_write_interview(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

-- No UPDATE / DELETE policies: interview-attachments objects are immutable for app
-- roles (Rule 6). An attachment "delete" is a SOFT delete on the metadata row;
-- the object stays.
