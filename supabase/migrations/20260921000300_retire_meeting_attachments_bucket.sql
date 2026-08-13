-- =============================================================================
-- FUP-F2-BUCKETS: retire the `meeting-attachments` legacy bucket.
--
-- F2 (20260717000300 fold-in) consolidated meeting/interview/case attachments
-- into `public.attachments` + the two tier buckets and rewired EVERY writer
-- through `bucketForTier`; the legacy buckets were deliberately left standing
-- "to retire in a later cleanup migration, post-gate" — recorded in prose four
-- times and tracked nowhere. This is that migration, for the one bucket of the
-- three that is actually the finding:
--   - `referral-attachments`  → NOT legacy (live referral PHI plane, Phase 22).
--     Untouched.
--   - `interview-attachments` → already sealed (member SELECT dropped as a
--     confirmed PHI exposure; pgTAP 236 §③b + u1-mutation-audit own it).
--     Untouched.
--   - `meeting-attachments`   → NO remaining product writer (every upload goes
--     through bucketForTier; the only src/ mentions left are aria ids and
--     comments), zero objects locally, and TWO still-live policies — the read
--     gating on bare `is_member_of(seg[1])`, the coarse rule F2 replaced.
--
-- ⚠ DATA GUARD (the backfill-guard lesson: a migration that passes a 0-row
-- local reset can behave differently against a data-bearing remote, and remote
-- object counts could NOT be measured from this session). If ANY object still
-- lives in the bucket at apply time, this migration REFUSES loudly instead of
-- stranding blobs — a non-zero count is a data decision, not a cleanup.
--
-- Pinned by pgTAP 325 (t1/t3 observed RED pre-migration), so the retirement
-- cannot silently regress — the same prose-only failure that produced
-- FUP-F2-BUCKETS in the first place.
-- =============================================================================

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from storage.objects
  where bucket_id = 'meeting-attachments';
  if v_count > 0 then
    raise exception
      'meeting-attachments still holds % object(s) — retiring it would strand data behind a dropped policy set. This is a data decision (FUP-F2-BUCKETS step 1): migrate or dispose of the objects first.',
      v_count;
  end if;
end;
$$;

-- The two remaining doors (the actual open surface — the SELECT gated on the
-- coarse bare-membership rule F2 replaced).
drop policy if exists meeting_attachments_select_member on storage.objects;
drop policy if exists meeting_attachments_insert_staff_admin on storage.objects;

-- The bucket row itself. storage.objects / s3_multipart_uploads FKs reference
-- buckets(id) without CASCADE, so anything the guard above somehow missed
-- still blocks this DELETE loudly rather than losing data silently.
-- `storage.protect_delete` (catalog-verified trigger on storage.buckets)
-- refuses direct deletes unless this transaction-local opt-in is set; it
-- exists precisely to force the deliberateness this migration documents.
-- SET LOCAL dies with the migration's transaction — nothing leaks.
set local storage.allow_delete_query = 'true';
delete from storage.buckets where id = 'meeting-attachments';
