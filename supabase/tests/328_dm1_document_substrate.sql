-- =============================================================================
-- 328 — DM1 substrate cutover keystones (ADR 0114; plan:
-- docs/plans/dm1-substrate-cutover-plan.md; decisions ADR 0116).
--
-- Turn-1 sections: K1 (attachment door-sweep), K2 (DM4 allowlist pins),
-- K8 (parked-seam writer refusals). K3–K7/K9/K10 join this file with M2–M6
-- inside the same phase — the plan() count grows with them.
--
-- ⭐ RED-FIRST RECORD (K1/K8): this file was authored and run against the
-- PRE-M1 catalog (2026-08-12, HEAD 61bb0ce) and observed RED before migration
-- 20260923000100 existed. The observed pre-M1 values are recorded in the
-- phase record (PROGRESS.md DM1 rows) and the M1 commit message — K1 red
-- proves the sweep SEES the doomed surface; K8 red (three writers SUCCEED)
-- proves the parked-seam guards did not pre-exist. K2 is a set of existence
-- PINS (green on both sides by design — its red is "someone dropped a
-- preserved referral surface early", the accident it exists to catch).
--
-- K1 allowlist (= the DM4 closure artifact, ADR 0114 D5 / plan DM1 item 2):
-- DM4 empties it — ALL of it, including the two non-%attachment% entries
-- (case_documents_select_member + app.can_read_snapshot_document) — and
-- re-runs this sweep at zero exceptions. Every name below is asserted to
-- EXIST in K2 so DM4 cannot forget one.
-- =============================================================================

begin;
-- 88 → 109: DM2·S1 adds K14 (the D15 confidentiality ceiling — ADR 0114
-- Amendment 1; column + seam guard + kernel arm), 21 assertions.
-- 109 → 111: S4 spawn rewrites K9 as three pins (exist / waves-OFF /
-- foundation+wave_a seed-forced ON).
-- 111 → 124: MAJOR-1 / S1-O4 adds K15 (the INTERVIEW's own ceiling propagates
-- to its documents — PO PROPAGATE ruling 2026-08-13; ADR 0117 Amendment 1),
-- 13 assertions.
-- 124 → 130: K16 (the kill-switch property, QA r1 INFO-2 / handoff item 5):
-- documents_foundation alone kills every door; documents_wave_a is UI-only
-- and NOT a kill switch — enforced by pins, no longer prose. 6 assertions.
-- 130 → 128: DM3 removes K8c (the ethics parked-seam refusal, discharged by
-- ADR 0114 Amendment 2 / D17) and its now-unused ethics flag precondition.
-- K8a/K8b and their preconditions are untouched — see the K8c note below.
select plan(128);

-- Flag preconditions asserted, never assumed (authz-handoff §7.3).
select is(app.feature_enabled('case_referrals'), true,
  'precondition: case_referrals flag is ON (K8a exercises a referral writer)');
select is(app.feature_enabled('patient_safety'), true,
  'precondition: patient_safety flag is ON (K8b exercises an RCA writer)');
-- (The ethics-flag precondition retired with K8c — DM3, ADR 0114 Am. 2
-- condition 4. Only that one; the referral and RCA preconditions above stay,
-- because K8a and K8b still exercise those writers.)

-- =============================================================================
-- K1 — the attachment door-sweep: zero surviving centralized-attachment
-- surface, minus the named referral-owned allowlist. Enumerated from the LIVE
-- catalog, never from prose.
-- =============================================================================

-- K1a: routines. Allowlist: the two referral-owned RPCs (DM4 retires them).
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and p.proname ilike '%attachment%'
      and p.proname not in ('add_referral_reply_attachment',
                            'get_referral_attachment_path')),
  0,
  'K1a zero %attachment% routines in app/public beyond the two referral-owned RPCs');

-- K1b: policies (ALL schemas — table policies + storage.objects). Allowlist:
-- the referral reply-attachment table policy + the two referral storage doors.
select is(
  (select count(*)::int
     from pg_policies
    where (policyname ilike '%attachment%' or tablename ilike '%attachment%')
      and policyname not in ('referral_reply_attachment_select_readable',
                             'referral_attachments_obj_insert',
                             'referral_attachments_obj_select')),
  0,
  'K1b zero %attachment% policies beyond the three referral-owned ones');

-- K1c: relations. Allowlist: referral_reply_attachment (the referral module''s
-- own table, DM4''s to migrate).
select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('app', 'public')
      and c.relkind in ('r', 'v', 'm', 'p')
      and c.relname ilike '%attachment%'
      and c.relname <> 'referral_reply_attachment'),
  0,
  'K1c zero %attachment% relations beyond referral_reply_attachment');

-- K1d: routine EXECUTE grants reachable by client roles.
select is(
  (select count(*)::int
     from information_schema.role_routine_grants g
    where g.routine_schema in ('app', 'public')
      and g.routine_name ilike '%attachment%'
      and g.routine_name not in ('add_referral_reply_attachment',
                                 'get_referral_attachment_path')
      and g.grantee in ('authenticated', 'anon', 'PUBLIC')),
  0,
  'K1d zero client EXECUTE grants on %attachment% routines beyond the allowlist');

-- K1e: no SURVIVING function body references a dropped routine name
-- (comment-stripped — §7.2; this is what catches an unpatched
-- _audit_access_authorized-class dependency).
select is(
  (select count(*)::int
     from (select n.nspname, p.proname,
                  regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('app', 'public')) b
    where b.src ~ ('assert_attachments_enabled|attachment_confidentiality_ok'
                || '|can_read_attachment|can_write_attachment'
                || '|commission_of_attachment|guard_attachment_immutable'
                || '|trg_audit_attachment|create_attachment|open_attachment'
                || '|dispose_attachment_phi|reclassify_attachment'
                || '|soft_delete_attachment')),
  0,
  'K1e no surviving app/public function body references a dropped attachment routine');

-- K1f: no surviving function body references the dropped relations.
select is(
  (select count(*)::int
     from (select n.nspname, p.proname,
                  regexp_replace(p.prosrc, '--[^\n]*', '', 'g') as src
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('app', 'public')) b
    where b.src ~ ('public\.attachments\M|public\.attachment_references\M'
                || '|public\.attachment_subjects\M'
                || '|\yfrom attachments\y|\yjoin attachments\y'
                || '|\yinto attachments\y|\yupdate attachments\y')),
  0,
  'K1f no surviving app/public function body references a dropped attachment relation');

-- K1g: no storage.objects policy references the two centralized-attachment
-- bucket literals (quoted-literal match — cannot false-positive on
-- ''referral-attachments''). The bucket ROWS themselves retire in DM5, not here.
select is(
  (select count(*)::int
     from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          ~ '''attachments''|''attachments-phi'''),
  0,
  'K1g no storage.objects policy references the attachments / attachments-phi buckets');

-- =============================================================================
-- K2 — the DM4 allowlist, pinned by NAME so DM4 cannot forget an entry.
-- Every row here is a live referral-owned boundary DM1 deliberately spares
-- (plan DM1 item 1 + the 2026-08-12 amendments). DM4 retires ALL of them and
-- flips these pins to zero-count DELIBERATELY, in the same change (the
-- 325-t4 discipline: retire deliberately, never by accident).
-- =============================================================================

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'case_documents_select_member'),
  'K2a case_documents_select_member survives DM1 (live frozen-snapshot boundary until DM4)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_snapshot_document'),
  'K2b app.can_read_snapshot_document survives DM1 (predicate of K2a, DM4 retires it)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'add_referral_reply_attachment'),
  'K2c add_referral_reply_attachment survives DM1 (referral-owned, DM4 migrates it)');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_referral_attachment_path'),
  'K2d get_referral_attachment_path survives DM1 (referral-owned, DM4 migrates it)');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'public' and tablename = 'referral_reply_attachment'
     and policyname = 'referral_reply_attachment_select_readable'),
  'K2e referral_reply_attachment_select_readable survives DM1');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'referral_attachments_obj_insert'),
  'K2f referral_attachments_obj_insert survives DM1');

select ok(exists(
  select 1 from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'referral_attachments_obj_select'),
  'K2g referral_attachments_obj_select survives DM1');

-- =============================================================================
-- K3 — the securable-resource registry (M2). The anti-join was ALSO proven on
-- the pre-M2 POPULATED stack (2026-08-12: backfill minted 8 case / 3 meeting /
-- 1 interview / 1 action_item over pre-existing rows) — a fresh reset exercises
-- only the TRIGGER path, because reset replays the chain against an empty DB
-- and the backfill is a no-op there forever.
-- =============================================================================

-- Population non-vacuity first (§7.10: an empty population proves nothing).
select cmp_ok((select count(*) from public.cases), '>', 0::bigint,
  'K3-pre the domain population is non-empty (the anti-join has something to prove)');

select is(
  (select (select count(*) from public.cases c where not exists
            (select 1 from public.securable_resources s where s.id = c.id and s.resource_type = 'case'))
        + (select count(*) from public.meetings m where not exists
            (select 1 from public.securable_resources s where s.id = m.id and s.resource_type = 'meeting'))
        + (select count(*) from public.case_interviews i where not exists
            (select 1 from public.securable_resources s where s.id = i.id and s.resource_type = 'interview'))
        + (select count(*) from public.action_items a where not exists
            (select 1 from public.securable_resources s where s.id = a.id and s.resource_type = 'action_item'))),
  0::bigint,
  'K3a every domain row of all four types has its typed registry row (anti-join = 0)');

select is(
  (select count(*) from public.securable_resources s
    where (s.resource_type = 'case' and not exists (select 1 from public.cases t where t.id = s.id))
       or (s.resource_type = 'meeting' and not exists (select 1 from public.meetings t where t.id = s.id))
       or (s.resource_type = 'interview' and not exists (select 1 from public.case_interviews t where t.id = s.id))
       or (s.resource_type = 'action_item' and not exists (select 1 from public.action_items t where t.id = s.id))),
  0::bigint,
  'K3b no orphan registry rows (every registry row has its domain row)');

-- K3c: the BEFORE INSERT trigger mints the registry row for a NEW domain row.
insert into public.cases (id, commission_id, case_number, label, status, created_by)
values ('32800000-0000-0000-0000-0000000000c1', 'a0000000-0000-0000-0000-0000000000a1',
        328001, 'Caso K3 (fixture 328)', 'pending', '00000000-0000-0000-0000-000000000002');

select ok(exists(
  select 1 from public.securable_resources
   where id = '32800000-0000-0000-0000-0000000000c1' and resource_type = 'case'),
  'K3c inserting a case mints its registry row through the trigger');

select is(
  (select s.organization_id::text || '|' || s.hospital_id::text || '|' || s.commission_id::text
     from public.securable_resources s where s.id = '32800000-0000-0000-0000-0000000000c1'),
  (select c.organization_id::text || '|' || c.hospital_id::text || '|' || c.id::text
     from public.commissions c where c.id = 'a0000000-0000-0000-0000-0000000000a1'),
  'K3d the minted registry row carries the tenant trio resolved from commissions');

select throws_ok(
  $q$ insert into public.securable_resources (id, resource_type, organization_id, hospital_id, commission_id)
      values (gen_random_uuid(), 'case', null, null, null) $q$,
  '23514', null,
  'K3e the tenant-shape CHECK refuses a commission-anchored type without its trio');

select throws_ok(
  $q$ update public.cases set securable_type = 'meeting'
      where id = '32800000-0000-0000-0000-0000000000c1' $q$,
  '23514', null,
  'K3f the typed pin cannot be re-keyed to another resource type');

-- K3g: the RESTRICT fail-safe, witnessed with a hand-planted document (it
-- cannot fire on live data in DM1 — zero documents exist outside this txn).
insert into public.documents (id, home_resource_id, title, created_by)
values ('32800000-0000-0000-0000-00000000d0c1', '32800000-0000-0000-0000-0000000000c1',
        'Documento K3g (fixture 328)', '00000000-0000-0000-0000-000000000002');

select set_config('app.in_case_rpc', 'on', true);
select throws_ok(
  $q$ delete from public.cases where id = '32800000-0000-0000-0000-0000000000c1' $q$,
  '23503', null,
  'K3g deleting a domain row that still owns documents is BLOCKED (AFTER DELETE trigger hits documents'' ON DELETE RESTRICT)');

delete from public.documents where id = '32800000-0000-0000-0000-00000000d0c1';
select lives_ok(
  $q$ delete from public.cases where id = '32800000-0000-0000-0000-0000000000c1' $q$,
  'K3h with its documents gone, the domain delete proceeds');
select set_config('app.in_case_rpc', 'off', true);

select ok(not exists(
  select 1 from public.securable_resources where id = '32800000-0000-0000-0000-0000000000c1'),
  'K3i the AFTER DELETE trigger removed the registry row with the domain row');

-- =============================================================================
-- K7 — core-table constraints and guards (M3): physical-identity uniqueness,
-- bucket-from-tier, the D9 upload machine, the D10 disposal machine + hold
-- blocks, version immutability, the Q6 rendition pin, the O1 posture.
-- =============================================================================

-- Fixture: a second fresh case (registry row via trigger) + document + version.
insert into public.cases (id, commission_id, case_number, label, status, created_by)
values ('32800000-0000-0000-0000-0000000000c2', 'a0000000-0000-0000-0000-0000000000a1',
        328002, 'Caso K7 (fixture 328)', 'pending', '00000000-0000-0000-0000-000000000002');
insert into public.documents (id, home_resource_id, title, created_by)
values ('32800000-0000-0000-0000-00000000d0c2', '32800000-0000-0000-0000-0000000000c2',
        'Documento K7 (fixture 328)', '00000000-0000-0000-0000-000000000002');
insert into public.document_versions (id, document_id, version_number, created_by)
values ('32800000-0000-0000-0000-00000000e0c2', '32800000-0000-0000-0000-00000000d0c2',
        1, '00000000-0000-0000-0000-000000000002');

-- A file object born reserved, then walked LEGALLY to clean (the guards have
-- no bypass GUC — fixtures walk the machine, which also exercises it).
insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by)
values ('32800000-0000-0000-0000-00000000f0c2', 'documents-standard',
        '0c000000-0000-0000-0000-00000000000a/32800000-0000-0000-0000-00000000f0c2/gen-1',
        'standard', '00000000-0000-0000-0000-000000000002');

select throws_ok(
  $q$ insert into public.file_objects (storage_bucket, storage_path, sensitivity_tier, created_by)
      values ('documents-standard',
              '0c000000-0000-0000-0000-00000000000a/32800000-0000-0000-0000-00000000f0c2/gen-1',
              'standard', '00000000-0000-0000-0000-000000000002') $q$,
  '23505', null,
  'K7a one physical object, one row: UNIQUE(storage_bucket, storage_path) refuses a duplicate');

select throws_ok(
  $q$ insert into public.file_objects (storage_bucket, storage_path, sensitivity_tier, created_by)
      values ('documents-standard', '328/k7/tier-mismatch', 'phi',
              '00000000-0000-0000-0000-000000000002') $q$,
  '23514', null,
  'K7b the bucket is DERIVED from the tier: a phi object cannot sit in documents-standard');

select throws_ok(
  $q$ insert into public.file_objects (storage_bucket, storage_path, sensitivity_tier, upload_state, created_by)
      values ('documents-standard', '328/k7/born-clean', 'standard', 'clean',
              '00000000-0000-0000-0000-000000000002') $q$,
  'HC0D1', null,
  'K7c a file object must be born reserved (guard refuses a born-clean insert)');

select throws_ok(
  $q$ update public.file_objects set upload_state = 'clean'
      where id = '32800000-0000-0000-0000-00000000f0c2' $q$,
  'HC0D1', null,
  'K7d the D9 machine refuses the reserved -> clean jump (scan states are not skippable)');

select lives_ok(
  $q$ do $w$ begin
        update public.file_objects set upload_state = 'uploaded', uploaded_at = now()
          where id = '32800000-0000-0000-0000-00000000f0c2';
        update public.file_objects set upload_state = 'verifying'
          where id = '32800000-0000-0000-0000-00000000f0c2';
        update public.file_objects set upload_state = 'scan_pending',
               size_bytes = 12345, mime_type = 'application/pdf', sha256 = repeat('a', 64),
               verified_at = now()
          where id = '32800000-0000-0000-0000-00000000f0c2';
        update public.file_objects set upload_state = 'clean'
          where id = '32800000-0000-0000-0000-00000000f0c2';
      end $w$ $q$,
  'K7e the legal walk reserved -> uploaded -> verifying -> scan_pending -> clean proceeds');

select throws_ok(
  $q$ update public.file_objects set storage_path = '328/k7/moved'
      where id = '32800000-0000-0000-0000-00000000f0c2' $q$,
  'HC0D2', null,
  'K7f physical identity is immutable: a path rewrite is refused (reclassification = new row, F-03)');

select throws_ok(
  $q$ update public.document_versions set version_number = 2
      where id = '32800000-0000-0000-0000-00000000e0c2' $q$,
  'HC0D2', null,
  'K7g1 document versions are immutable rows (UPDATE refused)');

select throws_ok(
  $q$ delete from public.document_versions
      where id = '32800000-0000-0000-0000-00000000e0c2' $q$,
  'HC0D2', null,
  'K7g2 document versions are immutable rows (DELETE refused)');

-- Bind the clean file to the version, place a legal hold, and witness both
-- D10 hold blocks (file disposal + document soft-delete).
insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
values ('32800000-0000-0000-0000-00000000e0c2', '32800000-0000-0000-0000-00000000f0c2', 'source');
insert into public.document_legal_holds (id, document_id, issued_by, reason_category)
values ('32800000-0000-0000-0000-0000000000dd', '32800000-0000-0000-0000-00000000d0c2',
        '00000000-0000-0000-0000-000000000002', 'litigation');

select throws_ok(
  $q$ update public.file_objects set disposal_state = 'disposal_pending'
      where id = '32800000-0000-0000-0000-00000000f0c2' $q$,
  'HC0D3', null,
  'K7h1 an active legal hold blocks file disposal (D10)');

select throws_ok(
  $q$ update public.documents set status = 'soft_deleted', deleted_at = now()
      where id = '32800000-0000-0000-0000-00000000d0c2' $q$,
  'HC0D3', null,
  'K7h2 soft-delete honors an active hold (D10)');

update public.document_legal_holds
   set released_at = now(), released_by = '00000000-0000-0000-0000-000000000002'
 where id = '32800000-0000-0000-0000-0000000000dd';

select lives_ok(
  $q$ update public.file_objects set disposal_state = 'disposal_pending'
      where id = '32800000-0000-0000-0000-00000000f0c2' $q$,
  'K7h3 with the hold released, disposal_pending proceeds');

select throws_ok(
  $q$ insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
      values ('32800000-0000-0000-0000-00000000e0c2',
              '32800000-0000-0000-0000-00000000f0c2', 'source') $q$,
  '23505', null,
  'K7i one file per rendition per version (Q6 provisional pin)');

select ok(
  (select count(*) >= 1 from public.document_retention where is_provisional),
  'K7j the retention structure carries its PROVISIONAL catch-all row (ADR 0114 O1 posture)');

-- =============================================================================
-- K4 — posture of the nine new tables (M2+M3+M4): RLS on, EXACTLY ONE policy
-- per table (a permissive sibling would un-falsify every deny below —
-- authz-handoff §7.1-6), SELECT-only, zero client DML.
-- =============================================================================

select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public' and rowsecurity
      and tablename in ('securable_resources','documents','document_versions','file_objects',
                        'document_version_files','document_placements','upload_sessions',
                        'document_retention','document_legal_holds')),
  9, 'K4a all nine document-model tables have RLS enabled');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in ('securable_resources','documents','document_versions','file_objects',
                        'document_version_files','document_placements','upload_sessions',
                        'document_retention','document_legal_holds')),
  9, 'K4b exactly ONE policy per table (nine tables, nine policies)');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in ('securable_resources','documents','document_versions','file_objects',
                        'document_version_files','document_placements','upload_sessions',
                        'document_retention','document_legal_holds')
      and cmd <> 'SELECT'),
  0, 'K4c every policy is SELECT-only (command-only mutations)');

select is(
  (select count(*)::int from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name in ('securable_resources','documents','document_versions','file_objects',
                           'document_version_files','document_placements','upload_sessions',
                           'document_retention','document_legal_holds')
      and (g.grantee = 'anon'
           or (g.grantee = 'authenticated' and g.privilege_type <> 'SELECT'))),
  0, 'K4d zero anon grants and zero authenticated DML on all nine tables');

-- =============================================================================
-- K5 — the kernel, BEHAVIORALLY (the noun rule is a measurement, not a body
-- grep). Fixtures: one case-homed + one meeting-homed document on CCIH.
-- Verified pre-authoring: staff1 CAN read Caso 0001 (member arm), chefe.farm
-- is NOT a CCIH member, platform@test.local = …b0.
-- =============================================================================

insert into public.documents (id, home_resource_id, title, created_by)
values ('32800000-0000-0000-0000-00000000d101', 'd0000000-0000-0000-0000-0000000000c1',
        'Documento K5 (caso)', '00000000-0000-0000-0000-000000000002'),
       ('32800000-0000-0000-0000-00000000d102',
        (select id from public.meetings where commission_id = 'a0000000-0000-0000-0000-0000000000a1' limit 1),
        'Documento K5 (reunião)', '00000000-0000-0000-0000-000000000002');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d101'),
  1, 'K5a the home-commission staff_admin reads the case-homed document');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d101'),
  0, 'K5b a staff_admin of ANOTHER commission reads zero (home-resource access, D6)');
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d102'),
  0, 'K5c the meeting-homed document is invisible to a non-member (dispatch arm: meeting)');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0'::uuid, true);
set local role authenticated;
select is((select count(*)::int from public.documents
            where id in ('32800000-0000-0000-0000-00000000d101','32800000-0000-0000-0000-00000000d102')),
  0, 'K5d ⭐ NOUN RULE (A35): platform_admin reads ZERO documents — measured behaviorally, no is_admin arm');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d102'),
  1, 'K5e a plain commission member reads the meeting-homed document (member arm)');
reset role;

-- The is_active outer gate, differentially (same persona, same query). The
-- profiles guard reads the caller claims — clear them so the update runs in
-- system context (the 231 dialect).
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000002';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d101'),
  0, 'K5f deactivated, the SAME persona reads zero (app.is_active outer gate)');
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_active = true where id = '00000000-0000-0000-0000-000000000002';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d101'),
  1, 'K5g reactivated, the same persona reads again (the K5f/K5g pair is differential)');
reset role;

-- can_write_document contract pins (DM2 builds on these signatures).
select is(app.can_write_document('32800000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-000000000002'),
  true, 'K5h the home staff_admin may write the case-homed document');
select is(app.can_write_document('32800000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-000000000003'),
  false, 'K5i a plain member may NOT write it (write = staff_admin/assignee arms)');
select is(app.can_write_document('32800000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-0000000000b0'),
  false, 'K5j platform_admin may NOT write it (noun rule, write side)');

-- =============================================================================
-- K6 — buckets (M5): two private buckets, NO SELECT policy for any tier (D8),
-- INSERT bound to a reservation that nothing can mint until DM2.
-- =============================================================================

select is((select count(*)::int from storage.buckets
            where id in ('documents-standard', 'documents-phi') and not public),
  2, 'K6a both document buckets exist and are private');

-- The 325 derivation dialect: qual + with_check TEXT, never policy names —
-- a policy referencing the bucket indirectly still matches.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
      and (coalesce(qual, '') || ' ' || coalesce(with_check, ''))
          ~ '''documents-standard''|''documents-phi'''),
  0, 'K6b ⭐ ZERO SELECT policies reference either document bucket (D8: bytes flow only through the audited door)');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'INSERT'
      and policyname in ('documents_std_obj_insert_reserved', 'documents_phi_obj_insert_reserved')),
  2, 'K6c the two reservation-bound INSERT policies exist');

select is(app.storage_upload_reserved('documents-standard', '328/k6/unreserved',
            '00000000-0000-0000-0000-000000000002'),
  false, 'K6d no reservation, no permission (fail-closed default)');

-- Plant a reservation as postgres (the DM2 command's shape).
insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by)
values ('32800000-0000-0000-0000-00000000f6c1', 'documents-standard',
        '0c000000-0000-0000-0000-00000000000a/32800000-0000-0000-0000-00000000f6c1/gen-1',
        'standard', '00000000-0000-0000-0000-000000000002');
insert into public.upload_sessions (id, file_object_id, reserved_by, expires_at)
values ('32800000-0000-0000-0000-00000000a6c1', '32800000-0000-0000-0000-00000000f6c1',
        '00000000-0000-0000-0000-000000000002', now() + interval '15 minutes');

select is(app.storage_upload_reserved('documents-standard',
            '0c000000-0000-0000-0000-00000000000a/32800000-0000-0000-0000-00000000f6c1/gen-1',
            '00000000-0000-0000-0000-000000000002'),
  true, 'K6e the reservation owner may upload to exactly the reserved path');

select is(app.storage_upload_reserved('documents-standard',
            '0c000000-0000-0000-0000-00000000000a/32800000-0000-0000-0000-00000000f6c1/gen-1',
            '00000000-0000-0000-0000-000000000003'),
  false, 'K6f another principal may NOT use someone else''s reservation');

update public.upload_sessions set expires_at = now() - interval '1 minute'
 where id = '32800000-0000-0000-0000-00000000a6c1';
select is(app.storage_upload_reserved('documents-standard',
            '0c000000-0000-0000-0000-00000000000a/32800000-0000-0000-0000-00000000f6c1/gen-1',
            '00000000-0000-0000-0000-000000000002'),
  false, 'K6g an EXPIRED reservation no longer authorizes the upload');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select throws_ok(
  $q$ insert into storage.objects (bucket_id, name, owner)
      values ('documents-phi', '328/k6/no-reservation.pdf',
              '00000000-0000-0000-0000-000000000002') $q$,
  '42501', null,
  'K6h a direct Storage write without a reservation is DENIED (the M5 policy is live and fail-closed)');
reset role;

-- =============================================================================
-- K11 — the RESOLVER chain, read BEHAVIORALLY through every policy (the ARM-1
-- door sweep neutralizes each of these one at a time and requires reds HERE —
-- the sweep is K11's mutation proof). Fixtures reused: K7's chain (case c2 →
-- doc d0c2 → version e0c2 → file f0c2, hold dd released), K5's d101/d102,
-- K6's session a6c1 (expired). Plus one placement.
-- =============================================================================

insert into public.document_placements (id, document_id, resource_id, created_by)
values ('32800000-0000-0000-0000-00000000ac01', '32800000-0000-0000-0000-00000000d101',
        (select home_resource_id from public.documents where id = '32800000-0000-0000-0000-00000000d102'),
        '00000000-0000-0000-0000-000000000002');

-- A chain under K5's d101 (homed on SEEDED Caso 0001, which staff1 reads via a
-- real content source — verified pre-authoring; a FRESH case is NOT readable
-- by bare membership under the capability lattice, which a first draft of
-- K11h learned by going red on the wrong arm).
insert into public.document_versions (id, document_id, version_number, created_by)
values ('32800000-0000-0000-0000-00000000e101', '32800000-0000-0000-0000-00000000d101',
        1, '00000000-0000-0000-0000-000000000002');
insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by)
values ('32800000-0000-0000-0000-00000000f101', 'documents-standard',
        '0c000000-0000-0000-0000-00000000000a/32800000-0000-0000-0000-00000000f101/gen-1',
        'standard', '00000000-0000-0000-0000-000000000002');
update public.file_objects set upload_state = 'uploaded', uploaded_at = now()
 where id = '32800000-0000-0000-0000-00000000f101';
update public.file_objects set upload_state = 'verifying'
 where id = '32800000-0000-0000-0000-00000000f101';
update public.file_objects set upload_state = 'scan_pending'
 where id = '32800000-0000-0000-0000-00000000f101';
update public.file_objects set upload_state = 'clean'
 where id = '32800000-0000-0000-0000-00000000f101';
insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
values ('32800000-0000-0000-0000-00000000e101', '32800000-0000-0000-0000-00000000f101', 'source');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.document_versions where id = '32800000-0000-0000-0000-00000000e0c2'),
  1, 'K11a the home staff_admin reads the version (can_read_document via document_id)');
select is((select count(*)::int from public.document_version_files where document_version_id = '32800000-0000-0000-0000-00000000e0c2'),
  1, 'K11b …and the version-file binding (can_read_document_version resolver)');
select is((select count(*)::int from public.file_objects where id = '32800000-0000-0000-0000-00000000f0c2'),
  1, 'K11c …and the file object (can_read_file_object)');
select is((select count(*)::int from public.document_legal_holds where id = '32800000-0000-0000-0000-0000000000dd'),
  1, 'K11d …and the legal hold (can_read_document_hold: staff_admin arm)');
select is((select count(*)::int from public.document_placements where id = '32800000-0000-0000-0000-00000000ac01'),
  1, 'K11e …and the placement (non-authorizing read follows the document)');
select cmp_ok((select count(*) from public.document_retention), '>', 0::bigint,
  'K11f retention config is authenticated-readable (deliberately open catalog read)');
select is((select count(*)::int from public.upload_sessions where id = '32800000-0000-0000-0000-00000000a6c1'),
  1, 'K11g the reservation owner reads their own upload session');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
set local role authenticated;
select is((select count(*)::int from public.file_objects where id = '32800000-0000-0000-0000-00000000f101'),
  1, 'K11h a plain member reads the file object through the BINDING CHAIN (not the creator arm — staff1 is not the creator; the home case is readable to him by a real content source)');
select is((select count(*)::int from public.document_legal_holds where id = '32800000-0000-0000-0000-0000000000dd'),
  0, 'K11i …but NOT the hold (write-authority governance metadata: staff_admin/tenancy only)');
select is((select count(*)::int from public.upload_sessions where id = '32800000-0000-0000-0000-00000000a6c1'),
  0, 'K11j …and NOT someone else''s upload session');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.document_versions where id = '32800000-0000-0000-0000-00000000e0c2'),
  0, 'K11k a foreign staff_admin reads NO version');
select is((select count(*)::int from public.document_version_files where document_version_id = '32800000-0000-0000-0000-00000000e0c2'),
  0, 'K11l …no version-file binding');
select is((select count(*)::int from public.file_objects where id = '32800000-0000-0000-0000-00000000f0c2'),
  0, 'K11m …no file object (neither creator nor chain)');
select is((select count(*)::int from public.document_legal_holds where id = '32800000-0000-0000-0000-0000000000dd'),
  0, 'K11n …no hold');
select is((select count(*)::int from public.document_placements where id = '32800000-0000-0000-0000-00000000ac01'),
  0, 'K11o …no placement');
reset role;

-- =============================================================================
-- K13 — file_objects is CHAIN-ONLY (QA MAJOR-1, 2026-08-12): the uploader arm
-- was REMOVED from app.can_read_file_object — an unbound file object is
-- invisible even to its own creator until a readable document binds it. This
-- pins the ABSENCE (a future re-add of the arm goes red here); DM2 may add
-- uploader visibility deliberately, keystoned, with the FUP-DM1-CEILING
-- interaction considered. RED-FIRST: observed RED (count=1) against the
-- pre-removal catalog with the arm still present.
-- =============================================================================

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.file_objects where id = '32800000-0000-0000-0000-00000000f6c1'),
  0, 'K13 an UNBOUND file object is invisible even to its own uploader (chain-only — no creator arm)');
reset role;

-- =============================================================================
-- K12 — the registry's OWN policy, asserted through (added after the ARM-1
-- diff-scoped sweep returned securable_resources_select = BLIND — the doctrine
-- is keystone-what-comes-back-BLIND, never allowlist a tenant boundary).
-- =============================================================================

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select cmp_ok((select count(*) from public.securable_resources
                where commission_id = 'a0000000-0000-0000-0000-0000000000a1'), '>', 0::bigint,
  'K12a a commission member reads his own commission''s registry rows (non-vacuous: CCIH has seeded resources)');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
set local role authenticated;
select is((select count(*)::int from public.securable_resources
            where commission_id = 'a0000000-0000-0000-0000-0000000000a1'), 0,
  'K12b a staff_admin of ANOTHER commission reads ZERO CCIH registry rows (member-or-tenancy boundary)');
reset role;

-- =============================================================================
-- K9 — the five program flags, asserted as the SEEDED state (§7.3). Rewritten
-- at S4 spawn: seed.sql now forces foundation + wave_a ON for local/E2E (the
-- MIN pattern; production defaults stay OFF from 20260923000600 until the S5
-- choreography). wave_b/c/d remain OFF everywhere.
-- =============================================================================

select is(
  (select count(*)::int from app.feature_flags
    where key in ('documents_foundation','documents_wave_a','documents_wave_b',
                  'documents_wave_c','documents_wave_d')),
  5, 'K9 all five DM flags exist');
-- ⚠ AMENDED BY DM3 (2026-08-13). Wave B shipped, so `documents_wave_b` moved
-- from the OFF set to the ON set in seed.sql. K9b/K9c and that seed line are ONE
-- artifact — this is the coordinated edit K9 exists to force. wave_c/d remain
-- OFF (DM4/DM5 unbuilt); production defaults stay OFF for ALL of them until each
-- wave's gate closes with human approval.
select is(
  (select count(*)::int from app.feature_flags
    where key in ('documents_wave_c','documents_wave_d')
      and enabled = false),
  2, 'K9b the two still-unbuilt wave flags (c/d) are OFF');
select is(
  (select count(*)::int from app.feature_flags
    where key in ('documents_foundation','documents_wave_a','documents_wave_b')
      and enabled = true),
  3, 'K9c foundation + wave_a + wave_b are ON in the seeded local/E2E state (seed-forced; prod default OFF)');

-- =============================================================================
-- K10 — the D11 read-verb registry, post-S2 (FINDING 1a, DM2): attachment.read
-- is gone AND the document-open verb left the registry — the open door mints
-- it internally, AFTER its own gate, so the registry's admin short-circuit
-- (DM1 QA MINOR-2) no longer touches this verb. Rewritten from the M6-era
-- block that asserted registry dispatch worked; suite 329 F1-F3 carries the
-- door-side pins.
-- =============================================================================

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select throws_ok(
  $q$ select public.log_audit_access('attachment.read', 'attachment',
        '32800000-0000-0000-0000-00000000d101', 'a0000000-0000-0000-0000-0000000000a1',
        'K10 probe') $q$,
  '23514', null,
  'K10a the attachment.read verb was removed from the audited-read registry');
select throws_ok(
  $q$ select public.log_audit_access('document.opened', 'document',
        '32800000-0000-0000-0000-00000000d101', 'a0000000-0000-0000-0000-0000000000a1',
        'Documento aberto (K10)') $q$,
  '23514', null,
  'K10b the document-open verb is NOT registry-dispatchable — even for the entitled home staff_admin (the allowlist refuses before authorization)');
reset role;

select is(
  (select count(*)::int from public.audit_log
    where action = 'document.opened'
      and entity_id = '32800000-0000-0000-0000-00000000d101'),
  0, 'K10c the refused attempt minted NOTHING (the door is the only writer of this verb)');

select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_audit_access_authorized')
    !~ 'document\.opened',
  'K10d the registry dispatcher body carries no document arm (comment-stripped)');

-- =============================================================================
-- K8 — parked-seam writers refuse their document arms (HC0DM), fail-closed
-- until the owning wave re-points them (referrals → DM4; RCA citation →
-- Wave D; ethics → open item Q1). Personas + fixtures from seed.sql; the
-- document-id arguments are never dereferenced post-M1 (the guards raise
-- first), so these keystones survive the seed losing its attachment rows.
-- =============================================================================

-- K8a fixture: a DRAFT referral from Caso 0001 (CCIH → Farmácia), direct
-- insert under the referral guard GUC (the seed dialect).
select set_config('app.in_referral_rpc', 'on', true);
insert into public.case_referral
  (id, source_case_id, source_commission_id, target_commission_id,
   referral_type_id, type_label, subject, response_expected, created_by, status)
values
  ('328e0000-0000-0000-0000-0000000000d1',
   'd0000000-0000-0000-0000-0000000000c1',       -- Caso 0001 (CCIH)
   'a0000000-0000-0000-0000-0000000000a1',       -- CCIH (source)
   'b0000000-0000-0000-0000-0000000000b1',       -- Farmácia (target)
   (select id from public.referral_types where key = 'parecer'),
   'Parecer', 'Fixture K8a (DM1)', true,
   '00000000-0000-0000-0000-000000000002',       -- chefe.ccih
   'draft');
select set_config('app.in_referral_rpc', 'off', true);

select test_helpers.claims_for(
  '00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select throws_ok(
  $$ select public.add_referral_shared_item(
       '328e0000-0000-0000-0000-0000000000d1', 'document', null,
       'a3300000-0000-0000-0000-0000000000a1') $$,
  'HC0DM',
  'o compartilhamento de documentos do caso está temporariamente indisponível (migração do modelo de documentos)',
  'K8a add_referral_shared_item refuses its document arm (parked until DM4)');
reset role;

-- K8b: the seeded in-progress RCA (chefe.ccih is its team lead) refuses a
-- document CITATION (the cited_document_id seam, parked until Wave D).
select test_helpers.claims_for(
  '00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
set local role authenticated;
select throws_ok(
  $$ select public.add_rca_evidence(
       'f3000000-0000-0000-0000-0000000000a3', 'citation',
       'Citação de documento (K8b)', null, null, 'document',
       'a3300000-0000-0000-0000-0000000000a1', 'Rótulo K8b') $$,
  'HC0DM',
  'a citação de documento como evidência está temporariamente indisponível (migração do modelo de documentos)',
  'K8b add_rca_evidence refuses a document citation (parked until Wave D)');
reset role;

-- K8c — REMOVED BY DM3 (2026-08-13; ADR 0114 Amendment 2 / D17, discharge
-- condition 4). It pinned the DM1 fail-closed HC0DM refusal on
-- issue_ethics_notification's related_document_id. The PO ruled that seam into
-- Wave B, so the product no longer wants that refusal — and a keystone left
-- pinning a refusal the product no longer wants is a test asserting a bug.
--
-- ⚠ K8a and K8b STAY. "Remove keystone K8" as originally written named an
-- object that is not one: K8a is the REFERRAL seam (parked until DM4) and K8b
-- the RCA seam (parked until Wave D). Removing "K8" literally would have
-- deleted two parked-seam pins that other waves still depend on.
--
-- The seam is NOT left unpinned — the pin inverted from "this is refused" to
-- "this is allowed, exactly this far": suite 330 DM3·E1 (real FKs), E1b (the
-- same-case link is ACCEPTED), E2/E3 (cross-case refused by trigger and door
-- independently), E4 (no linking what you cannot read), E5/E6 (the decision-
-- letter writer and its ACL).

-- =============================================================================
-- K14 — the D15 confidentiality ceiling (DM2·S1; ADR 0114 Amendment 1, restores
-- ADR 0072 D7 semantics). The two enforcing labels (legal_privileged,
-- credentialing_sensitive) gate ABOVE home-resource read as an AND-conjunct in
-- app.can_read_document; clearance rides case_access_grants.max_confidentiality
-- through the SURVIVING app.confidentiality_clearance_ok (reused, never
-- reimplemented — its carrier keystones live in 144/238; O2 semantics —
-- ethics_investigation stays at case-read — are inherited from it).
-- The meeting/action_item seam is ruled UNREPRESENTABLE at write time
-- (trg_guard_document_confidentiality → HC0D6; HC0D5 is TAKEN by
-- revoke_printed_document, verified against comment-stripped pg_proc.prosrc)
-- with a fail-closed read backstop in the kernel. The backstop is reachable
-- only with the guard dropped — proven by the S1 mutation twin (guard dropped
-- in a rolled-back txn -> enforcing meeting doc plants -> kernel refuses
-- EVERYONE incl. its creator; control: relabel to ethics_investigation -> true).
-- K14s4/K14s5 are PRESERVATION pins (green on both sides by design — their red
-- is "the S1 re-emit lost a property", the accident they exist to catch).
-- RED-FIRST (lead AMEND 1, two-migration split): structural + guard pins
-- observed red pre-20260924000100 (have false / caught 42703); the behavioral
-- ceiling pins ran RED against the REAL post-column, pre-arm catalog
-- (20260924000100 applied, 20260924000200 not yet) — quoted in the S1 record.
-- S2 obligations (DM2 ledger): refused-open + clearance-admits-open land on
-- open_document_version.
-- =============================================================================

-- Structural pins.
select has_column('public', 'documents', 'confidentiality_level',
  'K14s1 documents.confidentiality_level exists (the D15 column)');
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.documents'::regclass
      and conname = 'documents_confidentiality_level_check'),
  1, 'K14s2 the 7-value CHECK is present (sibling-shaped, NULL legal)');
select is(
  (select count(*)::int from pg_trigger
    where tgrelid = 'public.documents'::regclass
      and tgname = 'trg_guard_document_confidentiality' and not tgisinternal),
  1, 'K14s3 the confidentiality seam guard trigger is attached');
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_document'),
  true, 'K14s4 the kernel kept SECURITY DEFINER through the S1 re-emit (preservation pin)');
select ok(
  (select array_to_string(p.proconfig, '|') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_document')
    ~ 'search_path=app, public, pg_catalog',
  'K14s5 the kernel kept its pinned search_path (preservation pin)');
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_document')
    ~ 'confidentiality_clearance_ok',
  'K14s6 the ceiling arm is present in the kernel (comment-stripped)');

-- K14a/b/c — the seam at write time: enforcing labels are unrepresentable on
-- homes with no clearance plane; non-enforcing labels stay legal everywhere.
select throws_ok(
  $q$ insert into public.documents (id, home_resource_id, title, created_by, confidentiality_level)
      values ('32800000-0000-0000-0000-00000000d301',
              (select id from public.securable_resources
                where resource_type = 'meeting'
                  and commission_id = 'a0000000-0000-0000-0000-0000000000a1' limit 1),
              'Documento K14a (reuniao, privilegiado)',
              '00000000-0000-0000-0000-000000000002', 'legal_privileged') $q$,
  'HC0D6', null,
  'K14a an enforcing label on a MEETING-homed document is refused (HC0D6 — no clearance plane)');

select lives_ok(
  $q$ insert into public.documents (id, home_resource_id, title, created_by, confidentiality_level)
      values ('32800000-0000-0000-0000-00000000d302',
              (select id from public.securable_resources
                where resource_type = 'meeting'
                  and commission_id = 'a0000000-0000-0000-0000-0000000000a1' limit 1),
              'Documento K14b (reuniao, investigacao)',
              '00000000-0000-0000-0000-000000000002', 'ethics_investigation') $q$,
  'K14b1 a NON-enforcing label stays legal on a meeting home (the guard does not over-narrow)');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d302'),
  1, 'K14b2 …and a plain member still reads it (ethics_investigation never gates — O2, inherited)');
reset role;

select throws_ok(
  $q$ insert into public.documents (id, home_resource_id, title, created_by, confidentiality_level)
      values ('32800000-0000-0000-0000-00000000d303',
              (select id from public.securable_resources where resource_type = 'action_item' limit 1),
              'Documento K14c (pendencia, privilegiado)',
              '00000000-0000-0000-0000-000000000002', 'credentialing_sensitive') $q$,
  'HC0D6', null,
  'K14c an enforcing label on an ACTION_ITEM-homed document is refused (no source_* resolution — ruled)');

-- K14g/h — the UPDATE leg of the seam guard.
select throws_ok(
  $q$ update public.documents set confidentiality_level = 'legal_privileged'
      where id = '32800000-0000-0000-0000-00000000d102' $q$,
  'HC0D6', null,
  'K14g relabelling a MEETING-homed document to an enforcing label is refused (UPDATE leg)');
select lives_ok(
  $q$ update public.documents set confidentiality_level = 'legal_privileged'
      where id = '32800000-0000-0000-0000-00000000d101' $q$,
  'K14h relabelling a CASE-homed document to an enforcing label proceeds (no over-block on case homes)');

-- K14d — the deny legs, maximally differential with K11h: SAME persona
-- (staff1), SAME rows (d101 -> e101 -> f101) K11h read minutes ago — the ONE
-- variable is the label K14h just applied.
select lives_ok(
  $q$ insert into public.documents (id, home_resource_id, title, created_by, confidentiality_level)
      values ('32800000-0000-0000-0000-00000000d304',
              'f2000000-0000-0000-0000-0000000000e1',
              'Documento K14d (entrevista, privilegiado)',
              '00000000-0000-0000-0000-000000000002', 'legal_privileged') $q$,
  'K14d0 an enforcing label on an INTERVIEW-homed document is legal (resolves via case_of_interview)');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d101'),
  0, 'K14d1 UNCLEARED: the privileged case document vanishes from the reader who read it at K11h');
select is((select count(*)::int from public.document_versions where id = '32800000-0000-0000-0000-00000000e101'),
  0, 'K14d2 UNCLEARED: …and its version (the ceiling propagates through can_read_document_version)');
select is((select count(*)::int from public.file_objects where id = '32800000-0000-0000-0000-00000000f101'),
  0, 'K14d3 UNCLEARED: …and its file object (chain-only — the MAJOR-1 removal is what makes this governable)');
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d304'),
  0, 'K14d4 UNCLEARED: the privileged interview document is absent for a committee reader without clearance');
reset role;

-- ONE variable flips: a clearance grant on Caso 0001 — the case behind BOTH
-- the case-homed chain and the seeded interview (verified pre-authoring:
-- staff1 holds NO prior grant on it; his case-read rides another content
-- source, so this grant adds clearance, not reach).
select test_helpers.grant_ca('d0000000-0000-0000-0000-0000000000c1'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid, 'read',
  '00000000-0000-0000-0000-000000000002'::uuid, null, 'legal_privileged');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false, 'staff');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d101'),
  1, 'K14f1 CLEARED: max_confidentiality = legal_privileged admits the case document back');
select is((select count(*)::int from public.document_versions where id = '32800000-0000-0000-0000-00000000e101'),
  1, 'K14f2 CLEARED: …and its version');
select is((select count(*)::int from public.file_objects where id = '32800000-0000-0000-0000-00000000f101'),
  1, 'K14f3 CLEARED: …and its file object');
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d304'),
  1, 'K14f4 CLEARED: the interview document too (clearance resolved on case_of_interview)');
reset role;

-- =============================================================================
-- K15 — the INTERVIEW's own ceiling propagates to its documents (QA r1 MAJOR-1
-- / S1-O4; PO ruling 2026-08-13: PROPAGATE; ADR 0117 Amendment 1). The defect
-- (lead-reproduced as a differential probe): can_read_interview(iv, member) =
-- false while can_read_document(doc_homed_on_iv, member) = true — the
-- interview ROW is hidden, its transcript is not, because the kernel's
-- interview arm dispatched can_read_case_committee(case_of_interview(...)),
-- skipping the level where case_interviews.confidentiality_level lives. The
-- fix (20260924000800) dispatches the arm to app.can_read_interview — which IS
-- the current arm's predicate AND the missing clearance conjunct
-- (catalog-verified equivalence), so it cannot over-narrow: clearance_ok
-- returns true for every non-enforcing label (K15t twins pin exactly that).
-- Distinct from D15/K14: K14d4 gates on the DOCUMENT's own label; K15 gates on
-- the INTERVIEW's, with the document deliberately label-NULL — one dimension
-- per keystone family. Persona: staff2 (…004) — committee-read on Caso 0001,
-- HOLDS read_case_deliberation (so the corridor red cannot be the QO·B byte
-- cut — K15c3), holds NO clearance grant anywhere (verified pre-authoring;
-- K14f granted staff1, never staff2).
-- RED-FIRST record: K15k1–k4 + K15s1 observed RED against the real,
-- unmutated pre-20260924000800 catalog (K15c1 green + K15k1 red = the
-- MAJOR-1 differential rendered in TAP); output quoted in the phase record.
-- =============================================================================

-- Fixture writes attributed to chefe (audit triggers want an actor).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');

-- A document homed on the SEEDED interview (f2…e1, Caso 0001) carrying NO
-- label of its own — isolating the interview dimension — plus a version row
-- so the byte corridor is probeable.
insert into public.documents (id, home_resource_id, title, created_by)
values ('32800000-0000-0000-0000-00000000d305',
        'f2000000-0000-0000-0000-0000000000e1',
        'Documento K15 (entrevista, sem rótulo próprio)',
        '00000000-0000-0000-0000-000000000002');
insert into public.document_versions (id, document_id, version_number, created_by)
values ('32800000-0000-0000-0000-00000000e305', '32800000-0000-0000-0000-00000000d305',
        1, '00000000-0000-0000-0000-000000000002');

-- K15t — the NON-OVER-NARROWING TWINS, before the flip: with the seed's
-- non-enforcing interview label, the uncleared member keeps reading. Green on
-- BOTH sides by design — their red is "the fix denies where no ceiling
-- enforces", the over-narrowing accident they exist to catch.
select is((select confidentiality_level from public.case_interviews
            where id = 'f2000000-0000-0000-0000-0000000000e1'),
  'non_phi_internal',
  'K15t0 fixture: the seeded interview carries the non-enforcing seed label (asserted, never assumed)');
select ok(app.can_read_document('32800000-0000-0000-0000-00000000d305',
          '00000000-0000-0000-0000-000000000004'),
  'K15t1 TWIN: a non-enforcing interview label leaves its documents readable (kernel)');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000004'::uuid, false, 'staff');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d305'),
  1, 'K15t2 TWIN: …and under RLS');
reset role;

-- THE FLIP — one variable: the INTERVIEW's own label. The document stays
-- label-NULL throughout.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
update public.case_interviews set confidentiality_level = 'legal_privileged'
 where id = 'f2000000-0000-0000-0000-0000000000e1';

-- K15c — fixture non-vacuity controls (green on both sides): the K15k denials
-- below must be the ceiling and nothing else.
select ok(not app.can_read_interview('f2000000-0000-0000-0000-0000000000e1',
          '00000000-0000-0000-0000-000000000004'),
  'K15c1 control: the interview ROW is hidden from the uncleared member (the differential''s other arm)');
select ok(app.can_read_case_committee('d0000000-0000-0000-0000-0000000000c1',
          '00000000-0000-0000-0000-000000000004'),
  'K15c2 control: committee case-read is intact (the deny is not lost reach)');
select ok(app.has_case_capability('d0000000-0000-0000-0000-0000000000c1',
          '00000000-0000-0000-0000-000000000004', 'read_case_deliberation'),
  'K15c3 control: the member holds deliberation (the corridor red cannot be the QO·B byte cut)');

-- K15k — THE KEYSTONES. Red pre-20260924000800: the kernel served the
-- document (k1: true, k2/k3: count 1, k4: HC0D8 past the kernel).
select ok(not app.can_read_document('32800000-0000-0000-0000-00000000d305',
          '00000000-0000-0000-0000-000000000004'),
  'K15k1 KEYSTONE: the interview''s ceiling gates its documents (kernel refuses the uncleared member)');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000004'::uuid, false, 'staff');
set local role authenticated;
select is((select count(*)::int from public.documents where id = '32800000-0000-0000-0000-00000000d305'),
  0, 'K15k2 KEYSTONE: …invisible under RLS');
select is((select count(*)::int from public.document_versions where id = '32800000-0000-0000-0000-00000000e305'),
  0, 'K15k3 KEYSTONE: …and its version (propagation through the kernel chain)');
reset role;
select test_helpers.claims_for('00000000-0000-0000-0000-000000000004'::uuid, false, 'staff');
select throws_ok(
  $q$ select public.open_document_version('32800000-0000-0000-0000-00000000e305') $q$,
  'P0002', 'versão de documento não encontrada',
  'K15k4 KEYSTONE: the byte corridor refuses byte-identically to absence (the kernel arm, not the byte cut — K15c3)');

-- K15g — clearance ADMITS (the conjunct narrows by clearance, not by class;
-- green on both sides — its red is "the fix broke the clearance path").
select test_helpers.grant_ca('d0000000-0000-0000-0000-0000000000c1'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid, 'read',
  '00000000-0000-0000-0000-000000000002'::uuid, null, 'legal_privileged');
select ok(app.can_read_document('32800000-0000-0000-0000-00000000d305',
          '00000000-0000-0000-0000-000000000004'),
  'K15g1 CLEARED: max_confidentiality = legal_privileged re-admits the interview document');
select ok(app.can_read_interview('f2000000-0000-0000-0000-0000000000e1',
          '00000000-0000-0000-0000-000000000004'),
  'K15g2 CLEARED: …and the interview row itself — the two predicates agree in BOTH directions');

-- K15s — resolve-shape: the interview arm dispatches app.can_read_interview
-- (comment-stripped prosrc; red pre-fix).
select ok(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_document')
    ~ 'can_read_interview',
  'K15s1 the kernel''s interview arm routes app.can_read_interview (the level-skipping dispatch is gone)');

-- =============================================================================
-- K16 — THE KILL SWITCH, enforced (QA r1 INFO-2 / pause-handoff item 5).
-- `documents_wave_a` gates the UI; `documents_foundation` gates the doors
-- (app.assert_documents_enabled, first statement of every door). So wave_a
-- alone is NOT a kill switch, and "the two flip together" was prose with
-- nothing enforcing it. The ruling here: the claim is made ACCURATE and the
-- property that matters is PINNED — foundation alone kills the module — no
-- flag-pair trigger is added (a refuse-style dependency would SLOW the
-- incident lever by demanding a wave_a flip first; a cascade trigger is
-- unruled ops magic). K16a/b/c carry their own differential: the SAME call,
-- one variable (the foundation flag), HC0D7 dead vs HC0D8 alive. K16s2's
-- reach, stated honestly: it catches an assert REMOVED from the existing
-- doors; a FUTURE door that forgets the assert changes no count here — that
-- is its own suite's keystone obligation (new-door-inherits-every-arm).
-- =============================================================================

-- Precondition: wave_a is ON while the doors die — the pin is precisely
-- "wave_a does NOT keep the module alive".
select is(app.feature_enabled('documents_wave_a'), true,
  'K16p precondition: documents_wave_a is ON (seed-forced) while foundation is cut');

update app.feature_flags set enabled = false where key = 'documents_foundation';

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.open_document_version('32800000-0000-0000-0000-00000000e305') $q$,
  'HC0D7', null,
  'K16a foundation OFF kills the READ door (HC0D7 before any other gate), wave_a ON notwithstanding');
select throws_ok(
  $q$ select public.begin_document_upload('case', 'd0000000-0000-0000-0000-0000000000c1',
        'Documento K16 (kill switch)', null, null, null, 'k16.pdf', 'application/pdf', 100) $q$,
  'HC0D7', null,
  'K16b …and the WRITE door — one lever, the whole module');

update app.feature_flags set enabled = true where key = 'documents_foundation';

-- The differential's other arm: the SAME call, the one variable restored —
-- the door is alive again and fails only at its normal gate (no file bound).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000004'::uuid, false, 'staff');
select throws_ok(
  $q$ select public.open_document_version('32800000-0000-0000-0000-00000000e305') $q$,
  'HC0D8', 'arquivo ainda não disponível',
  'K16c foundation ON revives the same call (HC0D8 at file-absence — the flag was the only variable)');

-- wave_a is UI-only, structurally: NO function in app/public consults it
-- (comment-stripped). If a future change makes wave_a load-bearing in the
-- DB, this pin forces the kill-switch claim to be rewritten consciously.
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'documents_wave_a'),
  0,
  'K16s1 documents_wave_a is consulted by ZERO database functions (UI-only, by pin not prose)');

-- The existing door census: every one of the 12 public DEFINER doors asserts
-- the foundation flag. Catches a removed assert; grows consciously with DM3.
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'assert_documents_enabled'),
  12,
  'K16s2 all 12 public DEFINER document doors assert documents_foundation (exact census — update consciously when DM3 adds doors)');

select * from finish();
rollback;
