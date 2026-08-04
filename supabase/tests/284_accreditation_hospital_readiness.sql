-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration E,
-- part 2: hospital_readiness. ADR 0093 D6/D7/D8.
-- Migration 20260903001600_accreditation_readiness_doors.sql.
--
--   §0 — HC0Q9 flag-off.
--   §A — THE assertion: platform_admin gets ZERO rows (BUG-AUTHZ-001
--        shape).
--   §B — hospital_admin (positive) AND org_admin (positive, READ side —
--        deliberately contrasting with pgTAP 281's org_admin WRITE
--        rejection on set_standard_ownership: org_admin can read the
--        hospital surface but cannot write ownership, D7's asymmetry
--        proven from BOTH directions across the two test files).
--   §C — worst-status-wins as a TOTAL ORDER: nao_conforme > parcial,
--        parcial > conforme, and (transitivity) nao_conforme > conforme —
--        three pairwise comparisons, not one example standing in for the
--        order.
--   §D — the nao_aplicavel unanimity rule: all-nao_aplicavel -> nao_aplicavel
--        (unanime); nao_aplicavel mixed with ONE real status -> that real
--        status (still unanime — abstentions don't manufacture
--        disagreement); nao_aplicavel mixed with a real DISAGREEMENT ->
--        worst-wins over the non-abstaining votes (pior_caso).
--   §E — ownership override: overriding to a commission's real assessment
--        -> resolution='responsavel' with that status; overriding to a
--        commission with NO assessment -> consolidated_status = NULL,
--        resolution still 'responsavel' (override-to-unassessed is a valid
--        state, not an error); clearing the override (NULL commission)
--        REVERTS to the natural worst-wins/unanimity computation.
--   §F — a FOREIGN hospital's hospital_admin (same org) gets zero; a
--        cross-org hospital_admin (different org entirely) gets zero.
--   §G — door parity: no is_admin() call in hospital_readiness (structural,
--        comment-stripped).
--   §H — SELECT-list census: no `note` column, ever.
--
-- ⚠ Fixture ordering note: ALL fixture setup (incl. every
-- `update public.profiles set ... home_organization_id ...`) happens BELOW,
-- BEFORE the first `test_helpers.claims_for` call. `set_config('request.
-- jwt.claims', ..., true)` is TRANSACTION-local, not role-local — `reset
-- role` reverts the ROLE but leaves auth.uid() resolving to the last
-- claimed principal for the rest of this transaction. Since
-- home_organization_id is one of profiles' guarded identity/lifecycle
-- columns (service-role-only once auth.uid() is non-null — found via the
-- first red run, not assumed), any post-claims_for profile update in this
-- file would hit `guard_profile_privileged_columns`'s check_violation.
--
-- MUTATION DISCIPLINE: every keystone marked (verified) was broken by hand,
-- the SAME assertion re-run and confirmed RED, then restored. §A's
-- keystone specifically REINTRODUCES an is_admin() arm — the actual
-- BUG-AUTHZ-001 defect — rather than an unrelated break, per the work
-- instruction.

begin;

select plan(24);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'org_b')::uuid   as org_b,
         (v->>'hosp_b')::uuid  as hosp_b
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §0 · Flag OFF (no role switch needed — the flag check fires before any
-- gate, regardless of caller identity).
-- ===========================================================================
select ok(not app.feature_enabled('accreditation'), '0. flag accreditation is OFF (natural default)');
select throws_ok(
  format($$ select public.hospital_readiness(%L, %L) $$, gen_random_uuid(), gen_random_uuid()),
  'HC0Q9', null, '0a. hospital_readiness raises HC0Q9 while the flag is off'
);
update app.feature_flags set enabled = true where key = 'accreditation';

-- ===========================================================================
-- Fixtures — EVERYTHING, including every persona, BEFORE the first
-- claims_for call (see the header note).
-- comm_x AND comm_y both live under hosp_b in the bootstrap — exactly the
-- two-commissions-one-hospital shape this door consolidates.
-- ===========================================================================
insert into public.accreditation_frameworks (id, key, name, version, status)
  values ('28400000-0000-0000-0000-00000000000f', '284-fw', '284 Framework', '1', 'ativo');
insert into public.accreditation_standards (id, framework_id, code, title) values
  ('28400000-0000-0000-0000-000000000001', '28400000-0000-0000-0000-00000000000f', 'S1', 'Total-order Nao-conforme'),
  ('28400000-0000-0000-0000-000000000002', '28400000-0000-0000-0000-00000000000f', 'S2', 'Total-order Parcial'),
  ('28400000-0000-0000-0000-000000000003', '28400000-0000-0000-0000-00000000000f', 'S3', 'All Nao-aplicavel'),
  ('28400000-0000-0000-0000-000000000004', '28400000-0000-0000-0000-00000000000f', 'S4', 'Mix one real + abstention'),
  ('28400000-0000-0000-0000-000000000005', '28400000-0000-0000-0000-00000000000f', 'S5', 'Mix real disagreement + abstention'),
  ('28400000-0000-0000-0000-000000000006', '28400000-0000-0000-0000-00000000000f', 'S6', 'Ownership override target');

-- S1: comm_x=parcial, comm_y=nao_conforme -> worst-wins nao_conforme (beats parcial)
insert into public.standard_assessments (commission_id, standard_id, status) values
  ((select comm_x from k), '28400000-0000-0000-0000-000000000001', 'parcial'),
  ((select comm_y from k), '28400000-0000-0000-0000-000000000001', 'nao_conforme');
-- S2: comm_x=conforme, comm_y=parcial -> worst-wins parcial (beats conforme)
insert into public.standard_assessments (commission_id, standard_id, status) values
  ((select comm_x from k), '28400000-0000-0000-0000-000000000002', 'conforme'),
  ((select comm_y from k), '28400000-0000-0000-0000-000000000002', 'parcial');
-- S3: both nao_aplicavel -> unanime, nao_aplicavel
insert into public.standard_assessments (commission_id, standard_id, status) values
  ((select comm_x from k), '28400000-0000-0000-0000-000000000003', 'nao_aplicavel'),
  ((select comm_y from k), '28400000-0000-0000-0000-000000000003', 'nao_aplicavel');
-- S4: comm_x=nao_aplicavel (abstains), comm_y=conforme -> unanime, conforme
insert into public.standard_assessments (commission_id, standard_id, status) values
  ((select comm_x from k), '28400000-0000-0000-0000-000000000004', 'nao_aplicavel'),
  ((select comm_y from k), '28400000-0000-0000-0000-000000000004', 'conforme');
-- S5: a THIRD hosp_b commission (comm_z3, added here — only comm_x/comm_y
-- exist in the bootstrap) abstains (nao_aplicavel) while comm_x/comm_y
-- genuinely disagree (nao_conforme vs parcial) — proves an abstention does
-- NOT collapse a REAL disagreement into unanime; it must still resolve
-- pior_caso over the non-abstaining votes.
insert into public.commissions (id, name, slug, created_by, hospital_id)
  select '28400000-0000-0000-0000-0000000000c3'::uuid, '284 Comm Z3', '284-comm-z3', admin, hosp_b from k;
insert into public.standard_assessments (commission_id, standard_id, status) values
  ((select comm_x from k), '28400000-0000-0000-0000-000000000005', 'nao_conforme'),
  ((select comm_y from k), '28400000-0000-0000-0000-000000000005', 'parcial'),
  ('28400000-0000-0000-0000-0000000000c3'::uuid, '28400000-0000-0000-0000-000000000005', 'nao_aplicavel');
-- S6: for the ownership-override tests below (no assessments seeded yet).

-- Personas: hospital_admin + org_admin of hosp_b/org_b (positive controls);
-- a FOREIGN hospital's admin (same org_b); a CROSS-ORG hospital's admin.
create temp table personas on commit drop as
  select gen_random_uuid() as hosp_admin_uid, gen_random_uuid() as org_admin_uid,
         gen_random_uuid() as foreign_hosp_admin_uid, gen_random_uuid() as crossorg_hosp_admin_uid;
grant select on personas to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000'::uuid, u, 'authenticated', 'authenticated', u || '@test', now(), now()
  from personas, lateral (values (hosp_admin_uid),(org_admin_uid),(foreign_hosp_admin_uid),(crossorg_hosp_admin_uid)) as x(u);
update public.profiles set full_name = '284 Persona', home_organization_id = (select org_b from k)
  where id in (select hosp_admin_uid from personas union select org_admin_uid from personas union select foreign_hosp_admin_uid from personas);

insert into public.memberships (principal_id, organization_id, hospital_id, role)
  select hosp_admin_uid, org_b, hosp_b, 'hospital_admin' from personas, k;
insert into public.memberships (principal_id, organization_id, role)
  select org_admin_uid, org_b, 'org_admin' from personas, k;

insert into public.hospitals (id, organization_id, name, slug)
  select '28400000-0000-0000-0000-0000000000f0'::uuid, org_b, '284 Foreign Hosp', '284-foreign-hosp' from k;
insert into public.memberships (principal_id, organization_id, hospital_id, role)
  select foreign_hosp_admin_uid, org_b, '28400000-0000-0000-0000-0000000000f0'::uuid, 'hospital_admin' from personas, k;

insert into public.organizations (id, name, slug)
  values ('28400000-0000-0000-0000-0000000000a1', '284 Cross Org', '284-cross-org');
insert into public.hospitals (id, organization_id, name, slug)
  values ('28400000-0000-0000-0000-0000000000b1', '28400000-0000-0000-0000-0000000000a1', '284 Cross Hosp', '284-cross-hosp');
update public.profiles set full_name = '284 CrossOrg', home_organization_id = '28400000-0000-0000-0000-0000000000a1'
  where id = (select crossorg_hosp_admin_uid from personas);
insert into public.memberships (principal_id, organization_id, hospital_id, role)
  select crossorg_hosp_admin_uid, '28400000-0000-0000-0000-0000000000a1', '28400000-0000-0000-0000-0000000000b1', 'hospital_admin'
  from personas;

-- ===========================================================================
-- §A · platform_admin gets ZERO rows.
-- ===========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')),
  0, 'A1. platform_admin gets ZERO rows from hospital_readiness (BUG-AUTHZ-001 shape, verified by mutation below)'
);
reset role;

-- ===========================================================================
-- §B · hospital_admin + org_admin BOTH read (contrasting pgTAP 281's
-- org_admin WRITE rejection).
-- ===========================================================================
select test_helpers.claims_for((select hosp_admin_uid from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')),
  6, 'B1. hospital_admin reads all six standards'
);
reset role;

select test_helpers.claims_for((select org_admin_uid from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')),
  6, 'B2. org_admin ALSO reads all six (the D7 asymmetry: read yes, write no — set_standard_ownership rejects org_admin per pgTAP 281 D1)'
);
reset role;

-- ===========================================================================
-- §C · worst-status-wins as a TOTAL ORDER (three pairwise comparisons).
-- ===========================================================================
select test_helpers.claims_for((select hosp_admin_uid from personas), false);
set local role authenticated;
select is(
  (select consolidated_status from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000001'),
  'nao_conforme', 'C1. nao_conforme beats parcial'
);
select is(
  (select consolidated_status from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000002'),
  'parcial', 'C2. parcial beats conforme'
);
select is(
  (select resolution from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000001'),
  'pior_caso', 'C3. a real disagreement resolves pior_caso, not unanime'
);
reset role;

-- ===========================================================================
-- §D · the nao_aplicavel unanimity rule.
-- ===========================================================================
select test_helpers.claims_for((select hosp_admin_uid from personas), false);
set local role authenticated;
select is(
  (select consolidated_status from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000003'),
  'nao_aplicavel', 'D1. all-nao_aplicavel consolidates to nao_aplicavel'
);
select is(
  (select resolution from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000003'),
  'unanime', 'D2. ...and that IS unanime'
);
select is(
  (select consolidated_status from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000004'),
  'conforme', 'D3. nao_aplicavel (abstention) + ONE real status (conforme) -> that real status'
);
select is(
  (select resolution from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000004'),
  'unanime', 'D4. ...still unanime — an abstention does not manufacture disagreement'
);
select is(
  (select consolidated_status from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000005'),
  'nao_conforme', 'D5. an abstention (comm_z3) does NOT collapse a REAL disagreement (comm_x nao_conforme vs comm_y parcial) — worst-wins still applies over the non-abstaining votes'
);
select is(
  (select resolution from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000005'),
  'pior_caso', 'D6. ...and resolution is pior_caso, not unanime — the abstention did not hide the disagreement'
);
reset role;

-- ===========================================================================
-- §E · ownership override (incl. override-to-unassessed -> null) + clearing
-- reverts.
-- ===========================================================================
select test_helpers.claims_for((select hosp_admin_uid from personas), false);
set local role authenticated;
-- comm_y has NOT assessed S6 at all. Override to comm_y -> null, responsavel.
select lives_ok(
  format($$ select public.set_standard_ownership(%L, %L, %L) $$,
    (select hosp_b from k), '28400000-0000-0000-0000-000000000006', (select comm_y from k)),
  'E1. hospital_admin sets comm_y as responsible for S6 (comm_y has NOT assessed it)'
);
select is(
  (select consolidated_status from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000006'),
  null, 'E2. override-to-UNASSESSED consolidates to NULL, not an error and not silently valida'
);
select is(
  (select resolution from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000006'),
  'responsavel', 'E3. ...but resolution is STILL responsavel (the override is real, the answer is just empty)'
);

-- Now comm_y actually assesses S6 — as comm_y's OWN staff_admin (sa_y), not
-- the hospital_admin persona (which is not staff_admin of any commission).
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.set_standard_assessment((select comm_y from k), '28400000-0000-0000-0000-000000000006', 'nao_conforme') from k;
reset role;

select test_helpers.claims_for((select hosp_admin_uid from personas), false);
set local role authenticated;
select is(
  (select consolidated_status from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000006'),
  'nao_conforme', 'E4. once comm_y assesses, the override reflects comm_y''s REAL status (even though comm_x has none)'
);

-- Clear the override.
select public.set_standard_ownership((select hosp_b from k), '28400000-0000-0000-0000-000000000006', null) from k;
select is(
  (select count(*)::int from public.standard_ownerships where standard_id = '28400000-0000-0000-0000-000000000006'),
  0, 'E5. the ownership row is gone'
);
select is(
  (select resolution from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')
     where standard_id = '28400000-0000-0000-0000-000000000006'),
  'unanime', 'E6. clearing REVERTS to the natural computation — only comm_y has assessed (nao_conforme), no abstention, still unanime'
);
reset role;

-- ===========================================================================
-- §F · foreign hospital_admin (same org) + cross-org hospital_admin, both
-- zero.
-- ===========================================================================
select test_helpers.claims_for((select foreign_hosp_admin_uid from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')),
  0, 'F1. a FOREIGN hospital''s admin (same org_b, different hospital) gets zero for hosp_b'
);
reset role;

select test_helpers.claims_for((select crossorg_hosp_admin_uid from personas), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_readiness((select hosp_b from k), '28400000-0000-0000-0000-00000000000f')),
  0, 'F2. a CROSS-ORG hospital_admin (a totally different org) gets zero for hosp_b'
);
reset role;

-- ===========================================================================
-- §G · Door parity — no is_admin() call.
-- ===========================================================================
select ok(
  not (select regexp_replace(prosrc, '--[^\n]*', '', 'g') ~ 'is_admin\s*\('
       from pg_proc where proname = 'hospital_readiness' and pronamespace = 'public'::regnamespace),
  'G1. hospital_readiness''s body carries NO is_admin() call (structural, comment-stripped)'
);

-- ===========================================================================
-- §H · SELECT-list census — no `note` column, ever.
-- ===========================================================================
select set_eq(
  $$ select unnest(p.proargnames) from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname = 'hospital_readiness'
       and p.proargmodes is not null $$,
  $$ values ('p_hospital'),('p_framework'),
            ('standard_id'),('standard_code'),('standard_title'),('level'),
            ('consolidated_status'),('resolution'),('responsible_commission_id'),
            ('evidence_valida'),('evidence_atencao'),('evidence_vencida'),('evidence_restrita') $$,
  'H1. hospital_readiness''s OUT columns are EXACTLY this list — no note, counts only (D8)'
);

select * from finish();
rollback;
