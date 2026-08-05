-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration E,
-- part 1: readiness_report + readiness_evidence. ADR 0093 D5/D6/D8.
-- Migration 20260903001600_accreditation_readiness_doors.sql.
--
--   §0 — app.evidence_label_of arm parity BY CONSTRUCTION (same technique
--        as pgTAP 279 for the Migration B dispatchers): the kind list is
--        read out of the LIVE evidence_links CHECK at runtime.
--   §A — THE single most important assertion in this phase:
--        platform_admin (`is_admin = true`, no commission membership)
--        receives ZERO rows from BOTH doors — the BUG-AUTHZ-001 shape,
--        tested by construction, asserted per door.
--   §B — a plain `staff` (a reader-non-writer — NOT staff_admin, so this
--        proves READ access is independent of write capability, the ADR
--        0079 keystone-persona lesson) reads its own commission's report;
--        a foreign commission's member gets zero.
--   §C — restricted case/ethics_procedure: readiness_report counts it into
--        evidence_restrita ONLY (never valida/atencao/vencida);
--        readiness_evidence masks label/note but NOT status (D5's
--        case/ethics "always valida" constant carries no case-specific
--        signal).
--   §D — SELECT-list census: no `note` column escapes readiness_report,
--        ever; readiness_evidence's note is populated for an unrestricted
--        link and NULL for a restricted one.
--   §E — door parity: no `is_admin()` call exists in either function body
--        — asserted structurally against pg_proc (comments stripped
--        first, so this file's OWN prose mentioning "is_admin()" cannot
--        produce a false pass — verified against the known BUG-AUTHZ-002
--        shape in hospital_document_register/hospital_indicator_rollup,
--        which both correctly show true).
--
-- MUTATION DISCIPLINE: every keystone marked (verified) was broken by hand
-- against the live local stack, the SAME assertion re-run and confirmed
-- RED, then restored via a fresh `supabase db reset --local` — reported in
-- the turn's report. For §A specifically, the mutation that matters is
-- REINTRODUCING an `is_admin()` arm (the actual BUG-AUTHZ-001 defect) and
-- confirming the platform_admin-zero-rows assertion goes red — not an
-- unrelated break, per the work instruction.

begin;

select plan(20);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'org_b')::uuid   as org_b,
         (v->>'hosp_b')::uuid  as hosp_b
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §0 · app.evidence_label_of arm parity BY CONSTRUCTION.
-- ===========================================================================
select lives_ok(
  $$
  do $BODY$
  declare
    v_kind text;
    v_kinds text[];
  begin
    select array_agg(m[1] order by m[1]) into v_kinds
    from pg_constraint pc, regexp_matches(pg_get_constraintdef(pc.oid), '''([a-z_]+)''', 'g') as m
    where pc.conname = 'evidence_links_artifact_kind_check';

    foreach v_kind in array v_kinds loop
      begin
        perform app.evidence_label_of(v_kind, gen_random_uuid());
      exception when others then
        if sqlerrm like '%unrecognized artifact_kind%' then
          raise exception 'MISSING ARM in evidence_label_of for kind: %', v_kind;
        end if;
      end;
    end loop;
  end
  $BODY$;
  $$,
  '0a. every live evidence_links.artifact_kind CHECK value (derived at runtime) has a matching arm in evidence_label_of'
);
select throws_ok(
  $$ select app.evidence_label_of('safety_event', gen_random_uuid()) $$,
  'P0001', null,
  '0b. a kind outside the CHECK (safety_event — declined, D4) raises in evidence_label_of'
);

update app.feature_flags set enabled = true where key = 'accreditation';

-- ===========================================================================
-- Fixtures.
-- ===========================================================================
insert into public.accreditation_frameworks (id, key, name, version, owner_commission_id, status)
  values ('28300000-0000-0000-0000-00000000000f', '283-fw', '283 Framework', '1', (select comm_x from k), 'ativo');
insert into public.accreditation_standards (id, framework_id, code, title) values
  ('28300000-0000-0000-0000-000000000001', '28300000-0000-0000-0000-00000000000f', 'S1', 'Padrão 1'),
  ('28300000-0000-0000-0000-000000000002', '28300000-0000-0000-0000-00000000000f', 'S2', 'Padrão 2');

insert into public.forms (id, commission_id, title, created_by)
  select '28300000-0000-0000-0000-000000000a01'::uuid, comm_x, '283 Form', admin from k;
insert into public.form_versions (id, form_id, version_number, status)
  values ('28300000-0000-0000-0000-000000000a02', '28300000-0000-0000-0000-000000000a01', 1, 'published');

-- A case sa_x is RECUSED from — belongs to comm_x, but the CURRENT caller
-- (sa_x, when acting as the reader) cannot read it — proving the
-- restricted-masking path, not just the belongs check.
insert into public.cases (id, commission_id, organization_id, case_number, created_by)
  select '28300000-0000-0000-0000-000000000c01'::uuid, comm_x, org_b, 28301, admin from k;
insert into public.case_recusals (case_id, user_id, source)
  select '28300000-0000-0000-0000-000000000c01'::uuid, sa_x, 'self' from k;

-- Seed evidence directly (bypassing link_evidence's OWN can_read_case gate,
-- which would refuse to let sa_x link a case they cannot read — the
-- fixture needs a restricted link to exist so the READ-side masking has
-- something to mask; a different staff_admin, or the DB owner, is the
-- realistic author of a link a LATER reader is recused from).
insert into public.evidence_links (commission_id, standard_id, artifact_kind, artifact_id, note, linked_by)
  select comm_x, '28300000-0000-0000-0000-000000000001', 'form', '28300000-0000-0000-0000-000000000a01', 'Nota do formulário', admin from k;
insert into public.evidence_links (commission_id, standard_id, artifact_kind, artifact_id, note, linked_by)
  select comm_x, '28300000-0000-0000-0000-000000000001', 'case', '28300000-0000-0000-0000-000000000c01', 'Nota do caso restrito', admin from k;

insert into public.standard_assessments (commission_id, standard_id, status)
  select comm_x, '28300000-0000-0000-0000-000000000001', 'parcial' from k;

-- ===========================================================================
-- §A · THE assertion: platform_admin gets ZERO rows from BOTH doors.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is(
  (select count(*)::int from public.readiness_report((select comm_x from k), '28300000-0000-0000-0000-00000000000f')),
  0, 'A1. platform_admin gets ZERO rows from readiness_report (BUG-AUTHZ-001 shape, verified by mutation below)'
);
select is(
  (select count(*)::int from public.readiness_evidence((select comm_x from k), '28300000-0000-0000-0000-000000000001')),
  0, 'A2. platform_admin gets ZERO rows from readiness_evidence (verified by mutation below)'
);
reset role;

-- ===========================================================================
-- §B · a plain staff (reader-non-writer) reads; a foreign member gets zero.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.readiness_report((select comm_x from k), '28300000-0000-0000-0000-00000000000f')),
  2, 'B1. a plain staff (READER, not staff_admin — proves read is independent of write) sees both standards'
);
select is(
  (select assessment_status from public.readiness_report((select comm_x from k), '28300000-0000-0000-0000-00000000000f')
     where standard_id = '28300000-0000-0000-0000-000000000001'),
  'parcial', 'B2. S1''s assessment status is parcial'
);
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.readiness_report((select comm_x from k), '28300000-0000-0000-0000-00000000000f')),
  0, 'B3. a FOREIGN commission''s member (sa_y ∈ comm_y) gets zero rows from readiness_report'
);
select is(
  (select count(*)::int from public.readiness_evidence((select comm_x from k), '28300000-0000-0000-0000-000000000001')),
  0, 'B4. same foreign member gets zero rows from readiness_evidence'
);
reset role;

-- ===========================================================================
-- §C · restricted case/ethics — evidence_restrita ONLY, label/note masked,
-- status NOT masked.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select evidence_valida from public.readiness_report((select comm_x from k), '28300000-0000-0000-0000-00000000000f')
     where standard_id = '28300000-0000-0000-0000-000000000001'),
  1::bigint, 'C1. readiness_report: exactly one VALIDA (the form) — the restricted case is NOT counted here'
);
select is(
  (select evidence_restrita from public.readiness_report((select comm_x from k), '28300000-0000-0000-0000-00000000000f')
     where standard_id = '28300000-0000-0000-0000-000000000001'),
  1::bigint, 'C2. readiness_report: exactly one RESTRITA (the case sa_x is recused from)'
);

select is(
  (select label from public.readiness_evidence((select comm_x from k), '28300000-0000-0000-0000-000000000001')
     where artifact_kind = 'case'),
  'Evidência restrita', 'C3. readiness_evidence: the restricted link''s label is masked'
);
select is(
  (select note from public.readiness_evidence((select comm_x from k), '28300000-0000-0000-0000-000000000001')
     where artifact_kind = 'case'),
  null, 'C4. readiness_evidence: the restricted link''s note is NULL, never the real payload'
);
select ok(
  (select restricted from public.readiness_evidence((select comm_x from k), '28300000-0000-0000-0000-000000000001')
     where artifact_kind = 'case'),
  'C5. readiness_evidence: restricted = true'
);
select is(
  (select status from public.readiness_evidence((select comm_x from k), '28300000-0000-0000-0000-000000000001')
     where artifact_kind = 'case'),
  'valida', 'C6. readiness_evidence: status is NOT masked (case/ethics_procedure always valida — no case-specific signal disclosed)'
);
select is(
  (select label from public.readiness_evidence((select comm_x from k), '28300000-0000-0000-0000-000000000001')
     where artifact_kind = 'form'),
  '283 Form', 'C7. the UNRESTRICTED link''s label is the real title, not masked'
);
select is(
  (select note from public.readiness_evidence((select comm_x from k), '28300000-0000-0000-0000-000000000001')
     where artifact_kind = 'form'),
  'Nota do formulário', 'C8. the UNRESTRICTED link''s note is the real payload'
);
reset role;

-- ===========================================================================
-- §D · SELECT-list census — no `note` column escapes readiness_report.
-- ===========================================================================
select set_eq(
  $$ select unnest(p.proargnames) from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'readiness_report'
       and p.proargmodes is not null $$,
  $$ values ('p_commission'),('p_framework'),
            ('standard_id'),('standard_code'),('standard_title'),('level'),
            ('assessment_status'),('evidence_valida'),('evidence_atencao'),
            ('evidence_vencida'),('evidence_restrita') $$,
  'D1. readiness_report''s OUT columns are EXACTLY this list — no note, no stray column (census against the live catalog)'
);

-- ===========================================================================
-- §E · Door parity: no is_admin() call in either function (comments
-- stripped first, so this file's own prose cannot produce a false pass —
-- cross-checked against the KNOWN BUG-AUTHZ-002 shape below).
-- ===========================================================================
select ok(
  not (select regexp_replace(prosrc, '--[^\n]*', '', 'g') ~ 'is_admin\s*\('
       from pg_proc where proname = 'readiness_report' and pronamespace = 'public'::regnamespace),
  'E1. readiness_report''s body carries NO is_admin() call (structural, comment-stripped)'
);
select ok(
  not (select regexp_replace(prosrc, '--[^\n]*', '', 'g') ~ 'is_admin\s*\('
       from pg_proc where proname = 'readiness_evidence' and pronamespace = 'public'::regnamespace),
  'E2. readiness_evidence''s body carries NO is_admin() call (structural, comment-stripped)'
);
-- ⚠ E3 was anchored on `hospital_document_register`, i.e. on an OPEN BUG. That made the
-- control evaporate the moment BUG-AUTHZ-002 was fixed (`20260908000100`): the regex
-- stopped matching, E3 went red, and E1/E2 quietly became unfalsifiable by this file.
-- A non-vacuity control must be anchored on something that stays true BY DESIGN, never
-- on a defect someone is expected to remove. `verify_audit_chain` is that anchor: its
-- `app.is_admin()` is the PLATFORM-tier branch (all args null), and the global audit
-- chain is precisely the noun ADR 0078 A35 grants platform_admin — so it is correct, and
-- correct permanently. `299_hospital_content_door_noun_rule.sql` §3.3/§3.4 pins that
-- claim behaviourally, both directions.
select ok(
  (select regexp_replace(prosrc, '--[^\n]*', '', 'g') ~ 'is_admin\s*\('
     from pg_proc where proname = 'verify_audit_chain' and pronamespace = 'public'::regnamespace),
  'E3. cross-check: the SAME regex finds is_admin() in verify_audit_chain (correct BY DESIGN — platform-tier audit) — proving E1/E2 are not vacuous'
);

select * from finish();
rollback;
