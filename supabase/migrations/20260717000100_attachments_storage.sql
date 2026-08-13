-- =============================================================================
-- F2 (ADR 0063 / phase-14e §D7) — Centralized Attachments, migration 2 of 6:
--   the two physically-tiered private storage buckets and their policies.
--
--   `attachments`      (standard tier): INSERT + SELECT dispatch to the attachment
--                       write/read predicates on the object path's foldername.
--   `attachments-phi`  (phi tier):      INSERT only — there is NO authenticated SELECT
--                       policy at all. This is the HARD DOOR (mirrors F1's Class-1
--                       REVOKE posture): only the service-role client signs, and only
--                       the (bucket, path) the audited open_attachment RPC returned,
--                       with a short TTL. A foreigner cannot even enumerate a phi object.
--
--   Path convention: '{owner_type}/{owner_id}/{uuid}.{ext}' ⇒
--     storage.foldername(name)[1] = owner_type, [2] = owner_id  (same foldername
--     dispatch as the legacy case-documents bucket). 25 MiB, superset MIME.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('attachments', 'attachments', false, 26214400,
   '{application/pdf,image/png,image/jpeg,image/webp,image/gif,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain}'::text[])
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('attachments-phi', 'attachments-phi', false, 26214400,
   '{application/pdf,image/png,image/jpeg,image/webp,image/gif,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain}'::text[])
  on conflict (id) do nothing;

-- --- standard bucket: authenticated INSERT + SELECT gated by the dispatchers ---
create policy attachments_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and app.can_write_attachment(
          (storage.foldername(name))[1],
          ((storage.foldername(name))[2])::uuid,
          auth.uid()));

create policy attachments_obj_select_readable on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and app.can_read_attachment(
          (storage.foldername(name))[1],
          ((storage.foldername(name))[2])::uuid,
          auth.uid()));

-- --- phi bucket: authenticated INSERT ONLY. NO authenticated SELECT policy (the hard
--     door). Reads happen exclusively via open_attachment → service-role signed URL. ---
create policy attachments_phi_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments-phi'
    and app.can_write_attachment(
          (storage.foldername(name))[1],
          ((storage.foldername(name))[2])::uuid,
          auth.uid()));
