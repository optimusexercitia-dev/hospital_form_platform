-- =============================================================================
-- FUP-F2-BUCKETS — the F2 legacy-bucket retirement, PINNED (2026-08-12).
--
-- F2 rewired every attachment writer through `bucketForTier` and deferred the
-- legacy-bucket cleanup "to a later cleanup migration" in prose four times —
-- and prose is exactly the failure this pin closes: without an executable
-- assertion, dropping (or resurrecting) a legacy-bucket policy is a change no
-- gate can see.
--
-- Migration 20260921000300 retired `meeting-attachments`: it had NO remaining
-- product writer (verified: every writer goes through bucketForTier; the only
-- `meeting-attachments` mentions left in src/ are aria ids and comments), zero
-- objects locally, and two still-live policies — the read gating on the bare
-- `is_member_of(seg[1])` coarse rule F2 replaced.
--
-- ⭐ KEYSTONES (red-first): t1 and t3 were observed RED (2 policies, 1 bucket
-- row) against the pre-migration catalog.
--
-- ⚠ Scope notes (deliberate — do not "complete" this file reflexively):
--  - `interview-attachments` (t2) was ALREADY sealed — its member SELECT was a
--    confirmed PHI exposure (authz-a0-inventory-review §2.1). pgTAP 236 §③b
--    pins EXCLUDED-member-reads-0 and `u1-mutation-audit.sh` re-creates that
--    policy as its injected leak INSIDE 236's rolled-back txn — neither is
--    disturbed by this pin, and this pin never runs inside that audit (u1 runs
--    236 only).
--  - `case-documents` (t4) is NOT retired: `getReferralDocumentUrl` still signs
--    from it (the separate open item in docs/progress/f2-attachments.md §Open
--    risks) and its snapshot-reader SELECT policy is live BY DESIGN. It serves
--    here as the positive control proving the derivation can see storage
--    policies at all ("a detector that finds nothing must be proven able to
--    find something"). When that bucket is retired, flip t4 into the zero-count
--    shape DELIBERATELY, in the same change.
-- =============================================================================

begin;
select plan(4);

-- Derived from pg_policies (qual + with_check), never transcribed from prose.
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%meeting-attachments%'),
  0,
  't1 ⭐ no storage.objects policy references meeting-attachments (both doors dropped by 20260921000300)');

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%interview-attachments%'),
  0,
  't2 interview-attachments stays sealed (its member SELECT was a confirmed PHI exposure — this pin keeps it from silently returning)');

select is(
  (select count(*)::int from storage.buckets where id = 'meeting-attachments'),
  0,
  't3 ⭐ the meeting-attachments bucket row is gone (no writer, no objects, no doors)');

select is(
  (select count(*) >= 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%case-documents%'),
  true,
  't4 POSITIVE CONTROL: the derivation sees the still-live case-documents snapshot-reader policy (see header — retire deliberately, never by accident)');

select * from finish();
rollback;
