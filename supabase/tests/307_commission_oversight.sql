-- =============================================================================
-- QO·A keystones — commission oversight classification (M2; ADR 0100 D8/D9).
--
-- The column is an AUTHORIZATION INPUT (it feeds S7 + the dashboard helper +
-- the commissions shell arm), so this file pins all four faces: the fail-closed
-- default, the door's authority ordering, the raw-write guard (load-bearing —
-- commissions grants authenticated full DML behind commissions_admin_write),
-- and the explicit audit verb.
--
-- DOCUMENTED RESIDUAL (deliberate, plan-approved shape): the guard is BEFORE
-- UPDATE only — an INSERT may carry an initial classification (the sibling
-- guard_case_visibility posture). Reported to the lead in the A.1 build report;
-- if a future ruling closes it, 1.3 below is the assertion to recut.
--
-- RED-FIRST record: pre-M2 this file aborts at the first quality_oversight
-- reference (column does not exist). Falsifiability: q1 mutation cases
-- `door_authority` (neutralize the authority check) and `guard_noop` (unhook
-- the trigger body) — each must red exactly the keystones named there.
-- =============================================================================

begin;
select plan(22);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'oa_b')::uuid   as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

create temp table p on commit drop as
  select gen_random_uuid() as ha, gen_random_uuid() as nsp,
         gen_random_uuid() as oa2,
         gen_random_uuid() as org2, gen_random_uuid() as hosp2;
grant select on p to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.id || '@test', now(), now()
from (select ha as id from p union all select nsp from p union all select oa2 from p) u;

insert into public.organizations (id, name, slug)
select org2, 'Org QO2 Foreign', 'org-qo2-' || substr(org2::text, 1, 8) from p;
insert into public.hospitals (id, organization_id, name, slug)
select hosp2, org2, 'Hosp QO2 Foreign', 'hosp-qo2-' || substr(hosp2::text, 1, 8) from p;

update public.profiles pr set home_organization_id = (select org_b from k)
  where pr.id in (select ha from p union all select nsp from p);
update public.profiles pr set home_organization_id = (select org2 from p)
  where pr.id = (select oa2 from p);

insert into public.memberships (organization_id, hospital_id, principal_id, role)
select k.org_b, k.hosp_b, p.ha, 'hospital_admin' from k, p;
insert into public.memberships (organization_id, principal_id, role)
select k.org_b, p.nsp, 'nsp_org_admin' from k, p;
insert into public.memberships (organization_id, principal_id, role)
select p.org2, p.oa2, 'org_admin' from p;

-- =============================================================================
-- §1 — SUBSTRATE: deny-by-default (D8) + the value CHECK.
-- =============================================================================

select is(
  (select quality_oversight from public.commissions c, k where c.id = k.comm_x),
  'excluded',
  '1.1 DENY-BY-DEFAULT ⭐: a commission is born excluded (a forgotten setting fails closed — D8)');

select throws_ok(
  $$insert into public.commissions (name, slug, hospital_id, quality_oversight)
    select 'Bogus', 'bogus-qo', k.hosp_b, 'everything' from k$$,
  '23514', null,
  '1.2 the value CHECK admits only visible|excluded');

select lives_ok(
  $$insert into public.commissions (id, name, slug, hospital_id, quality_oversight)
    select '00000000-0000-0000-0000-00000000c307', 'Insert Classified', 'insert-qo',
           k.hosp_b, 'visible' from k$$,
  '1.3 DOCUMENTED RESIDUAL: an INSERT may carry an initial classification (guard is BEFORE UPDATE — sibling posture; recut deliberately if a ruling closes it)');
-- (the row stays — its audit trail FK forbids delete, and the txn rolls back anyway)

-- =============================================================================
-- §2 — THE DOOR: authority (42501) -> validation (HC0L0), distinct SQLSTATEs.
-- =============================================================================

select test_helpers.claims_for((select ha from p), false);
select lives_ok(
  format($$select public.set_commission_oversight(%L, 'visible')$$, (select comm_x from k)),
  '2.1 hospital_admin opts a committee in');

select is(
  (select quality_oversight from public.commissions c, k where c.id = k.comm_x),
  'visible',
  '2.2 ...and the classification landed');

select test_helpers.claims_for((select oa_b from k), false);
select lives_ok(
  format($$select public.set_commission_oversight(%L, 'excluded')$$, (select comm_x from k)),
  '2.3 org_admin opts it back out (the second D9 arm)');

select is(
  (select quality_oversight from public.commissions c, k where c.id = k.comm_x),
  'excluded',
  '2.4 ...and the flip landed');

select test_helpers.claims_for((select sa_x from k), false);
select throws_ok(
  format($$select public.set_commission_oversight(%L, 'excluded')$$, (select comm_x from k)),
  '42501', null,
  '2.5 the committee CANNOT classify itself (D9 — staff_admin denied)');

select test_helpers.claims_for((select st_x from k), false);
select throws_ok(
  format($$select public.set_commission_oversight(%L, 'visible')$$, (select comm_x from k)),
  '42501', null,
  '2.6 plain staff denied');

select test_helpers.claims_for((select admin from k), true);
select throws_ok(
  format($$select public.set_commission_oversight(%L, 'visible')$$, (select comm_x from k)),
  '42501', null,
  '2.7 NOUN RULE ⭐: platform_admin cannot classify committee oversight');

select test_helpers.claims_for((select oa2 from p), false);
select throws_ok(
  format($$select public.set_commission_oversight(%L, 'visible')$$, (select comm_x from k)),
  '42501', null,
  '2.8 TENANCY: a foreign org admin is denied');

select test_helpers.claims_for((select nsp from p), false);
select throws_ok(
  format($$select public.set_commission_oversight(%L, 'visible')$$, (select comm_x from k)),
  '42501', null,
  '2.9 nsp_org_admin is not an oversight authority');

select test_helpers.claims_for((select ha from p), false);
select throws_ok(
  format($$select public.set_commission_oversight(%L, 'visible')$$, gen_random_uuid()),
  'P0002', null,
  '2.10 unknown commission -> P0002 (found nothing to authorize against)');

select throws_ok(
  format($$select public.set_commission_oversight(%L, 'partially')$$, (select comm_x from k)),
  'HC0L0', null,
  '2.11 an invalid value is refused with its OWN code (HC0L0)');

select test_helpers.claims_for((select sa_x from k), false);
select throws_ok(
  format($$select public.set_commission_oversight(%L, 'partially')$$, (select comm_x from k)),
  '42501', null,
  '2.12 AUTHORITY FIRST ⭐: an unauthorized caller with an invalid value fails on 42501, never HC0L0 (the ordering that makes a vacuous keystone unwritable)');

-- =============================================================================
-- §3 — THE GUARD: raw column writes are blocked for EVERYONE; the
-- unchanged-value mention does not trap; the GUC bracket is the sole escape.
-- =============================================================================

select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select throws_ok(
  format($$update public.commissions set quality_oversight = 'visible' where id = %L$$,
         (select comm_x from k)),
  '23514', null,
  '3.1 GUARD ⭐: an org_admin raw PATCH (admitted by commissions_admin_write) is trapped — the door is the only writer');
reset role;

select throws_ok(
  format($$update public.commissions set quality_oversight = 'visible' where id = %L$$,
         (select comm_x from k)),
  '23514', null,
  '3.2 GUARD: even a superuser write without the GUC bracket is trapped (the seed must use the bracket)');

select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select lives_ok(
  format($$update public.commissions set name = name, quality_oversight = quality_oversight where id = %L$$,
         (select comm_x from k)),
  '3.3 NON-TRAP ⭐: a full-row UPDATE mentioning the column with an UNCHANGED value passes (IS DISTINCT FROM is load-bearing)');
reset role;

select set_config('app.in_commission_rpc', 'on', true);
select lives_ok(
  format($$update public.commissions set quality_oversight = 'visible' where id = %L$$,
         (select comm_x from k)),
  '3.4 the transaction-local GUC bracket opens the guard (the seed fixture path)');
select set_config('app.in_commission_rpc', 'off', true);

select is(
  (select quality_oversight from public.commissions c, k where c.id = k.comm_x),
  'visible',
  '3.5 ...and the bracketed write landed');

-- =============================================================================
-- §4 — AUDIT (Rule 11): the explicit verb, PHI-free, with the previous value.
-- =============================================================================

select ok(
  exists (select 1 from public.audit_log a, k
          where a.action = 'commission.oversight_changed'
            and a.entity_id = k.comm_x
            and (a.metadata->>'quality_oversight') = 'visible'
            and (a.metadata->>'previous_quality_oversight') = 'excluded'),
  '4.1 the 2.1 flip emitted commission.oversight_changed carrying value + previous value');

select is(
  (select count(*)::int from public.audit_log a, k
   where a.action = 'commission.oversight_changed' and a.entity_id = k.comm_x),
  2,
  '4.2 exactly the two DOOR flips (2.1, 2.3) are audited — the guard-bracket raw write in 3.4 is fixture plumbing, not a door action, and emits no oversight verb');

select * from finish();
rollback;
