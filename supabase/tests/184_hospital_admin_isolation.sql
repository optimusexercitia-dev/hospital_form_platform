-- Hospital-admin tier cross-hospital isolation keystone (ADR 0051; migrations
-- 20260709000000..000400). The security proof: a hospital_admin of ONE hospital
-- sees its commissions' rows across every swapped surface AND ZERO rows of a
-- SIBLING hospital's commission in the SAME org, and ZERO of another org.
--
-- Fixture: the SEEDED world. Personas (password Test1234!):
--   hospitaladmin.a1   (e1): hospital_admin of central-a ONLY — the isolation
--                            subject. Sees CCIH + Farmácia (central-a), NOT the
--                            Comissão de Ética (secundario-a), NOT org-b.
--   hospitaladmin.dual (e3): hospital_admin of BOTH central-a and secundario-a —
--                            the Note-2 coexistence proof (two org_member rows for
--                            one (org,user); the OLD (org,user) unique rejected it).
--   orgadmin.a         (b1): org_admin of org-a — sees ALL org-a commissions.
--   staff1.qual.b      (b3): plain staff of org-b — sees none of org-a.
begin;
select plan(25);

create temp table p on commit drop as select
  '00000000-0000-0000-0000-0000000000e1'::uuid as ha1,        -- central-a only
  '00000000-0000-0000-0000-0000000000e3'::uuid as ha_dual,    -- both org-a hospitals
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000b3'::uuid as staff_b,
  '05000000-0000-0000-0000-00000000000a'::uuid as hosp_central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as hosp_secundario_a,
  '05000000-0000-0000-0000-00000000000b'::uuid as hosp_central_b,
  'a0000000-0000-0000-0000-0000000000a1'::uuid as comm_ccih,      -- central-a
  'b0000000-0000-0000-0000-0000000000b1'::uuid as comm_farmacia,  -- central-a
  'e0000000-0000-0000-0000-0000000000e1'::uuid as comm_etica,     -- secundario-a
  'c0000000-0000-0000-0000-0000000000c1'::uuid as comm_qual_b;    -- org-b
grant select on p to authenticated;

-- ============================================================================
-- §1: predicate boundaries — is_hospital_admin_of + is_commission_admin_of
-- ============================================================================
select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
select ok(app.is_hospital_admin_of((select hosp_central_a from p)),
  'PREDICATE: is_hospital_admin_of(central-a) = true for ha1');
select ok(not app.is_hospital_admin_of((select hosp_secundario_a from p)),
  'PREDICATE: is_hospital_admin_of(secundario-a) = false for ha1 (sibling hospital)');
select ok(not app.is_hospital_admin_of((select hosp_central_b from p)),
  'PREDICATE: is_hospital_admin_of(central-b) = false for ha1 (other org)');
select ok(app.is_commission_admin_of((select comm_ccih from p)),
  'PREDICATE: is_commission_admin_of(CCIH) = true for ha1 (own hospital)');
select ok(app.is_commission_admin_of((select comm_farmacia from p)),
  'PREDICATE: is_commission_admin_of(Farmácia) = true for ha1 (own hospital)');
select ok(not app.is_commission_admin_of((select comm_etica from p)),
  'PREDICATE PROOF: is_commission_admin_of(Ética) = false for ha1 (SIBLING hospital, same org)');
select ok(not app.is_commission_admin_of((select comm_qual_b from p)),
  'PREDICATE PROOF: is_commission_admin_of(Qualidade B) = false for ha1 (other org)');
reset role;

-- ============================================================================
-- §2: RLS surface — ha1 reads its hospital's commissions, NOT the sibling's
-- ============================================================================
select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
-- commissions table (the Q5 two-arm SELECT policy)
select is(
  (select count(*)::int from public.commissions
   where id in ((select comm_ccih from p),(select comm_farmacia from p))),
  2, 'RLS: ha1 reads BOTH central-a commissions (CCIH + Farmácia)');
select is(
  (select count(*)::int from public.commissions where id = (select comm_etica from p)),
  0, 'RLS PROOF: ha1 reads ZERO rows of the sibling-hospital commission (Ética)');
select is(
  (select count(*)::int from public.commissions where id = (select comm_qual_b from p)),
  0, 'RLS PROOF: ha1 reads ZERO rows of the other-org commission (Qualidade B)');
-- forms (a swapped commission-scoped surface)
-- 2, not 1, as of FF-2: seed.sql adds the "Matriz de Conformidade e Risco" demo
-- form to CCIH alongside the hand-hygiene checklist. The assertion's job is
-- unchanged — ha1 reads CCIH's forms, and the sibling-hospital / other-org
-- counts below are still 0, which is where the isolation proof actually lives.
select is(
  (select count(*)::int from public.forms where commission_id = (select comm_ccih from p)),
  2, 'RLS: ha1 reads CCIH forms (swapped surface)');
select is(
  (select count(*)::int from public.forms where commission_id = (select comm_etica from p)),
  0, 'RLS PROOF: ha1 reads ZERO forms of the sibling-hospital commission');
-- meetings + cases (more swapped surfaces)
-- C7 / Amendment 2: meetings_select is now pure is_member_of (no admin arm —
-- catalog-confirmed). An Organization User (org_admin AND hospital_admin) loses the
-- meeting surface; a hospital_admin is NOT a commission member, so reads ZERO
-- commission meetings — same as org_admin.
select is(
  (select count(*)::int from public.meetings where commission_id = (select comm_ccih from p)),
  0, 'C7: ha1 (hospital_admin, non-member) reads ZERO CCIH meetings — Org Users lost the meeting surface');
select is(
  (select count(*)::int from public.cases where commission_id = (select comm_qual_b from p)),
  0, 'RLS PROOF: ha1 reads ZERO cases of the other-org commission');
-- member titles (the new vocab; display-only but still commission-scoped read)
select ok(
  (select count(*)::int from public.commission_member_titles where commission_id = (select comm_ccih from p)) = 5,
  'RLS: ha1 reads CCIH member titles (5 auto-seeded)');
select is(
  (select count(*)::int from public.commission_member_titles where commission_id = (select comm_etica from p)),
  0, 'RLS PROOF: ha1 reads ZERO member titles of the sibling-hospital commission');
reset role;

-- ============================================================================
-- §3: an org-b plain staff sees NONE of org-a (cross-org boundary intact)
-- ============================================================================
select test_helpers.claims_for((select staff_b from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commissions
   where id in ((select comm_ccih from p),(select comm_farmacia from p),(select comm_etica from p))),
  0, 'RLS PROOF: org-b staff reads ZERO org-a commissions');
select ok(not app.is_commission_admin_of((select comm_ccih from p)),
  'PREDICATE: is_commission_admin_of(CCIH) = false for an org-b staff');
reset role;

-- ============================================================================
-- §4: org_admin still sees ALL org-a commissions incl. the sibling hospital
--     (the org tier is UNCHANGED — no over/under-grant regression)
-- ============================================================================
select test_helpers.claims_for((select orgadmin_a from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commissions
   where id in ((select comm_ccih from p),(select comm_farmacia from p),(select comm_etica from p))),
  3, 'RLS: org_admin.a reads ALL THREE org-a commissions (incl. sibling-hospital Ética)');
select ok(app.is_commission_admin_of((select comm_etica from p)),
  'PREDICATE: is_commission_admin_of(Ética) = true for org_admin.a (org tier unchanged)');
reset role;

-- ============================================================================
-- §5: Note-2 COEXISTENCE — hospitaladmin.dual holds TWO hospital_admin rows for
--     one (org,user). The relaxed UNIQUE NULLS NOT DISTINCT admits it (the OLD
--     (org,user) unique would have rejected the second). BOTH grants resolve.
-- ============================================================================
select is(
  (select count(*)::int from public.memberships
   where principal_id = (select ha_dual from p) and role = 'hospital_admin'),
  2, 'COEXISTENCE: hospitaladmin.dual holds 2 hospital_admin rows (relaxed composite unique)');
select test_helpers.claims_for((select ha_dual from p), false);
set local role authenticated;
select ok(app.is_hospital_admin_of((select hosp_central_a from p)),
  'COEXISTENCE: dual is hospital_admin of central-a');
select ok(app.is_hospital_admin_of((select hosp_secundario_a from p)),
  'COEXISTENCE: dual is hospital_admin of secundario-a (2nd grant resolves)');
select is(
  (select count(*)::int from public.commissions
   where id in ((select comm_ccih from p),(select comm_farmacia from p),(select comm_etica from p))),
  3, 'COEXISTENCE: dual reads ALL THREE org-a commissions (both hospitals)');
reset role;

-- ============================================================================
-- §6: the second hospital_admin INSERT would have failed under the OLD unique —
--     prove the new composite key accepts a distinct-hospital duplicate and the
--     same-org integrity trigger rejects a foreign-org hospital.
-- ============================================================================
-- A cross-org hospital_admin row (org-a user, org-b hospital) is rejected by the
-- guard_org_member_hospital_org trigger (check_violation).
select throws_ok(
  $$insert into public.memberships (organization_id, principal_id, role, hospital_id)
    values ('0c000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1',
            'hospital_admin', '05000000-0000-0000-0000-00000000000b')$$,
  '23514',
  null,
  'INTEGRITY: a hospital_admin row whose hospital belongs to another org is rejected (check_violation)');

select * from finish();
rollback;
