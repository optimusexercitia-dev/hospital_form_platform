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
--  - `case-documents` (t4): RETIRED by DM4 (2026-08-14, ADR 0119 D6 /
--    migration 20260926000400) — the F-14 signer died and the audited
--    open_referral_snapshot_document door replaced the boundary. t4 was
--    flipped to zero-count DELIBERATELY in that same change, per the
--    instruction that used to sit on this line; its positive-control duty
--    passed to t5 (documents-phi reserved-upload door). The bucket ROW stays
--    until DM5's single retirement manifest.
-- =============================================================================

begin;
select plan(5);

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

-- t4 — FLIPPED DELIBERATELY by DM4 (2026-08-14; ADR 0119 D6, migration
-- 20260926000400), exactly as this file's header demanded: the case-documents
-- snapshot-reader boundary retired with the F-14 signer. The bucket ROW stays
-- until DM5's single retirement manifest — this pin is about its POLICIES.
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%case-documents%'),
  0,
  't4 case-documents storage policies retired DELIBERATELY by DM4 (was the positive control; successor control: t5)');

-- t5 — the REPLACEMENT positive control (a detector that finds nothing must
-- be proven able to find something): the derivation sees the live
-- documents-phi reserved-upload door.
select is(
  (select count(*) >= 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%documents-phi%'),
  true,
  't5 POSITIVE CONTROL: the derivation sees the live documents-phi reserved-upload policy');

select * from finish();
rollback;
