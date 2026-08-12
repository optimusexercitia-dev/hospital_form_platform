-- =============================================================================
-- DM1 / M5 — the two document buckets + INSERT-only reservation-bound policies
-- (ADR 0114 D8; plan §3 step 5; ADR 0116).
--
-- ⛔ NO SELECT POLICY ON EITHER BUCKET, FOR ANY TIER — every byte flows through
-- DM2's audited open_document_version → service-role short-TTL signing. The
-- F-01 class (path-authorized byte reads ignoring metadata) dies structurally.
-- pgTAP 328 K6 pins the zero-SELECT invariant with the 325 derivation dialect
-- (qual + with_check text, never policy names).
--
-- The INSERT policies bind to reservations minted by begin_document_upload
-- (DM2). In DM1 upload_sessions exists, is RLS'd, has zero DML grants and no
-- writer — so the predicate is FALSE for every possible caller: the policies
-- are live, fail-closed, and inert, and become operative the moment DM2's
-- reservation command exists, with no policy change.
--
-- Size cap + MIME allow-list mirror the F2 buckets' live values (read from
-- storage.buckets on 2026-08-12): 26214400 bytes; the 13-type document set.
-- These are the D9 compensating controls while no scanner is integrated (O2).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents-standard', 'documents-standard', false, 26214400, array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv', 'text/plain']),
  ('documents-phi', 'documents-phi', false, 26214400, array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv', 'text/plain'])
on conflict (id) do nothing;

create policy documents_std_obj_insert_reserved on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents-standard'
    and app.storage_upload_reserved(bucket_id, name, (select auth.uid()))
  );

create policy documents_phi_obj_insert_reserved on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents-phi'
    and app.storage_upload_reserved(bucket_id, name, (select auth.uid()))
  );
