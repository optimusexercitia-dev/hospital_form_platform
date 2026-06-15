-- Phase 10 / B2: meeting-attachments Storage bucket + policies + the
-- meeting_attachments metadata table + its RLS.
--
-- File-backed meeting attachments (pauta, apresentação, literatura, lista de
-- presença, ata assinada, outro). Clones the case-documents bucket
-- (20260614092003): PRIVATE, commission-scoped RLS via the first path segment,
-- objects NEVER overwritten or deleted (Architecture Rule 6) — no UPDATE/DELETE
-- policies, so every upload uses a fresh path and a soft-deleted
-- meeting_attachments row leaves its object in place. Reads go through signed
-- URLs.
--
-- Path convention (the upload action mints it):
--   meeting-attachments/{commission_id}/{meeting_id}/{uuid}.{ext}
-- so (storage.foldername(name))[1] is the commission id — the same RLS idiom as
-- case-documents. The {meeting_id} segment is for human/debug navigation only;
-- the security boundary is the commission folder.
--
-- 25 MiB cap + the case-documents MIME allow-list (PDF, common images,
-- Word/Excel, CSV, plain text) — minutes scans, slide decks, attendance sheets.

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

-- The first path segment is the commission id (members of that commission read).
create policy meeting_attachments_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meeting-attachments'
    and (
      app.is_admin()
      or app.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- staff_admin of the commission uploads (INSERT only).
create policy meeting_attachments_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meeting-attachments'
    and (
      app.is_admin()
      or app.is_staff_admin_of(((storage.foldername(name))[1])::uuid)
    )
  );

-- No UPDATE / DELETE policies: meeting-attachments objects are immutable for app
-- roles (Rule 6). An attachment "delete" is a SOFT delete on the metadata row;
-- the object stays.

-- ===========================================================================
-- public.meeting_attachments — metadata (the file lives in Storage)
-- ===========================================================================
-- Mirror case_documents: SOFT-DELETE only (deleted_at/deleted_by), reads filter
-- deleted_at IS NULL. kind is a fixed CHECK (the six meeting attachment
-- categories). RLS member-read / staff_admin-write via app.commission_of_meeting.
create table public.meeting_attachments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  kind text not null default 'outro'
    check (kind in ('pauta', 'apresentacao', 'literatura', 'lista_presenca', 'ata_assinada', 'outro')),
  title text not null,
  -- The immutable Storage path in the meeting-attachments bucket
  -- ({commission_id}/{meeting_id}/{uuid}.{ext}); unique so a path is referenced once.
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  -- Soft-delete: the row is hidden (reads filter deleted_at is null), the object
  -- is retained (Rule 6).
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  constraint meeting_attachments_title_not_blank check (btrim(title) <> ''),
  constraint meeting_attachments_size_nonneg check (size_bytes is null or size_bytes >= 0)
);

alter table public.meeting_attachments enable row level security;
create index meeting_attachments_meeting_idx on public.meeting_attachments (meeting_id);
create index meeting_attachments_meeting_live_idx
  on public.meeting_attachments (meeting_id)
  where deleted_at is null;

-- RLS — members read, staff_admin write (commission via app.commission_of_meeting).
-- Soft-delete filtering is a QUERY concern (deleted_at is null), not RLS.
create policy meeting_attachments_select on public.meeting_attachments
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );

create policy meeting_attachments_staff_admin_write on public.meeting_attachments
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );
