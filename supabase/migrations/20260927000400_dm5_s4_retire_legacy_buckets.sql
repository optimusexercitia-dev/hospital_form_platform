-- =============================================================================
-- DM5 · S4 — retire the EIGHT legacy storage buckets (ADR 0120 D8 / D9).
--
-- This is the "single retirement manifest" that pgTAP 325's header has deferred
-- to since 2026-08-12 ("the bucket ROW stays until DM5's single retirement
-- manifest"), and the direct generalization of 20260921000300, which retired
-- `meeting-attachments` alone. Same idiom, eight buckets, one landing point.
--
-- Retired here (ADR 0114 D13 + ADR 0120 D8):
--   attachments · attachments-phi   — DM1 dropped the substrate (ADR 0116 D1)
--   case-documents                  — DM4 retired the F-14 signer (ADR 0119 D6)
--   interview-attachments           — sealed since the A0 PHI finding
--   referral-attachments            — DM4 re-pointed reply attachments (R1)
--   controlled-documents            — DM3 retired both doors (20260925000500)
--   nsp-evidence                    — DM5 S2 re-pointed RCA/CAPA evidence
--   printed-documents               — DM5 S3 moved prints onto the core substrate
--
-- SURVIVING, deliberately: `documents-standard` / `documents-phi` (the core
-- substrate, ADR 0114 D8) and `form-assets` / `meeting-audio` (out of scope,
-- ADR 0114 D13). pgTAP 325 t5 + 328 K6a are the positive controls that keep
-- this migration honest — a sweep that retired everything would still pass a
-- test suite that only counts zeros.
--
-- ## What this migration does NOT do, and why that is the whole point
--
-- It does not delete a single BYTE. ADR 0120 D9 binds byte removal to the
-- Storage API, by key, from a manifest captured BEFORE any destructive step
-- (`scripts/storage-manifest.mjs`). The reason is measured, not theoretical: a
-- DB reset truncates `storage.objects` and LEAVES the bytes on the volume, so a
-- metadata-side "delete" proves emptiness against a truncated table and reports
-- success while the bytes persist. The two halves are therefore ORDERED, and
-- the ordering is the counter-intuitive one:
--
--   1. delete objects BY MANIFEST through the Storage API   (operational, D9)
--   2. THEN retire the bucket rows + their policies          (this migration)
--
-- Step 2 must be a MIGRATION rather than an operational script because six
-- historical migrations (baseline, controlled_docs_core, attachments_storage,
-- audio_minutes_schema, printed_documents_storage, dm1_document_buckets)
-- recreate all twelve bucket rows on every `db reset`. Retirement that lived
-- only in a script would be silently undone by the next reset.
--
-- ## The ordering is ENFORCED here, not asserted in prose
--
-- Block 1 REFUSES to retire a bucket that still holds `storage.objects` rows,
-- naming the bucket and the count. On a stack where step 1 has not run, this
-- aborts loudly instead of stranding blobs behind a dropped policy set. The FK
-- `objects_bucketId_fkey` (no CASCADE) would also refuse, but with a message
-- that names neither the invariant nor the remedy — prose in a header is
-- exactly the failure mode FUP-F2-BUCKETS was filed for, so the claim is
-- encoded executably.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · DATA GUARD — per bucket, so the error names which one and how many.
--     (The backfill-guard lesson: a migration that passes a 0-row local reset
--     can behave differently against a data-bearing remote.)
-- -----------------------------------------------------------------------------
do $$
declare
  v_retired constant text[] := array[
    'attachments', 'attachments-phi', 'case-documents', 'interview-attachments',
    'nsp-evidence', 'referral-attachments', 'controlled-documents', 'printed-documents'
  ];
  v_bucket text;
  v_count  bigint;
begin
  foreach v_bucket in array v_retired loop
    select count(*) into v_count from storage.objects where bucket_id = v_bucket;
    if v_count > 0 then
      raise exception
        'DM5 S4: bucket % still holds % storage.objects row(s) — retiring it would strand data behind a dropped policy set. ADR 0120 D9: delete the objects BY MANIFEST through the Storage API FIRST (scripts/storage-manifest.mjs capture, then delete --execute), and only THEN apply this migration.',
        v_bucket, v_count;
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2 · The remaining doors. Derived from pg_policies by PREDICATE TEXT (the 325
--     dialect — qual + with_check, never policy names), not transcribed from
--     prose: `nsp-evidence` is the ONLY retirement bucket that still carried
--     policies at S4. The other seven were retired door-first by DM1/DM3/DM4/S3.
--
--     The four predicates these call (app.can_write_capa / can_read_capa /
--     can_write_rca / can_read_event) are NOT dropped: unlike DM3's
--     app.can_read_document_object, whose only caller was its policy, these have
--     4 / 6 / 4 / 13 other callers in the catalog. Dropping the door is not
--     dropping the lock.
-- -----------------------------------------------------------------------------
drop policy if exists nsp_evidence_obj_select_member   on storage.objects;
drop policy if exists nsp_evidence_obj_insert_writable on storage.objects;
drop policy if exists capa_evidence_obj_select_member  on storage.objects;
drop policy if exists capa_evidence_obj_insert_writable on storage.objects;

-- -----------------------------------------------------------------------------
-- 3 · The bucket rows themselves.
--     `storage.protect_delete` (catalog-verified trigger on storage.buckets)
--     refuses direct deletes unless a transaction-local opt-in is set; it exists
--     precisely to force the deliberateness this migration documents.
--
-- ⚠ The opt-in and the DELETE are inside ONE `do` block ON PURPOSE. The obvious
--    spelling — a bare `set local storage.allow_delete_query = 'true'` followed
--    by the DELETE, as 20260921000300 does — depends on the migration runner
--    wrapping the file in a transaction, and IT DOES NOT ALWAYS DO SO. Observed
--    live: `supabase db reset` invoked from scripts/e2e-prod-gate.sh emitted
--    `WARNING (25P01): SET LOCAL can only be used in transaction blocks` against
--    this very file, which makes the opt-in a SILENT NO-OP.
--
--    A `do` block always executes inside a transaction (its own, if none is
--    open), so `set_config(..., is_local => true)` is guaranteed to be in scope
--    for the DELETE beside it and to die with it. It also cannot leak the opt-in
--    into a later statement — the failure mode the platform guard exists to
--    prevent. This is why the block re-asserts 'false' before returning as well.
-- -----------------------------------------------------------------------------
do $$
declare
  v_retired constant text[] := array[
    'attachments', 'attachments-phi', 'case-documents', 'interview-attachments',
    'nsp-evidence', 'referral-attachments', 'controlled-documents', 'printed-documents'
  ];
  v_deleted int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = any(v_retired);
  get diagnostics v_deleted = row_count;
  perform set_config('storage.allow_delete_query', 'false', true);
  raise notice 'DM5 S4: retired % legacy bucket row(s) of % named', v_deleted, array_length(v_retired, 1);
end;
$$;
