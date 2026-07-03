-- Audit 4-tier chain verification (ADR 0051 Decision 5; migration 20260709000300).
-- Proves: (a) rows emit at each of the 4 tiers with the right chain key; (b)
-- commission-tier rows carry the DERIVED hospital_id in the hashed tuple; (c)
-- verify_audit_chain returns ok for each tier and the per-tier authz is enforced;
-- (d) a tampered row breaks ONLY its own tier; (e) hospital_admin reads its
-- hospital-tier + its commissions' rows and NOT a sibling hospital's.
--
-- Fixture: the SEEDED world (audit_trail flag ON via seed). Personas as in 184.
begin;
select plan(16);

create temp table p on commit drop as select
  '00000000-0000-0000-0000-0000000000e1'::uuid as ha1,          -- central-a only
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000b0'::uuid as platform,     -- vendor platform_admin
  '00000000-0000-0000-0000-000000000002'::uuid as chefe_ccih,   -- staff_admin CCIH
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '05000000-0000-0000-0000-00000000000a'::uuid as hosp_central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as hosp_secundario_a,
  'a0000000-0000-0000-0000-0000000000a1'::uuid as comm_ccih;
grant select on p to authenticated;

-- Emit one row at each tier (audit_write is DEFINER; run as postgres/setup).
-- commission tier (org + hospital DERIVED from the commission)
select app.audit_write('audit.exported','audit', gen_random_uuid(),
  (select comm_ccih from p), 'test commission-tier row');
-- hospital tier (commission NULL, hospital set)
select app.audit_write('hospital.updated','hospital', (select hosp_central_a from p), null,
  'test hospital-tier row', '{}'::jsonb, (select org_a from p), (select hosp_central_a from p));
-- org tier (hospital + commission NULL)
select app.audit_write('audit.exported','audit', gen_random_uuid(), null,
  'test org-tier row', '{}'::jsonb, (select org_a from p));
-- platform tier (all NULL)
select app.audit_write('audit.exported','audit', gen_random_uuid(), null,
  'test platform-tier row');

-- (a) chain keys: the commission row carries the derived hospital_id.
select is(
  (select hospital_id from public.audit_log
   where commission_id = (select comm_ccih from p) order by seq desc limit 1),
  (select hosp_central_a from p),
  'DERIVED: the commission-tier row carries the hospital_id derived from its commission');
select ok(
  (select count(*)::int from public.audit_log
   where hospital_id = (select hosp_central_a from p) and commission_id is null) >= 1,
  'TIER: a hospital-tier row exists (hospital set, commission NULL)');
select ok(
  (select count(*)::int from public.audit_log
   where organization_id = (select org_a from p) and hospital_id is null and commission_id is null) >= 1,
  'TIER: an org-tier row exists (org set, hospital+commission NULL)');
select ok(
  (select count(*)::int from public.audit_log
   where organization_id is null and hospital_id is null and commission_id is null) >= 1,
  'TIER: a platform-tier row exists (all NULL)');

-- (c) per-tier verify_audit_chain as the entitled persona.
select test_helpers.claims_for((select chefe_ccih from p), false);
set local role authenticated;
select ok((select ok from public.verify_audit_chain((select comm_ccih from p))),
  'VERIFY: commission chain intact (staff_admin authz)');
reset role;

select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
select ok((select ok from public.verify_audit_chain((select comm_ccih from p))),
  'VERIFY: commission chain intact as hospital_admin (is_commission_admin_of authz)');
select ok((select ok from public.verify_audit_chain(null, null, (select hosp_central_a from p))),
  'VERIFY: hospital chain intact as hospital_admin of that hospital');
reset role;

select test_helpers.claims_for((select orgadmin_a from p), false);
set local role authenticated;
select ok((select ok from public.verify_audit_chain(null, (select org_a from p))),
  'VERIFY: org chain intact as org_admin');
reset role;

select test_helpers.claims_for((select platform from p), true);
set local role authenticated;
select ok((select ok from public.verify_audit_chain()),
  'VERIFY: platform chain intact as platform_admin');
reset role;

-- (c') per-tier authz DENIES the wrong caller.
select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
select throws_ok(
  $$select public.verify_audit_chain(null, null, '05000000-0000-0000-0000-0000000000a2'::uuid)$$,
  '42501', null,
  'AUTHZ: hospital_admin of central-a is DENIED verifying the sibling hospital chain');
select throws_ok(
  $$select public.verify_audit_chain(null, '0c000000-0000-0000-0000-00000000000a'::uuid)$$,
  '42501', null,
  'AUTHZ: hospital_admin is DENIED verifying the ORG chain (org_admin only)');
reset role;

-- (d) tamper: corrupt the summary of a commission-tier row -> that chain breaks,
-- others stay intact. Simulate an OUT-OF-BAND edit by disabling the immutability
-- guard (same idiom as 130_audit) — a plain UPDATE is blocked by
-- guard_audit_immutable_trg (append-only), which is the point.
do $$
begin
  alter table public.audit_log disable trigger guard_audit_immutable_trg;
  update public.audit_log set summary = summary || ' [X]'
  where seq = (select min(seq) from public.audit_log
               where commission_id = 'a0000000-0000-0000-0000-0000000000a1')
    and commission_id = 'a0000000-0000-0000-0000-0000000000a1';
  alter table public.audit_log enable trigger guard_audit_immutable_trg;
end $$;

select test_helpers.claims_for((select chefe_ccih from p), false);
set local role authenticated;
select ok(not (select ok from public.verify_audit_chain((select comm_ccih from p))),
  'TAMPER: the commission chain reports broken after a summary edit');
reset role;
-- other tiers remain intact
select test_helpers.claims_for((select orgadmin_a from p), false);
set local role authenticated;
select ok((select ok from public.verify_audit_chain(null, (select org_a from p))),
  'TAMPER ISOLATION: the org chain stays intact when a commission row was tampered');
reset role;

-- (e) hospital_admin read isolation: ha1 reads central-a's audit rows but NOT the
-- sibling hospital's. Seed the sibling hospital with a hospital-tier row first.
select app.audit_write('hospital.updated','hospital', (select hosp_secundario_a from p), null,
  'sibling hospital-tier row', '{}'::jsonb, (select org_a from p), (select hosp_secundario_a from p));

select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.audit_log
   where hospital_id = (select hosp_central_a from p) and commission_id is null) >= 1,
  'RLS: ha1 reads its OWN hospital-tier audit rows');
select is(
  (select count(*)::int from public.audit_log
   where hospital_id = (select hosp_secundario_a from p) and commission_id is null),
  0, 'RLS PROOF: ha1 reads ZERO of the SIBLING hospital-tier audit rows');
select ok(
  (select count(*)::int from public.audit_log where commission_id = (select comm_ccih from p)) >= 1,
  'RLS: ha1 reads its hospital''s COMMISSION-tier audit rows (via is_commission_admin_of)');
reset role;

select * from finish();
rollback;
