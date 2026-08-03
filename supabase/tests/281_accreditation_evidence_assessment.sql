-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration D
-- (evidence links, assessments, hospital ownership, candidate search)
-- keystones. ADR 0093 D4/D5/D7/D8 + Amendment 1 A1·1.
-- Migration 20260903001300_accreditation_evidence_assessment.sql.
--
-- The `accreditation` flag ships OFF (not forced by seed.sql) — §0 runs the
-- flag-off census against the natural default, THEN this file flips it ON
-- in-transaction (reverted by the trailing rollback) — same discipline as
-- 280.
--
--   §0 — HC0Q9 flag-off on EVERY ONE of the five RPCs, INCLUDING
--        evidence_candidates (the FF-5 HC0Q3 lesson: an unmapped raise on a
--        search path degrades a flag outage into a confidently-wrong "no
--        candidates" answer).
--   §A — RLS/RPC write scoping: staff_admin CAN write; a plain `staff`
--        (member, not staff_admin) is REJECTED on every write RPC.
--   §B — link_evidence guard order, in order: belongs (HC0QA) -> can_read_case
--        (a comm_x case sa_x is RECUSED from — belongs=true, read=false,
--        proving the check is a real gate, not a redundant belongs check in
--        disguise) -> can_read_capa's cross-hospital form (HC0QA, since a
--        foreign-hospital capa fails BELONGS before can_read_capa is even
--        reached) -> HC0QB duplicate -> insert (audit row written).
--   §C — unlink_evidence + set_standard_assessment: staff_admin scoping,
--        audit rows written, upsert semantics (re-assessment advances the
--        SAME row).
--   §D — set_standard_ownership: is_hospital_admin_of ONLY. org_admin is
--        REJECTED even though it can read the hospital surface elsewhere
--        (Migration E) — the read/write asymmetry is D7's whole point, so a
--        dedicated org_admin-rejected keystone exists rather than assuming
--        the read-side test covers it.
--   §E — evidence_candidates: per-kind results scoped to the commission
--        (and, for capa_plan, the hospital); restricted candidates (a case
--        the caller cannot read) never appear.
--
-- MUTATION DISCIPLINE: every keystone marked (verified) was broken by hand
-- against the live local stack, the SAME assertion re-run and confirmed
-- RED, then restored via a fresh `supabase db reset --local` — reported in
-- the turn's report, not encoded here.

begin;

select plan(32);

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

-- A second hospital (for the cross-hospital CAPA rejection through the RPC)
-- PLUS a commission actually homed there (comm_y is NOT foreign — the
-- bootstrap fixture homes both comm_x AND comm_y under hosp_b — so §D's
-- "commission does not belong to this hospital" needs a commission that
-- genuinely lives elsewhere).
create temp table h2 on commit drop as select gen_random_uuid() as hosp_c;
grant select on h2 to authenticated;
insert into public.hospitals (id, organization_id, name, slug)
  select hosp_c, (select org_b from k), 'Hosp 281', 'hosp-281-' || substr(hosp_c::text, 1, 8)
  from h2;
create temp table comm_z_t on commit drop as select gen_random_uuid() as comm_z;
grant select on comm_z_t to authenticated;
insert into public.commissions (id, name, slug, created_by, hospital_id)
  select comm_z, '281 Comm Z', 'comm-z-' || substr(comm_z::text, 1, 8), admin, hosp_c
  from comm_z_t, k, h2;

-- Fresh hospital_admin (positive) and org_admin (negative) personas for §D —
-- kept distinct, not double-cast onto one persona.
create temp table personas on commit drop as
  select gen_random_uuid() as hosp_admin_uid, gen_random_uuid() as org_admin_uid;
grant select on personas to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000'::uuid, hosp_admin_uid,
         'authenticated', 'authenticated', hosp_admin_uid || '@test', now(), now()
  from personas
  union all
  select '00000000-0000-0000-0000-000000000000'::uuid, org_admin_uid,
         'authenticated', 'authenticated', org_admin_uid || '@test', now(), now()
  from personas;
update public.profiles set full_name = '281 Hosp Admin', home_organization_id = (select org_b from k)
  where id = (select hosp_admin_uid from personas);
update public.profiles set full_name = '281 Org Admin', home_organization_id = (select org_b from k)
  where id = (select org_admin_uid from personas);
insert into public.memberships (principal_id, organization_id, hospital_id, role)
  select hosp_admin_uid, org_b, hosp_b, 'hospital_admin' from personas, k;
insert into public.memberships (principal_id, organization_id, role)
  select org_admin_uid, org_b, 'org_admin' from personas, k;

-- ===========================================================================
-- §0 · Flag OFF — HC0Q9 on every one of the five RPCs (evidence_candidates
-- included).
-- ===========================================================================
select ok(not app.feature_enabled('accreditation'), '0. flag accreditation is OFF (natural default)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.link_evidence(%L, %L, 'form', %L) $$,
    (select comm_x from k), gen_random_uuid(), gen_random_uuid()),
  'HC0Q9', null, '0a. link_evidence raises HC0Q9 while the flag is off'
);
select throws_ok(
  format($$ select public.unlink_evidence(%L) $$, gen_random_uuid()),
  'HC0Q9', null, '0b. unlink_evidence raises HC0Q9 while the flag is off'
);
select throws_ok(
  format($$ select public.set_standard_assessment(%L, %L, 'conforme') $$,
    (select comm_x from k), gen_random_uuid()),
  'HC0Q9', null, '0c. set_standard_assessment raises HC0Q9 while the flag is off'
);
select throws_ok(
  format($$ select public.evidence_candidates(%L, 'form') $$, (select comm_x from k)),
  'HC0Q9', null, '0d. evidence_candidates raises HC0Q9 while the flag is off — the FF-5 HC0Q3 lesson: never a silent empty list'
);
reset role;

select test_helpers.claims_for((select hosp_admin_uid from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_standard_ownership(%L, %L, %L) $$,
    (select hosp_b from k), gen_random_uuid(), (select comm_x from k)),
  'HC0Q9', null, '0e. set_standard_ownership raises HC0Q9 while the flag is off'
);
reset role;

update app.feature_flags set enabled = true where key = 'accreditation';

-- ===========================================================================
-- Fixtures (owner role, flag now ON).
-- ===========================================================================
insert into public.accreditation_frameworks (id, key, name, version, owner_commission_id, status)
  values ('28100000-0000-0000-0000-00000000000f', '281-fw', '281 Framework', '1', (select comm_x from k), 'ativo');
insert into public.accreditation_standards (id, framework_id, code, title)
  values ('28100000-0000-0000-0000-000000000001', '28100000-0000-0000-0000-00000000000f', 'S1', 'Padrão 1');

insert into public.forms (id, commission_id, title, created_by)
  select '28100000-0000-0000-0000-000000000a01'::uuid, comm_x, '281 Form', admin from k;

-- A case sa_x is RECUSED from — belongs to comm_x (commission_of_case =
-- comm_x) but sa_x's OWN can_read_case is denied by the hard-deny (ADR 0072
-- D2), even though sa_x is comm_x's coordinator. This is the fixture that
-- proves link_evidence's can_read_case arm is load-bearing, not redundant
-- with belongs.
insert into public.cases (id, commission_id, organization_id, case_number, created_by)
  select '28100000-0000-0000-0000-000000000c01'::uuid, comm_x, org_b, 28101, admin from k;
insert into public.case_recusals (case_id, user_id, source)
  select '28100000-0000-0000-0000-000000000c01'::uuid, sa_x, 'self' from k;

-- capa_plan: one under hosp_b (comm_x's own hospital), one under the FOREIGN
-- hosp_c. 1201 is INDICATOR-sourced (not 'manual') on purpose: can_read_capa
-- has no plain-staff_admin arm — only a PQS operator, an event-linked
-- reader, or (the arm this exercises) "an indicator-sourced plan is
-- readable by the indicator's commission members." A 'manual'-source capa
-- is invisible to sa_x under can_read_capa regardless of hospital, which
-- would make E3 vacuous — found via the first (red) run, not assumed.
insert into public.indicators (id, commission_id, code, name, kind, frequency, status, created_by)
  select '28100000-0000-0000-0000-000000001300'::uuid, comm_x, '281-IND', '281 Indicador', 'contagem', 'mensal', 'active', admin from k;
insert into public.capa_plan (id, hospital_id, source, source_indicator_id, classification, status, opened_by)
  select '28100000-0000-0000-0000-000000001201'::uuid, hosp_b, 'indicator', '28100000-0000-0000-0000-000000001300'::uuid, 'corretiva', 'open', admin from k;
insert into public.capa_plan (id, hospital_id, source, classification, status, opened_by)
  select '28100000-0000-0000-0000-000000001202'::uuid, hosp_c, 'manual', 'corretiva', 'open', admin from k, h2;

-- ===========================================================================
-- §A · staff_admin CAN write; a plain staff (member, not staff_admin) is
-- REJECTED.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.link_evidence(%L, %L, 'form', %L) $$,
    (select comm_x from k), '28100000-0000-0000-0000-000000000001', '28100000-0000-0000-0000-000000000a01'),
  '42501', null, 'A1. a plain staff (member, not staff_admin) cannot link_evidence'
);
select throws_ok(
  format($$ select public.set_standard_assessment(%L, %L, 'conforme') $$,
    (select comm_x from k), '28100000-0000-0000-0000-000000000001'),
  '42501', null, 'A2. a plain staff cannot set_standard_assessment'
);
reset role;

-- ===========================================================================
-- §B · link_evidence guard order.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select throws_ok(
  format($$ select public.link_evidence(%L, %L, 'form', %L) $$,
    (select comm_x from k), '28100000-0000-0000-0000-000000000001', gen_random_uuid()),
  'HC0QA', null, 'B1. a NONEXISTENT form fails the belongs check — HC0QA'
);
select throws_ok(
  format($$ select public.link_evidence(%L, %L, 'case', %L) $$,
    (select comm_x from k), '28100000-0000-0000-0000-000000000001', '28100000-0000-0000-0000-000000000c01'),
  '42501', null, 'B2. sa_x IS the coordinator (belongs=true) but is RECUSED from this case — can_read_case denies, 42501, not a silent pass-through (verified)'
);
select throws_ok(
  format($$ select public.link_evidence(%L, %L, 'capa_plan', %L) $$,
    (select comm_x from k), '28100000-0000-0000-0000-000000000001', '28100000-0000-0000-0000-000000001202'),
  'HC0QA', null, 'B3. CROSS-HOSPITAL through the RPC: comm_x linking hosp_c''s capa_plan fails belongs (HC0QA) before can_read_capa is ever reached (Amendment 1 A1·1, verified)'
);

create temp table link1 on commit drop as
  select (public.link_evidence(
    (select comm_x from k), '28100000-0000-0000-0000-000000000001', 'form', '28100000-0000-0000-0000-000000000a01'
  )).id as id;
grant select on link1 to authenticated;
select ok((select id from link1) is not null, 'B4. the legitimate link succeeds');
select ok(
  exists (select 1 from public.audit_log where action = 'evidence_link.created' and entity_id = (select id from link1)),
  'B5. link_evidence writes an audit row (evidence_link.created)'
);

select throws_ok(
  format($$ select public.link_evidence(%L, %L, 'form', %L) $$,
    (select comm_x from k), '28100000-0000-0000-0000-000000000001', '28100000-0000-0000-0000-000000000a01'),
  'HC0QB', null, 'B6. re-linking the SAME (commission, standard, kind, artifact) is a duplicate — HC0QB'
);
reset role;

-- ===========================================================================
-- §C · unlink_evidence + set_standard_assessment.
-- ===========================================================================
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.unlink_evidence(%L) $$, (select id from link1)),
  '42501', null, 'C1. a FOREIGN commission''s staff_admin (sa_y) cannot unlink comm_x''s evidence'
);
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.unlink_evidence(%L) $$, (select id from link1)),
  'C2. sa_x unlinks comm_x''s own evidence'
);
select ok(
  exists (select 1 from public.audit_log where action = 'evidence_link.deleted' and entity_id = (select id from link1)),
  'C3. unlink_evidence writes an audit row (evidence_link.deleted)'
);
select ok(
  not exists (select 1 from public.evidence_links where id = (select id from link1)),
  'C4. the link row is actually gone'
);

create temp table assess1 on commit drop as
  select (public.set_standard_assessment(
    (select comm_x from k), '28100000-0000-0000-0000-000000000001', 'parcial'
  )).id as id;
grant select on assess1 to authenticated;
select is(
  (select status from public.standard_assessments where id = (select id from assess1)),
  'parcial', 'C5. the first assessment is recorded'
);
select ok(
  exists (select 1 from public.audit_log where action = 'standard_assessment.created' and entity_id = (select id from assess1)),
  'C6. set_standard_assessment writes an audit row on first insert'
);

select is(
  (select (public.set_standard_assessment((select comm_x from k), '28100000-0000-0000-0000-000000000001', 'conforme')).status),
  'conforme', 'C7. re-assessing UPDATES the status'
);
select is(
  (select count(*)::int from public.standard_assessments where commission_id = (select comm_x from k) and standard_id = '28100000-0000-0000-0000-000000000001'),
  1, 'C8. re-assessing is still ONE row (upsert, not a second row)'
);
select ok(
  exists (select 1 from public.audit_log where action = 'standard_assessment.updated' and entity_id = (select id from assess1)),
  'C9. the re-assessment writes its OWN audit row (updated, not created again)'
);
reset role;

-- ===========================================================================
-- §D · set_standard_ownership — is_hospital_admin_of ONLY. org_admin
-- REJECTED (the read/write asymmetry with Migration E).
-- ===========================================================================
select test_helpers.claims_for((select org_admin_uid from personas), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_standard_ownership(%L, %L, %L) $$,
    (select hosp_b from k), '28100000-0000-0000-0000-000000000001', (select comm_x from k)),
  '42501', null, 'D1. org_admin is REJECTED — can read the hospital surface elsewhere (Migration E) but cannot WRITE ownership (D7 asymmetry, verified)'
);
reset role;

select test_helpers.claims_for((select hosp_admin_uid from personas), false);
set local role authenticated;
create temp table own1 on commit drop as
  select (public.set_standard_ownership(
    (select hosp_b from k), '28100000-0000-0000-0000-000000000001', (select comm_x from k)
  )).id as id;
grant select on own1 to authenticated;
select ok((select id from own1) is not null, 'D2. hospital_admin sets the responsible commission');
select ok(
  exists (select 1 from public.audit_log where action = 'standard_ownership.created' and entity_id = (select id from own1)),
  'D3. set_standard_ownership writes an audit row'
);

select throws_ok(
  format($$ select public.set_standard_ownership(%L, %L, %L) $$,
    (select hosp_b from k), '28100000-0000-0000-0000-000000000001', (select comm_z from comm_z_t)),
  'HC0QC', null, 'D4. a commission NOT belonging to this hospital (comm_z ∈ hosp_c) is rejected — HC0QC, before the schema backstop trigger''s bare 23514 (verified)'
);

select public.set_standard_ownership((select hosp_b from k), '28100000-0000-0000-0000-000000000001', null) from k;
select ok(
  not exists (select 1 from public.standard_ownerships where standard_id = '28100000-0000-0000-0000-000000000001'),
  'D5. NULL commission clears the ownership row'
);
reset role;

-- ===========================================================================
-- §E · evidence_candidates.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok(
  exists (select 1 from public.evidence_candidates((select comm_x from k), 'form') where id = '28100000-0000-0000-0000-000000000a01'),
  'E1. evidence_candidates(form) returns comm_x''s own form'
);
select ok(
  not exists (select 1 from public.evidence_candidates((select comm_x from k), 'case') where id = '28100000-0000-0000-0000-000000000c01'),
  'E2. evidence_candidates(case) does NOT offer a case sa_x cannot read (the recused one) as a candidate'
);
select ok(
  exists (select 1 from public.evidence_candidates((select comm_x from k), 'capa_plan') where id = '28100000-0000-0000-0000-000000001201'),
  'E3. evidence_candidates(capa_plan) returns the SAME-hospital plan'
);
select ok(
  not exists (select 1 from public.evidence_candidates((select comm_x from k), 'capa_plan') where id = '28100000-0000-0000-0000-000000001202'),
  'E4. evidence_candidates(capa_plan) does NOT offer the FOREIGN-hospital plan'
);
reset role;

select * from finish();
rollback;
