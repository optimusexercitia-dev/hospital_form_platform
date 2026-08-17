-- =============================================================================
-- 340 — DM4 (Wave C): referral documents on the core document model.
-- ADR 0119; plan docs/plans/dm4-referrals-plan.md; approved M1–M4.
--
-- ⭐ RED-FIRST RECORD: authored BEFORE migrations 20260926000100–000400 and run
-- against the pre-migration catalog. Assertions marked ⭐ were observed RED on
-- that run (the run log is quoted in the phase record). Assertions marked
-- [MATRIX] are green-on-first-run BY CONSTRUCTION (an earlier barrier or a
-- pre-existing refusal satisfies them today) — their proof is the one-at-a-time
-- neutralization matrix (each excluded state opened INDEPENDENTLY in a
-- rolled-back txn, suite required red; DM3's one-barrier-two-codes lesson).
-- Assertions marked [CONTROL] pin a premise so a red keystone cannot be a
-- wrong-arm fixture (authz-handoff §7.1).
--
-- Column-existence discipline: rows are probed via to_jsonb(row)->>'col' and
-- functions via to_regproc so the PRE-migration run fails RED instead of
-- aborting at an undefined column/function.
--
-- ⚠ Both write doors return COMPOSITES and the read doors return JSONB — the
-- unruled census blind class: ARM=census/hat/floor/wrapper pass for this file's
-- surface NO MATTER WHAT. This file (+ the matrix) is the evidence.
--
-- ⭐ MULTI-APPLICATION RULE (matrix finding N10a; wording corrected at QA r1
-- MINOR-2 — read this before "proving" a gate is not load-bearing): a guard
-- may be APPLIED at more than one point. Opening the snapshot door's PHI gate
-- alone leaks nothing — log_audit_access's referral.viewed registry arm
-- re-checks the SAME can_read_referral_phi predicate and raises. That is one
-- predicate applied twice, NOT two independent locks; bypassing one
-- application proves nothing about the other, and observing "no leak" after
-- a single-application bypass proves nothing at all. Bypass each application
-- alone AND both together (dm4-referral-doors-matrix.sh N10a/N10b), and
-- prove the door can OVER-NARROW too (N14a/N14b — the positive-twin
-- polarity).
-- =============================================================================
begin;
select plan(82);

-- ---------------------------------------------------------------------------
-- Preconditions (fixture-flag-gaps: assert flags, never assume the seed)
-- ---------------------------------------------------------------------------
select is((select enabled from app.feature_flags where key = 'case_referrals'), true,
  'P1 precondition: case_referrals flag is ON');
select is((select enabled from app.feature_flags where key = 'documents_foundation'), true,
  'P2 precondition: documents_foundation flag is ON');
select is((select count(*)::int from app.feature_flags where key = 'documents_wave_c'), 1,
  'P3 precondition: the documents_wave_c flag row exists');
-- The corridor keystones need Wave C ON; B9/C7 open OFF windows and restore.
update app.feature_flags set enabled = true where key = 'documents_wave_c';

-- ---------------------------------------------------------------------------
-- Fixtures. Personas/rows from the seed (uuids, not emails):
--   chefe.ccih  ...0002  source staff_admin (coordinator, PHI tier)
--   staff1.ccih ...0003  source member       (metadata tier, NOT PHI)
--   chefe.farm  ...0005  target staff_admin  (PHI tier once non-draft)
--   staff1.farm ...0006  target member       (metadata tier, NOT PHI)
--   platform    ...00b0  platform_admin      (noun rule: NO commission content)
--   admin       ...0001  org_admin Rede A    (disposer arm)
--   CCIH a0…a1 · Farmácia b0…b1 · Caso 0001 d0…c1 · case-B dba0…b1
--   ENC-0001 efa0…a1 (completed) · ENC-0002 efa0…a2 (sent)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);

-- Two fixture referrals: a DRAFT (freeze surface) and an IN_REVIEW (reply-upload
-- surface). Direct inserts mirror the seed's pattern.
insert into public.case_referral
  (id, source_case_id, source_commission_id, target_commission_id, referral_type_id,
   type_label, subject, response_expected, created_by, status)
select '34de0000-0000-0000-0000-0000000000d1', 'd0000000-0000-0000-0000-0000000000c1',
       'a0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-0000000000b1',
       rt.id, 'Parecer', '340 fixture — draft', true,
       '00000000-0000-0000-0000-000000000002', 'draft'
  from public.referral_types rt where rt.key = 'parecer';
insert into public.case_referral
  (id, source_case_id, source_commission_id, target_commission_id, referral_type_id,
   type_label, subject, response_expected, created_by, status,
   sent_at, sent_by, received_at, received_by, decided_at, decided_by)
select '34de0000-0000-0000-0000-0000000000d2', 'd0000000-0000-0000-0000-0000000000c1',
       'a0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-0000000000b1',
       rt.id, 'Parecer', '340 fixture — in review', true,
       '00000000-0000-0000-0000-000000000002', 'in_review',
       now(), '00000000-0000-0000-0000-000000000002',
       now(), '00000000-0000-0000-0000-000000000005',
       now(), '00000000-0000-0000-0000-000000000005'
  from public.referral_types rt where rt.key = 'parecer';
-- A DT-TARGETED referral in review (ADR 0094 W4): the target is the technical
-- direction of the SOURCE commission's own hospital; dt.a (…f1) is its titular.
insert into public.case_referral
  (id, source_case_id, source_commission_id, target_commission_id,
   target_type, target_hospital_id, target_hospital_name, referral_type_id,
   type_label, subject, response_expected, created_by, status,
   sent_at, sent_by, received_at, received_by, decided_at, decided_by)
select '34de0000-0000-0000-0000-0000000000d3', 'd0000000-0000-0000-0000-0000000000c1',
       'a0000000-0000-0000-0000-0000000000a1', null,
       'technical_director', '05000000-0000-0000-0000-00000000000a', 'Hospital Central A',
       rt.id, 'Parecer', '340 fixture — DT-targeted, in review', true,
       '00000000-0000-0000-0000-000000000002', 'in_review',
       now(), '00000000-0000-0000-0000-000000000002',
       now(), '00000000-0000-0000-0000-0000000000f1',
       now(), '00000000-0000-0000-0000-0000000000f1'
  from public.referral_types rt where rt.key = 'parecer';

-- Case-homed documents on Caso 0001 (registry rows exist since DM1):
--   c1 plain (the freeze target) · c2 enforcing-labelled · c4 plain, never
--   frozen until C15. c3 homes on case-B (cross-case refusal).
insert into public.documents (id, home_resource_id, title, kind, status, created_by, confidentiality_level) values
  ('34dd0000-0000-0000-0000-0000000000c1', 'd0000000-0000-0000-0000-0000000000c1',
   'Prescrição eletrônica', 'digitalizacao', 'active', '00000000-0000-0000-0000-000000000002', null),
  ('34dd0000-0000-0000-0000-0000000000c2', 'd0000000-0000-0000-0000-0000000000c1',
   'Parecer jurídico reservado', 'registro', 'active', '00000000-0000-0000-0000-000000000002', 'legal_privileged'),
  ('34dd0000-0000-0000-0000-0000000000c3', 'dba00000-0000-0000-0000-0000000000b1',
   'Documento do caso B', 'registro', 'active', '00000000-0000-0000-0000-000000000005', null),
  ('34dd0000-0000-0000-0000-0000000000c4', 'd0000000-0000-0000-0000-0000000000c1',
   'Evolução digitalizada', 'digitalizacao', 'active', '00000000-0000-0000-0000-000000000002', null);
insert into public.document_versions (id, document_id, version_number, created_by)
select ('34dc0000-0000-0000-0000-0000000000'||sfx)::uuid, ('34dd0000-0000-0000-0000-0000000000'||sfx)::uuid,
       1, '00000000-0000-0000-0000-000000000002'
  from unnest(array['c1','c2','c3','c4']) as sfx;
insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by)
select ('34df0000-0000-0000-0000-0000000000'||sfx)::uuid, 'documents-phi',
       '0c000000-0000-0000-0000-00000000000a/34df-'||sfx||'/'||gen_random_uuid(),
       'phi', '00000000-0000-0000-0000-000000000002'
  from unnest(array['c1','c2','c3','c4']) as sfx;
-- Fixtures walk LEGAL transitions (ADR 0116 #5; guard_file_object_transition):
-- reserved→uploaded→verifying→scan_pending→unscanned_accepted.
update public.file_objects set upload_state = 'uploaded', uploaded_at = now()
 where id::text like '34df0000%';
-- size/MIME land at 'verifying', server-derived — mirrors finalize (D9).
update public.file_objects
   set upload_state = 'verifying', mime_type = 'application/pdf', size_bytes = 4321
 where id::text like '34df0000%';
update public.file_objects set upload_state = 'scan_pending'
 where id::text like '34df0000%';
update public.file_objects set upload_state = 'unscanned_accepted', verified_at = now()
 where id::text like '34df0000%';
insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
select ('34dc0000-0000-0000-0000-0000000000'||sfx)::uuid,
       ('34df0000-0000-0000-0000-0000000000'||sfx)::uuid, 'source'
  from unnest(array['c1','c2','c3','c4']) as sfx;

select is(
  (select count(*)::int from public.document_version_files vf
    join public.file_objects f on f.id = vf.file_object_id
   where vf.document_version_id = '34dc0000-0000-0000-0000-0000000000c1'
     and vf.rendition_kind = 'source'
     and f.upload_state = 'unscanned_accepted'),
  1, 'P4 [CONTROL] doc c1 has a servable source binding (C1 red cannot be a wrong-arm fixture)');

-- Late-bound shim: plpgsql resolves the door at CALL time, so the PRE-migration
-- run records '"__ABSENT__"' (RED) instead of aborting at parse. Only 42883 is
-- absorbed — a genuine door error still propagates loudly.
create function pg_temp.snap(p_item uuid) returns jsonb
language plpgsql as $f$
begin
  return public.open_referral_snapshot_document(p_item);
exception when undefined_function then
  return '"__ABSENT__"'::jsonb;
end $f$;

-- Referral-homed document fixtures (registry rows exist only post-M1 —
-- guarded DO so the PRE-migration run goes red, not abort):
--   e1 on ENC-0001 (kernel/byte keystones) · e2 on R-REV (write-arm keystone).
do $$ begin
  insert into public.documents (id, home_resource_id, title, kind, status, created_by) values
    ('34dd0000-0000-0000-0000-0000000000e1', 'efa00000-0000-0000-0000-0000000000a1',
     'Anexo de resposta (fixture)', 'anexo_resposta', 'active', '00000000-0000-0000-0000-000000000005'),
    ('34dd0000-0000-0000-0000-0000000000e2', '34de0000-0000-0000-0000-0000000000d2',
     'Anexo em elaboração (fixture)', 'anexo_resposta', 'active', '00000000-0000-0000-0000-000000000005'),
    ('34dd0000-0000-0000-0000-0000000000e3', '34de0000-0000-0000-0000-0000000000d3',
     'Anexo DT (fixture)', 'anexo_resposta', 'active', '00000000-0000-0000-0000-0000000000f1');
  insert into public.document_versions (id, document_id, version_number, created_by) values
    ('34dc0000-0000-0000-0000-0000000000e1', '34dd0000-0000-0000-0000-0000000000e1', 1,
     '00000000-0000-0000-0000-000000000005');
  insert into public.file_objects (id, storage_bucket, storage_path, sensitivity_tier, created_by) values
    ('34df0000-0000-0000-0000-0000000000e1', 'documents-phi',
     '0c000000-0000-0000-0000-00000000000a/34df-e1/' || gen_random_uuid(), 'phi',
     '00000000-0000-0000-0000-000000000005');
  update public.file_objects set upload_state = 'uploaded', uploaded_at = now()
   where id = '34df0000-0000-0000-0000-0000000000e1';
  update public.file_objects set upload_state = 'verifying'
   where id = '34df0000-0000-0000-0000-0000000000e1';
  update public.file_objects set upload_state = 'scan_pending'
   where id = '34df0000-0000-0000-0000-0000000000e1';
  update public.file_objects set upload_state = 'unscanned_accepted', verified_at = now()
   where id = '34df0000-0000-0000-0000-0000000000e1';
  insert into public.document_version_files (document_version_id, file_object_id, rendition_kind)
  values ('34dc0000-0000-0000-0000-0000000000e1', '34df0000-0000-0000-0000-0000000000e1', 'source');
exception when others then
  raise notice '340 fixture pending migration: %', sqlerrm;
end $$;

-- =============================================================================
-- A — M1: the securable registry gains 'case_referral'
-- =============================================================================
select is(
  (select count(*)::int from public.securable_resources s
    where s.resource_type = 'case_referral'
      and s.id in ('efa00000-0000-0000-0000-0000000000a1', 'efa00000-0000-0000-0000-0000000000a2')),
  2, 'A1 ⭐ both seeded referrals have registry rows (backfill path)');
select is(
  (select (select count(*)::int from public.case_referral r
            where not exists (select 1 from public.securable_resources s
                               where s.id = r.id and s.resource_type = 'case_referral'))
        + (select count(*)::int from public.securable_resources s
            where s.resource_type = 'case_referral'
              and not exists (select 1 from public.case_referral r where r.id = s.id))),
  0, 'A2a ⭐ registry anti-join is empty in BOTH directions');
select cmp_ok(
  (select count(*)::int from public.securable_resources where resource_type = 'case_referral'),
  '>=', 4, 'A2b [CONTROL] the anti-join counted real rows (seed 2 + fixtures 2), not an empty set');
select is(
  (select s.organization_id::text || '|' || s.commission_id::text
     from public.securable_resources s
    where s.id = '34de0000-0000-0000-0000-0000000000d1' and s.resource_type = 'case_referral'),
  '0c000000-0000-0000-0000-00000000000a|a0000000-0000-0000-0000-0000000000a1',
  'A3 ⭐ inserting a referral MINTS its registry row with source-commission anchors (trigger path)');
select is(
  (select count(*)::int from pg_constraint
    where conname = 'case_referral_securable_resource_fk'
      and conrelid = 'public.case_referral'::regclass),
  1, 'A4 ⭐ the composite (id, securable_type) FK pins the registry link');

-- =============================================================================
-- B — M2: kernel arms + corridor (two-tier asymmetry, BOTH halves)
-- =============================================================================
select is(
  app.can_read_document('34dd0000-0000-0000-0000-0000000000e1',
                        '00000000-0000-0000-0000-000000000006'),
  true, 'B1 ⭐ BROAD half: a metadata-tier reader (target member) sees a referral-homed document row');
select is(
  app.is_member_of_for('b0000000-0000-0000-0000-0000000000b1',
                       '00000000-0000-0000-0000-000000000006'),
  true, 'B2 [CONTROL] staff1.farm genuinely holds Farmácia membership');
select is(
  app.can_read_referral_phi('efa00000-0000-0000-0000-0000000000a1',
                            '00000000-0000-0000-0000-000000000006'),
  false, 'B3 [CONTROL] staff1.farm is metadata-tier, NOT PHI (the persona the twin needs)');
select is(
  app.can_read_document('34dd0000-0000-0000-0000-0000000000e1',
                        '00000000-0000-0000-0000-0000000000b0'),
  false, 'B4 [MATRIX] noun rule: platform_admin reads NO referral-homed document');

select is(
  app.can_write_document('34dd0000-0000-0000-0000-0000000000e2',
                         '00000000-0000-0000-0000-000000000005'),
  true, 'B5 ⭐ the TARGET coordinator writes while the referral is in_review');
select is(
  app.can_write_document('34dd0000-0000-0000-0000-0000000000e2',
                         '00000000-0000-0000-0000-000000000006'),
  false, 'B6a [MATRIX] a metadata-tier member does NOT write');
select is(
  app.can_write_document('34dd0000-0000-0000-0000-0000000000e2',
                         '00000000-0000-0000-0000-000000000002'),
  false, 'B6b [MATRIX] the SOURCE coordinator does NOT write reply documents');
select is(
  app.can_write_document('34dd0000-0000-0000-0000-0000000000e1',
                         '00000000-0000-0000-0000-000000000005'),
  false, 'B6c [MATRIX] a COMPLETED referral takes no more reply documents');
select is(
  app.can_write_document('34dd0000-0000-0000-0000-0000000000e3',
                         '00000000-0000-0000-0000-0000000000f1'),
  true, 'B5b ⭐ the DT OFFICE writes on a technical_director-targeted referral (catalog-verified arm of can_manage_referral_target)');
select is(
  app.can_write_document('34dd0000-0000-0000-0000-0000000000e3',
                         '00000000-0000-0000-0000-000000000005'),
  false, 'B5c [MATRIX] the target arm is TARGET-TYPE-scoped: a commission coordinator is not the DT office');

-- The begin corridor, end to end (target coordinator, in_review).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
-- Guarded so the PRE-migration run records B7/B8 as RED instead of aborting.
do $$ begin
  create temp table b7 on commit drop as
    select public.begin_document_upload(
      'case_referral', '34de0000-0000-0000-0000-0000000000d2',
      'Parecer anexo', null, null, null,
      'parecer.pdf', 'application/pdf', 4321, 'anexo_resposta', null) as r;
exception when others then
  create temp table b7 on commit drop as select null::jsonb as r;
  raise notice '340 B7 corridor pending migration: %', sqlerrm;
end $$;
select ok(
  (select r ? 'upload_session_id' and r ? 'document_version_id' and r ? 'file_object_id' from b7),
  'B7 ⭐ begin_document_upload reserves the corridor for a case_referral home');
select is(
  (select f.sensitivity_tier || '|' || f.storage_bucket from public.file_objects f
    where f.id = (select (r->>'file_object_id')::uuid from b7)),
  'phi|documents-phi',
  'B8 ⭐ the tier is SERVER-derived: referral reply bytes are PHI-tier');
select set_config('request.jwt.claims', '', true);

-- Wave-C gate: OFF refuses at the FIRST residue-producing step, home-scoped.
update app.feature_flags set enabled = false where key = 'documents_wave_c';
create temp table b9 on commit drop as
  select count(*)::int as docs from public.documents d
    join public.securable_resources s on s.id = d.home_resource_id
   where s.resource_type = 'case_referral';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.begin_document_upload(
        'case_referral', '34de0000-0000-0000-0000-0000000000d2',
        'Tentativa com flag OFF', null, null, null,
        'x.pdf', 'application/pdf', 100, 'anexo_resposta', null) $q$,
  'HC0D7', null,
  'B9a ⭐ wave-c OFF refuses BEGIN (the first residue-producing step)');
select is(
  (select count(*)::int from public.documents d
    join public.securable_resources s on s.id = d.home_resource_id
   where s.resource_type = 'case_referral'),
  (select docs from b9),
  'B9b ⭐ …and leaves ZERO referral-homed residue behind');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.begin_document_upload(
        'case', 'd0000000-0000-0000-0000-0000000000c1',
        'Wave A segue funcionando', null, null, null,
        'a.pdf', 'application/pdf', 100, 'digitalizacao', null) $q$,
  'B9c ⭐ the gate is HOME-SCOPED: Wave A begins fine with wave-c OFF (no blanket assert)');
select set_config('request.jwt.claims', '', true);
update app.feature_flags set enabled = true where key = 'documents_wave_c';

-- The byte corridor: PHI half serves + audits; metadata half is refused 42501.
create temp table b10pre on commit drop as
  select count(*)::int as n from public.audit_log
   where action = 'document.opened'
     and entity_id = '34dd0000-0000-0000-0000-0000000000e1';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.open_document_version('34dc0000-0000-0000-0000-0000000000e1') $q$,
  'B10a ⭐ NARROW half: a PHI-tier reader opens referral-homed bytes');
select is(
  (select count(*)::int from public.audit_log
    where action = 'document.opened'
      and entity_id = '34dd0000-0000-0000-0000-0000000000e1')
  - (select n from b10pre),
  1, 'B10b ⭐ …with exactly ONE document.opened audit row');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000006'::uuid, false);
select throws_ok(
  $q$ select public.open_document_version('34dc0000-0000-0000-0000-0000000000e1') $q$,
  '42501', null,
  'B10c ⭐ NARROW half: the SAME metadata-tier reader who sees the row (B1) is refused the BYTES');
select set_config('request.jwt.claims', '', true);

-- =============================================================================
-- C — M3: the freeze seam + the bespoke snapshot door
-- =============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000d1', 'document', null,
        '34dd0000-0000-0000-0000-0000000000c1') $q$,
  'C1a ⭐ the document arm is UN-PARKED: the source coordinator freezes a case document');
create temp table c1 on commit drop as
  select to_jsonb(s.*) as j, s.id as item
    from public.referral_shared_item s
   where s.referral_id = '34de0000-0000-0000-0000-0000000000d1' and s.kind = 'document';
select is(
  (select j->>'frozen_document_version_id' from c1),
  '34dc0000-0000-0000-0000-0000000000c1',
  'C1b ⭐ the freeze BINDS the immutable version (not a byte copy, not a path)');
select is(
  (select j->>'source_document_id' from c1),
  '34dd0000-0000-0000-0000-0000000000c1',
  'C1c ⭐ provenance pointer set by the SAME single writer the FK was taught through');
select is(
  (select (j->>'frozen_title') || '|' || (j->>'frozen_mime_type') from c1),
  'Prescrição eletrônica|application/pdf',
  'C1d ⭐ freeze copies the display metadata');
select is(
  (select count(*)::int from pg_constraint
    where conname = 'referral_shared_item_source_document_id_fkey'
      and confrelid = 'public.documents'::regclass and confdeltype = 'n'),
  1, 'C2 ⭐ source_document_id carries a REAL FK to documents, ON DELETE SET NULL');
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000d1', 'document', null,
        '34dd0000-0000-0000-0000-0000000000c2') $q$,
  'HC0DC', null,
  'C3 ⭐ an ENFORCING label refuses the freeze (the D15 ceiling cannot be laundered — ADR 0119 D4)');
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000d1', 'document', null,
        '34dd0000-0000-0000-0000-0000000000c3') $q$,
  'HC077', null,
  'C4 ⭐ a document of ANOTHER case cannot be frozen into this referral');
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000d2', 'document', null,
        '34dd0000-0000-0000-0000-0000000000c1') $q$,
  'HC070', null,
  'C5 [MATRIX] a non-draft referral refuses the freeze (pre-existing barrier, pinned)');
select set_config('request.jwt.claims', '', true);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003'::uuid, false);
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000d1', 'document', null,
        '34dd0000-0000-0000-0000-0000000000c1') $q$,
  'HC071', null,
  'C6 [MATRIX] a plain member is not the coordinator (pre-existing barrier, pinned)');
select set_config('request.jwt.claims', '', true);

-- Wave-C OFF refuses the freeze arm, and ONLY the document arm (home-scoped).
update app.feature_flags set enabled = false where key = 'documents_wave_c';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000d1', 'document', null,
        '34dd0000-0000-0000-0000-0000000000c4') $q$,
  'HC0D7', null,
  'C7a ⭐ wave-c OFF fail-closes the document arm (HC0D7 replaces the HC0DM park)');
select lives_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000d1', 'narrative',
        'a2200000-0000-0000-0000-0000000000a1', null) $q$,
  'C7b ⭐ …while the NARRATIVE arm is untouched (the gate is arm-scoped, not blanket)');
select set_config('request.jwt.claims', '', true);
update app.feature_flags set enabled = true where key = 'documents_wave_c';

-- The shape CHECK: three states for kind='document', nothing else.
select set_config('app.in_referral_rpc', 'on', true);
select throws_ok(
  $q$ insert into public.referral_shared_item (referral_id, kind, frozen_title, position)
      values ('34de0000-0000-0000-0000-0000000000d1', 'document', 'sem forma', 90) $q$,
  '23514', null,
  'C8a [MATRIX] a document row with NO binding and NO tombstone is unrepresentable');
select lives_ok(
  $q$ insert into public.referral_shared_item
        (referral_id, kind, frozen_title, position, frozen_tombstoned_at, frozen_tombstone_reason)
      values ('34de0000-0000-0000-0000-0000000000d1', 'document', 'lápide', 91,
              now(), 'legacy_unreconciled') $q$,
  'C8b ⭐ the TOMBSTONED state is representable (the reconciled-legacy/disposed shape)');
select set_config('app.in_referral_rpc', 'off', true);

-- C15a: freeze c4 while still draft (used below for the disposal-lane refusal).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select lives_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000d1', 'document', null,
        '34dd0000-0000-0000-0000-0000000000c4') $q$,
  'C15a ⭐ second freeze (doc c4) succeeds while draft');

-- The bespoke door: PHI reader gets the binding + EXACTLY ONE referral.viewed.
create temp table c10pre on commit drop as
  select count(*)::int as n,
         count(*) filter (where metadata->>'kind' = 'document_open')::int as n_kind
    from public.audit_log
   where action = 'referral.viewed'
     and entity_id = '34de0000-0000-0000-0000-0000000000d1';
select is(
  (select pg_temp.snap((select item from c1))->>'document_version_id'),
  '34dc0000-0000-0000-0000-0000000000c1',
  'C10a ⭐ the audited door serves the frozen binding to a PHI reader');
select is(
  (select count(*)::int from public.audit_log
    where action = 'referral.viewed'
      and entity_id = '34de0000-0000-0000-0000-0000000000d1')
  - (select n from c10pre),
  1, 'C10b ⭐ …with EXACTLY ONE referral.viewed audit row (exit criterion 2)');
-- DM4-AUDIT-1 ruling (ADR 0119 D10): the byte-open is discriminated from a
-- detail-page view by a STRUCTURED field, never by translatable prose. The
-- exact count above stays; this pins the kind on the same single row.
select is(
  (select count(*) filter (where metadata->>'kind' = 'document_open')::int
     from public.audit_log
    where action = 'referral.viewed'
      and entity_id = '34de0000-0000-0000-0000-0000000000d1')
  - (select n_kind from c10pre),
  1, 'C10c ⭐ …and that one row carries metadata.kind = document_open (the structured discriminator)');

-- D5 first half: source SOFT-DELETE does NOT kill the snapshot (ADR 0119 D5).
select set_config('request.jwt.claims', '', true);
update public.documents set status = 'soft_deleted', deleted_at = now()
 where id = '34dd0000-0000-0000-0000-0000000000c1';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select is(
  (select pg_temp.snap((select item from c1))->>'document_version_id'),
  '34dc0000-0000-0000-0000-0000000000c1',
  'C14 ⭐ A''s retraction (soft-delete) does NOT retract B''s disclosure record');

-- D5 second half: D10 DISPOSAL fails the snapshot closed.
select lives_ok(
  $q$ select public.request_document_disposition(
        '34dd0000-0000-0000-0000-0000000000c4', 'entered_in_error') $q$,
  'C15b [CONTROL] the source coordinator can request disposition of his own case document');
select throws_ok(
  $q$ select public.open_referral_snapshot_document(
        (select s.id from public.referral_shared_item s
          where s.referral_id = '34de0000-0000-0000-0000-0000000000d1'
            and s.source_document_id = '34dd0000-0000-0000-0000-0000000000c4')) $q$,
  'HC0DD', null,
  'C15c ⭐ a disposal-pending source fails the snapshot CLOSED (LGPD outranks the record)');
select set_config('request.jwt.claims', '', true);

-- Flip the draft to SENT: staff1.farm becomes metadata-tier on it, NOT PHI.
select set_config('app.in_referral_rpc', 'on', true);
update public.case_referral
   set status = 'sent', sent_at = now(), sent_by = '00000000-0000-0000-0000-000000000002'
 where id = '34de0000-0000-0000-0000-0000000000d1';
select set_config('app.in_referral_rpc', 'off', true);
select is(
  app.can_read_referral_metadata('34de0000-0000-0000-0000-0000000000d1',
                                 '00000000-0000-0000-0000-000000000006')
  and not app.can_read_referral_phi('34de0000-0000-0000-0000-0000000000d1',
                                    '00000000-0000-0000-0000-000000000006'),
  true, 'C11a [CONTROL] staff1.farm is metadata-yes / PHI-no on the sent referral');
create temp table c11pre on commit drop as
  select count(*)::int as n from public.audit_log
   where action = 'referral.viewed'
     and entity_id = '34de0000-0000-0000-0000-0000000000d1';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000006'::uuid, false);
select is(
  (select coalesce(pg_temp.snap((select item from c1))::text, 'NULL_RESULT')),
  'NULL_RESULT',
  'C11b ⭐ NEGATIVE TWIN, deny half: the metadata-tier reader gets NOTHING from the door');
select is(
  (select count(*)::int from public.audit_log
    where action = 'referral.viewed'
      and entity_id = '34de0000-0000-0000-0000-0000000000d1')
  - (select n from c11pre),
  0, 'C11c ⭐ …and a denial mints NO audit row (D11: denials raise/return, never log)');
select set_config('request.jwt.claims', '', true);
-- The 236 ③TWIN successor: the referral RECIPIENT (target coordinator, PHI
-- tier once sent) reads the frozen snapshot through the new door — the
-- load-bearing cross-commission arm the legacy bucket policy used to carry.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
select is(
  (select pg_temp.snap((select item from c1))->>'document_version_id'),
  '34dc0000-0000-0000-0000-0000000000c1',
  'C11d ⭐ TWIN: the target coordinator (B side) reads the frozen snapshot via the door (the disclosure corridor is real, not source-only)');
select set_config('request.jwt.claims', '', true);
select is(
  app.can_read_document('34dd0000-0000-0000-0000-0000000000c4',
                        '00000000-0000-0000-0000-000000000005'),
  false,
  'C12 [CONTROL] referral PHI does NOT widen into case A: B''s coordinator cannot kernel-read an unfrozen case-A document');

-- Referral PHI disposal tombstones the binding (ADR 0119 D5).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000001'::uuid, false, 'org_admin');
select lives_ok(
  $q$ select public.dispose_referral_phi('34de0000-0000-0000-0000-0000000000d1', 'subject_request') $q$,
  'C13a ⭐ the org admin disposes the referral''s PHI');
select set_config('request.jwt.claims', '', true);
select is(
  (select (to_jsonb(s.*)->>'frozen_document_version_id') is null
      and (to_jsonb(s.*)->>'frozen_tombstoned_at') is not null
      and (to_jsonb(s.*)->>'frozen_tombstone_reason') = 'phi_disposed'
     from public.referral_shared_item s where s.id = (select item from c1)),
  true, 'C13b ⭐ disposal TOMBSTONES the binding (version unlinked, reason phi_disposed)');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.open_referral_snapshot_document(
        (select s.id from public.referral_shared_item s
          where s.id in (select item from c1))) $q$,
  'HC0DS', null,
  'C13c ⭐ the door refuses a tombstoned snapshot (HC0DS) even to a PHI reader');
select set_config('request.jwt.claims', '', true);

-- The binding cannot be orphaned. Discovery from the green run: the platform
-- already refuses version deletion OUTRIGHT (the DM1 immutability guard,
-- HC0D2, fires before any FK) — so the live enforcement is pinned
-- behaviorally, and the RESTRICT FK is pinned from the catalog as the
-- BACKSTOP that takes over if that guard is ever narrowed.
select throws_ok(
  $q$ do $del$ begin
        delete from public.document_version_files
         where document_version_id = '34dc0000-0000-0000-0000-0000000000c4';
        delete from public.document_versions
         where id = '34dc0000-0000-0000-0000-0000000000c4';
      end $del$ $q$,
  'HC0D2', null,
  'C9a ⭐ a bound version cannot be deleted (the DM1 immutability guard is the first lock)');
select is(
  (select count(*)::int from pg_constraint
    where conname = 'referral_shared_item_frozen_document_version_id_fkey'
      and confrelid = 'public.document_versions'::regclass and confdeltype = 'r'),
  1, 'C9b ⭐ …and the snapshot binding FK is RESTRICT — the backstop behind that guard');

-- =============================================================================
-- D — M4: the legacy surface is GONE (zero exceptions)
-- =============================================================================
select is(
  (select count(*)::int from pg_policies
    where policyname ilike '%attachment%' or tablename ilike '%attachment%'),
  0, 'D1 ⭐ ZERO %attachment% policies remain — the DM1 allowlist is EMPTY');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public') and p.proname ilike '%attachment%'),
  0, 'D2 ⭐ ZERO %attachment% routines remain in app/public');
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','v','m') and c.relname ilike '%attachment%'),
  0, 'D3 ⭐ ZERO %attachment% relations remain (the reply table is dropped)');
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and policyname = 'case_documents_select_member'),
  0, 'D4a ⭐ the case-documents cookie-signer boundary is dead (F-14)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname, p.proname) in (('app','can_read_snapshot_document'),
                                     ('public','get_referral_snapshot_document_path'),
                                     ('public','get_referral_attachment_path'),
                                     ('public','add_referral_reply_attachment'))),
  0, 'D4b ⭐ all four legacy referral doors are gone');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('get_referral_detail', 'dispose_referral_phi')
      and (p.prosrc like '%referral_reply_attachment%' or p.prosrc like '%frozen_storage_path%')),
  0, 'D5 ⭐ no surviving function body references the dropped table/column');
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'referral_shared_item'
      and column_name = 'frozen_storage_path'),
  0, 'D6 ⭐ frozen_storage_path is DROPPED (no legacy world can exist under reset — ADR 0119 D7)');
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'referral_shared_item'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
  0, 'D7 [CONTROL] zero write policies on referral_shared_item — the ACL-vs-policy mechanism, pinned');

-- get_referral_detail projects the SUCCESSOR shape (asymmetry re-expressed;
-- the full §4 twin lives in 197 — this is the structural pin).
create temp table d8pre on commit drop as
  select count(*) filter (where metadata->>'kind' = 'content_view')::int as n_kind
    from public.audit_log
   where action = 'referral.viewed'
     and entity_id = 'efa00000-0000-0000-0000-0000000000a1';
select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
create temp table d8 on commit drop as
  select public.get_referral_detail('efa00000-0000-0000-0000-0000000000a1') as j;
select ok(
  (select (j->'reply') ? 'reply_documents' from d8),
  'D8a ⭐ the reply projection carries the reply_documents lane (not the dropped table)');
select ok(
  (select j->'shared_items'->0 ? 'frozen_document_version_id' from d8),
  'D8b ⭐ shared items project the binding field (the byte handle''s successor)');
-- The symmetric half of the D10 discriminator: a PHI detail-page view is
-- kind=content_view — so 'opened patient document' vs 'loaded the referral
-- page' differ by a FIELD, never by a pt-BR sentence (Rule 10/11).
select is(
  (select count(*) filter (where metadata->>'kind' = 'content_view')::int
     from public.audit_log
    where action = 'referral.viewed'
      and entity_id = 'efa00000-0000-0000-0000-0000000000a1')
  - (select n_kind from d8pre),
  1, 'D8c ⭐ the detail-page PHI view carries metadata.kind = content_view (exactly one, the symmetric marker)');
select set_config('request.jwt.claims', '', true);

-- =============================================================================
-- E — the seeded specimen (chain + seed are ONE artifact)
-- =============================================================================
create temp table e1 on commit drop as
  select to_jsonb(s.*) as j from public.referral_shared_item s
   where s.referral_id = 'efa00000-0000-0000-0000-0000000000a1' and s.kind = 'document';
select is((select count(*)::int from e1), 1,
  'E1a [CONTROL] the ENC-0001 document item EXISTS (the specimen did not silently vanish)');
select is(
  (select (j->>'frozen_tombstoned_at') is not null
      and (j->>'frozen_tombstone_reason') = 'legacy_unreconciled'
      and (j->>'frozen_document_version_id') is null
     from e1),
  true, 'E1b ⭐ the seed plants it TOMBSTONED (the deterministic "indisponível" specimen)');
select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.open_referral_snapshot_document(
        (select s.id from public.referral_shared_item s
          where s.referral_id = 'efa00000-0000-0000-0000-0000000000a1' and s.kind = 'document')) $q$,
  'HC0DS', null,
  'E2 ⭐ the door refuses the seeded specimen (HC0DS) even to a PHI reader');
select set_config('request.jwt.claims', '', true);

-- E3 — THE PROJECTION POSITION, pinned executably (ADR 0119 lead question,
-- 2026-08-14): reply-document ROW metadata is METADATA-TIER by design — the
-- exact authority the retired referral_reply_attachment_select_readable
-- carried — and is NOT wave-c-gated at read time (matching Waves A/B: no wave
-- flag gates kernel row reads; the flag gates residue CREATION). The row a
-- metadata reader receives is title/mime/size/availability + a truthful
-- can_open=false; bytes remain behind the PHI-gated door. A projection that
-- leaked can_open=true here would be the DM3 class one layer over.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000006'::uuid, false);
create temp table e3meta on commit drop as
  select public.get_referral_detail('efa00000-0000-0000-0000-0000000000a1') as j;
select is(
  (select (j->'reply'->'reply_documents'->0->>'can_open') from e3meta),
  'false',
  'E3a ⭐ a METADATA-tier reader receives the reply-document row (deliberate: legacy row-visibility authority) with a TRUTHFUL can_open=false');
select set_config('request.jwt.claims', '', true);
select test_helpers.claims_for('00000000-0000-0000-0000-000000000005'::uuid, false, 'staff_admin');
select is(
  (select (public.get_referral_detail('efa00000-0000-0000-0000-0000000000a1')
           ->'reply'->'reply_documents'->0->>'can_open')),
  'true',
  'E3b ⭐ …and the SAME row carries can_open=true for the PHI-tier reader (the pair that keeps E3a non-vacuous)');
select set_config('request.jwt.claims', '', true);

-- E4 — the STANDALONE list door (ARM=floor caught it uncalled — this is its
-- driving keystone, same D9 position as E3: metadata-tier rows, truthful
-- can_open, denial ≡ empty).
select test_helpers.claims_for('00000000-0000-0000-0000-000000000006'::uuid, false);
select is(
  (select public.list_referral_reply_documents('efa00000-0000-0000-0000-0000000000a1')
          ->0->>'can_open'),
  'false',
  'E4a ⭐ list_referral_reply_documents serves the metadata-tier reader the row with can_open=false');
select set_config('request.jwt.claims', '', true);
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b0'::uuid, true);
select is(
  (select public.list_referral_reply_documents('efa00000-0000-0000-0000-0000000000a1')::text),
  '[]',
  'E4b ⭐ …and a reader with NO referral standing (platform_admin — the noun rule) gets the empty array (denial ≡ empty)');
select set_config('request.jwt.claims', '', true);

-- =============================================================================
-- F — delete semantics: RESTRICT through the registry (ADR 0116 #4 inherited).
-- Discovery from the green run: non-draft referrals are already undeletable
-- (a draft-only guard, HC070), so the RESTRICT witness needs a DRAFT carrier.
-- =============================================================================
select set_config('request.jwt.claims', '', true);
insert into public.case_referral
  (id, source_case_id, source_commission_id, target_commission_id, referral_type_id,
   type_label, subject, response_expected, created_by, status)
select '34de0000-0000-0000-0000-0000000000d4', 'd0000000-0000-0000-0000-0000000000c1',
       'a0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-0000000000b1',
       rt.id, 'Parecer', '340 fixture — draft RESTRICT carrier', true,
       '00000000-0000-0000-0000-000000000002', 'draft'
  from public.referral_types rt where rt.key = 'parecer';
insert into public.documents (id, home_resource_id, title, kind, status, created_by)
values ('34dd0000-0000-0000-0000-0000000000e4', '34de0000-0000-0000-0000-0000000000d4',
        'Anexo âncora (fixture)', 'anexo_resposta', 'active',
        '00000000-0000-0000-0000-000000000005');
select throws_ok(
  $q$ delete from public.case_referral where id = '34de0000-0000-0000-0000-0000000000d4' $q$,
  '23503', null,
  'F1 ⭐ deleting a DRAFT referral that OWNS documents fails 23503 (RESTRICT, fail-safe)');

-- =============================================================================
-- R — FUP-DM4-RECUSAL (ADR 0122). Referral-SOURCE authority is NOT case-read
-- authority. QA demonstrated live at DM4 r1 (MAJOR-3) that a coordinator
-- recused under the ADR-0072 / ETH·E1 exclusion perimeter could freeze that
-- case's PHI documents into a referral and read them through the referral
-- corridor. PO overturned the Phase-19 deferral on 2026-08-17: the deadline was
-- always the `documents_wave_c` flag-on date, and a plane that only WIDENS
-- could never have closed an under-inclusive gate.
--
-- ⛔ §7.7 — a NARROWING passes its negative BY CONSTRUCTION, so the POSITIVE
-- TWIN is the review. R1/R2 run BEFORE the recusal and require HC077, i.e. the
-- call reached the p_kind dispatch and died on the bogus id. R5/R6 repeat them
-- VERBATIM after the recusal and require HC0DM. Same call, same bogus id, one
-- fact changed.
--
-- ⚠⚠ THE FIXTURE IS THE TRAP (236 §7.1 #3): a refusal proves nothing unless the
-- refused principal still holds the OTHER authority. R4 is therefore the
-- load-bearing assertion, not R5/R6 — it pins that `can_manage_referral_source`
-- is STILL true for the recused coordinator, because it reduces to
-- `is_staff_admin_of_for(source_commission_id, uid)`, a purely COMMISSION-scoped
-- term with no case arm. Without R4, an HC0DM below could be any upstream gate.
--
-- ⚠ R6 is not a duplicate of R5. The guard sits ABOVE the p_kind dispatch, so
-- the document arm refuses with HC0DM rather than the HC077 its own lookup
-- would raise — that difference is what pins the PLACEMENT. A guard added
-- inside the document arm (where the item was filed) would leave the narrative
-- arm open; it freezes `case_narratives.body_md` from the same case with the
-- same omission. Sibling-arm class: FUP-DM5-SIBLING-GUARD-DIFF.
--
-- ⚠ HC0DM is DISCRIMINATING on purpose. This program has already paid for an
-- ambiguous code being ambiguous to the TEST too (HC0D8 for both absence and
-- unreadability). Nothing else in app/public raises HC0DM.
-- =============================================================================
-- ⚠ Its OWN draft referral, not `…d1`. The R block first used d1 and every
-- throws_ok came back HC070 ("não está em rascunho") — d1 is advanced out of
-- draft earlier in this file. A keystone that depends on another test's
-- leftover status is one reorder away from asserting nothing.
insert into public.case_referral
  (id, source_case_id, source_commission_id, target_commission_id, referral_type_id,
   type_label, subject, response_expected, created_by, status)
select '34de0000-0000-0000-0000-0000000000f9', 'd0000000-0000-0000-0000-0000000000c1',
       'a0000000-0000-0000-0000-0000000000a1', 'b0000000-0000-0000-0000-0000000000b1',
       rt.id, 'Parecer', '340 fixture — recusal keystone (draft)', true,
       '00000000-0000-0000-0000-000000000002', 'draft'
  from public.referral_types rt where rt.key = 'parecer';

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000f9', 'narrative',
        '34de0000-0000-0000-0000-00000000ffff', null) $q$,
  'HC077', null,
  'R1 ⭐ POSITIVE TWIN (narrative): a NON-recused coordinator reaches the dispatch');
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000f9', 'document', null,
        '34de0000-0000-0000-0000-00000000ffff') $q$,
  'HC077', null,
  'R2 ⭐ POSITIVE TWIN (document): a NON-recused coordinator reaches the dispatch');
select set_config('request.jwt.claims', '', true);

insert into public.case_recusals (case_id, user_id, source)
values ('d0000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-000000000002', 'coordinator');

select is(
  app.can_read_case('d0000000-0000-0000-0000-0000000000c1',
                    '00000000-0000-0000-0000-000000000002'),
  false,
  'R3 ⭐ PRE: the recusal actually flipped can_read_case — the state IS constructed');
select is(
  app.can_manage_referral_source('34de0000-0000-0000-0000-0000000000f9',
                                 '00000000-0000-0000-0000-000000000002'),
  true,
  'R4 ⭐⭐ PRE: source authority SURVIVES the recusal (commission-scoped, no case arm) — so R5/R6 can only be the new case-read guard');

select test_helpers.claims_for('00000000-0000-0000-0000-000000000002'::uuid, false, 'staff_admin');
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000f9', 'narrative',
        '34de0000-0000-0000-0000-00000000ffff', null) $q$,
  'HC0DM', null,
  'R5 ⭐ the recused coordinator can no longer freeze a NARRATIVE from the excluded case');
select throws_ok(
  $q$ select public.add_referral_shared_item(
        '34de0000-0000-0000-0000-0000000000f9', 'document', null,
        '34de0000-0000-0000-0000-00000000ffff') $q$,
  'HC0DM', null,
  'R6 ⭐ …nor a DOCUMENT — and HC0DM (not the arm''s own HC077) pins that the guard sits ABOVE the dispatch');
select set_config('request.jwt.claims', '', true);

delete from public.case_recusals
 where case_id = 'd0000000-0000-0000-0000-0000000000c1'
   and user_id = '00000000-0000-0000-0000-000000000002';

select * from finish();
rollback;
