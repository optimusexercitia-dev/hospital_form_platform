-- Phase 14c / B2: Patient-Safety / NSP — RCA RLS + the immutable nsp-evidence bucket.
-- ADR 0030/0033. RLS is the security boundary (Rule 1).
--
-- The read-write SPLIT (the novel shape, mirroring interviews):
--   * READ = app.can_read_event(event, uid) — EVENT scope. Every committee member
--     who can see the event reads the RCA + all children (so an observer reads, a
--     reporting/holding-committee member reads). Resolved for child tables via
--     app.event_of_rca.
--   * WRITE = app.can_write_rca(rca, uid) — the participant grant (PQS/admin OR a
--     NON-OBSERVER assigned team member). An observer is in rca_members but excluded
--     from this predicate → READ-ONLY. A non-team non-PQS user gets no read at all.
-- Both OR app.is_admin() for the live JWT-claim admin path (the interviews lesson:
-- can_write_rca/can_read_event are uid-pure for pgTAP; the extra OR keeps the
-- current-session claim admin working).
--
-- rca itself already has a can_read_event SELECT policy (…121100) — we ADD the
-- UPDATE/DELETE write policies. There is NO client INSERT policy on rca: the row is
-- minted ONLY by confirm_triage (DEFINER, 14b). The six child tables get SELECT +
-- a FOR ALL write policy.
--
-- The nsp-evidence bucket: PRIVATE, immutable (NO update/delete — Rule 6). Path
-- nsp-evidence/{event_id}/{rca_id}/{uuid}.{ext}: SELECT keyed on seg [1]=event_id via
-- can_read_event; INSERT keyed on seg [2]=rca_id via can_write_rca (so an assigned SME
-- uploads, not just PQS — matching the interview-attachments seg-[2] pattern).

-- ===========================================================================
-- rca — ADD the write policies (SELECT already exists from …121100)
-- ===========================================================================
create policy rca_update on public.rca
  for update to authenticated
  using (app.can_write_rca(id, auth.uid()) or app.is_admin())
  with check (app.can_write_rca(id, auth.uid()) or app.is_admin());

create policy rca_delete on public.rca
  for delete to authenticated
  using (app.can_write_rca(id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- rca_members
-- ===========================================================================
create policy rca_members_select on public.rca_members
  for select to authenticated
  using (app.can_read_event(app.event_of_rca(rca_id), auth.uid()) or app.is_admin());

create policy rca_members_write on public.rca_members
  for all to authenticated
  using (app.can_write_rca(rca_id, auth.uid()) or app.is_admin())
  with check (app.can_write_rca(rca_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- rca_timeline_entries
-- ===========================================================================
create policy rca_timeline_select on public.rca_timeline_entries
  for select to authenticated
  using (app.can_read_event(app.event_of_rca(rca_id), auth.uid()) or app.is_admin());

create policy rca_timeline_write on public.rca_timeline_entries
  for all to authenticated
  using (app.can_write_rca(rca_id, auth.uid()) or app.is_admin())
  with check (app.can_write_rca(rca_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- rca_evidence (soft-delete filtering is a QUERY concern, not RLS)
-- ===========================================================================
create policy rca_evidence_select on public.rca_evidence
  for select to authenticated
  using (app.can_read_event(app.event_of_rca(rca_id), auth.uid()) or app.is_admin());

create policy rca_evidence_write on public.rca_evidence
  for all to authenticated
  using (app.can_write_rca(rca_id, auth.uid()) or app.is_admin())
  with check (app.can_write_rca(rca_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- rca_factors
-- ===========================================================================
create policy rca_factors_select on public.rca_factors
  for select to authenticated
  using (app.can_read_event(app.event_of_rca(rca_id), auth.uid()) or app.is_admin());

create policy rca_factors_write on public.rca_factors
  for all to authenticated
  using (app.can_write_rca(rca_id, auth.uid()) or app.is_admin())
  with check (app.can_write_rca(rca_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- rca_why_chains
-- ===========================================================================
create policy rca_why_chains_select on public.rca_why_chains
  for select to authenticated
  using (app.can_read_event(app.event_of_rca(rca_id), auth.uid()) or app.is_admin());

create policy rca_why_chains_write on public.rca_why_chains
  for all to authenticated
  using (app.can_write_rca(rca_id, auth.uid()) or app.is_admin())
  with check (app.can_write_rca(rca_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- rca_root_causes
-- ===========================================================================
create policy rca_root_causes_select on public.rca_root_causes
  for select to authenticated
  using (app.can_read_event(app.event_of_rca(rca_id), auth.uid()) or app.is_admin());

create policy rca_root_causes_write on public.rca_root_causes
  for all to authenticated
  using (app.can_write_rca(rca_id, auth.uid()) or app.is_admin())
  with check (app.can_write_rca(rca_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- nsp-evidence Storage bucket + object policies (immutable; Rule 6)
-- ===========================================================================
-- Clones the interview-attachments bucket: PRIVATE, 25 MiB, same MIME allow-list
-- (PDF/images/Office/CSV/txt; NO audio). Objects are NEVER overwritten/deleted (no
-- UPDATE/DELETE policies) — soft-deletes leave the object in place. Reads via signed
-- URLs. Path nsp-evidence/{event_id}/{rca_id}/{uuid}.{ext}: foldername[1] = event_id
-- (READ boundary, can_read_event), foldername[2] = rca_id (WRITE boundary, can_write_rca).
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

-- SELECT: the first path segment is the event id — members in the event's
-- access-follows-custody scope read (mirror the event/RCA read scope).
create policy nsp_evidence_obj_select_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nsp-evidence'
    and (
      app.is_admin()
      or app.can_read_event(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

-- INSERT: keyed on the SECOND path segment (rca_id) via app.can_write_rca, so an
-- assigned non-observer SME uploads (not just PQS). The server action mints the path
-- in the exact {event}/{rca}/{uuid} shape.
create policy nsp_evidence_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nsp-evidence'
    and (
      app.is_admin()
      or app.can_write_rca(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  );

-- No UPDATE / DELETE policies: nsp-evidence objects are immutable for app roles
-- (Rule 6). An evidence "delete" is a SOFT delete on the metadata row.
