-- =============================================================================
-- QO·A keystones — the quality_reviewer role substrate + grant/revoke arms +
-- the p_expires_at seam (M1 + M3; ADR 0100 D1/D9).
--
-- RED-FIRST record: before M1/M3 the doors rejected ('hospital',
-- 'quality_reviewer') with HC0G0 — proven by live execution 2026-08-06
-- (buildnotes row 8) — and this file ABORTED on the missing scope arm. The
-- falsifiability of each keystone is carried by q1-quality-mutation-audit.sh
-- (cases: neutralize the grant arm; force is_quality_reviewer_of_for true).
--
-- FUP-QO-1 (PROGRESS.md Follow-ups): §4 pins the two DEFERRED seam limits
-- executably — Phase C / D14 (break-glass) rides this seam, and a silent change
-- to either behavior must fail loudly here, not in a stale comment.
-- =============================================================================

begin;
select plan(37);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'st_y')::uuid   as st_y,
         (v->>'oa_b')::uuid   as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- Extra personas: a hospital_admin of hosp_b, an nsp_org_admin of org_b, and a
-- FOREIGN org admin (own org + hospital) — the four negative arms need real
-- principals denied by the arm UNDER TEST, not by a missing precondition.
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
select org2, 'Org QO Foreign', 'org-qo-' || substr(org2::text, 1, 8) from p;
insert into public.hospitals (id, organization_id, name, slug)
select hosp2, org2, 'Hosp QO Foreign', 'hosp-qo-' || substr(hosp2::text, 1, 8) from p;

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
-- §1 — THE SHAPE SUBSTRATE (M1). Raw inserts as postgres: RLS/doors are not in
-- play, only the two rebuilt CHECK constraints.
-- =============================================================================

select lives_ok(
  $$insert into public.memberships (organization_id, hospital_id, principal_id, role)
    select k.org_b, k.hosp_b, k.st_y, 'quality_reviewer' from k$$,
  '1.1 SHAPE: org + hospital NOT NULL, commission NULL is the admitted reviewer shape');
delete from public.memberships where role = 'quality_reviewer';

select throws_ok(
  $$insert into public.memberships (commission_id, principal_id, role)
    select k.comm_x, k.st_y, 'quality_reviewer' from k$$,
  '23514', null,
  '1.2 SHAPE: a commission-scoped quality_reviewer is rejected (committee-content adjacency w4-style)');

select throws_ok(
  $$insert into public.memberships (organization_id, principal_id, role)
    select k.org_b, k.st_y, 'quality_reviewer' from k$$,
  '23514', null,
  '1.3 SHAPE: an org-only quality_reviewer is rejected (no org-scoped oversight tier — D1)');

select throws_ok(
  $$insert into public.memberships (hospital_id, principal_id, role)
    select k.hosp_b, k.st_y, 'quality_reviewer' from k$$,
  '23514', null,
  '1.4 SHAPE: a hospital-without-org quality_reviewer is rejected');

select throws_ok(
  $$insert into public.memberships (organization_id, hospital_id, principal_id, role)
    select k.org_b, k.hosp_b, k.st_y, 'quality_admin' from k$$,
  '23514', null,
  '1.5 VOCAB: the rebuilt role CHECK stays closed (an undeclared role is rejected)');

-- =============================================================================
-- §2 — THE GRANT ARM (M3). Authority = org_admin OR hospital_admin, nothing
-- else (the technical_director shape, minus its checks, minus any flag).
-- =============================================================================

select test_helpers.claims_for((select oa_b from k), false);
select lives_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x from k)),
  '2.1 org_admin grants quality_reviewer');

select is(
  (select count(*)::int from public.memberships m, k
    where m.principal_id = k.st_x and m.role = 'quality_reviewer'
      and m.organization_id = k.org_b and m.hospital_id = k.hosp_b
      and m.commission_id is null and m.expires_at is null),
  1,
  '2.2 ...the row lands hospital-scoped, commission NULL, no expiry');

select ok(
  app.is_quality_reviewer_of_for((select hosp_b from k), (select st_x from k)),
  '2.3 the M1 helper resolves the granted row');

select test_helpers.claims_for((select ha from p), false);
select lives_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_y from k)),
  '2.4 hospital_admin grants quality_reviewer (the second D9 arm)');

select test_helpers.claims_for((select nsp from p), false);
select throws_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x2 from k)),
  '42501', null,
  '2.5 nsp_org_admin is NOT a quality-reviewer granter');

select test_helpers.claims_for((select sa_x from k), false);
select throws_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x2 from k)),
  '42501', null,
  '2.6 a staff_admin cannot seat a reviewer over their own committee');

select test_helpers.claims_for((select admin from k), true);
select throws_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x2 from k)),
  '42501', null,
  '2.7 NOUN RULE ⭐: platform_admin cannot seat a reviewer (no is_admin_for arm — mirror of the DT ruling)');

select test_helpers.claims_for((select oa2 from p), false);
select throws_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x2 from k)),
  '42501', null,
  '2.8 TENANCY: a FOREIGN org admin is denied on this hospital');

select test_helpers.claims_for((select oa_b from k), false);
select throws_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select oa_b from k)),
  '42501', null,
  '2.9 SELF-GRANT is denied on the new arm (inherited by position — proven, not assumed)');

select throws_ok(
  format($$select public.grant_role('organization', %L, 'quality_reviewer', %L)$$,
         (select org_b from k), (select st_x2 from k)),
  'HC0G0', null,
  '2.10 an ORG-scoped quality_reviewer grant is an invalid (scope, role) combination');

select throws_ok(
  format($$select public.grant_role('hospital', %L, 'staff', %L)$$,
         (select hosp_b from k), (select st_x2 from k)),
  'HC0G0', null,
  '2.11 CONTROL: the HC0G0 fail-closed tail survived the arm insertion');

select throws_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L)$$,
         gen_random_uuid(), (select st_x2 from k)),
  '23514', null,
  '2.12 an unknown hospital fails closed (check_violation, before any authority)');

-- =============================================================================
-- §3 — THE REVOKE ARM (M3). Same authority; no anti-lockout (zero reviewers is
-- a valid deny-by-default state).
-- =============================================================================

select test_helpers.claims_for((select nsp from p), false);
select throws_ok(
  format($$select public.revoke_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x from k)),
  '42501', null,
  '3.1 nsp_org_admin cannot revoke a reviewer');

select test_helpers.claims_for((select oa2 from p), false);
select throws_ok(
  format($$select public.revoke_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x from k)),
  '42501', null,
  '3.2 a FOREIGN org admin cannot revoke a reviewer');

select test_helpers.claims_for((select sa_x from k), false);
select throws_ok(
  format($$select public.revoke_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x from k)),
  '42501', null,
  '3.3 a staff_admin cannot revoke a reviewer');

select test_helpers.claims_for((select ha from p), false);
select lives_ok(
  format($$select public.revoke_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_y from k)),
  '3.4 hospital_admin revokes');

select is(
  (select count(*)::int from public.memberships m, k
    where m.principal_id = k.st_y and m.role = 'quality_reviewer'),
  0,
  '3.5 ...and the row is gone');

select test_helpers.claims_for((select oa_b from k), false);
select lives_ok(
  format($$select public.revoke_role('hospital', %L, 'quality_reviewer', %L)$$,
         (select hosp_b from k), (select st_x from k)),
  '3.6 org_admin revokes');

select is(
  (select count(*)::int from public.memberships where role = 'quality_reviewer'),
  0,
  '3.7 ...zero reviewer rows remain (a hospital with no reviewers is a valid state)');

-- =============================================================================
-- §4 — THE p_expires_at SEAM (M3 / D9 / FUP-QO-1). Enforcement was already
-- universal (has_role filters expiry); M3 adds the SETTER. The two deferred
-- seam limits are pinned EXECUTABLY here — Phase C's break-glass (D14) rides
-- them, and prose pins go stale silently.
-- =============================================================================

select test_helpers.claims_for((select oa_b from k), false);
select lives_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L, null, now() + interval '30 days')$$,
         (select hosp_b from k), (select st_x from k)),
  '4.1 a grant may carry an expiry (the D14 seam)');

select ok(
  (select m.expires_at is not null and m.expires_at > now() + interval '29 days'
   from public.memberships m, k
   where m.principal_id = k.st_x and m.role = 'quality_reviewer'),
  '4.2 ...and the INSERT path persisted it');

select ok(
  app.is_quality_reviewer_of_for((select hosp_b from k), (select st_x from k)),
  '4.3 an unexpired reviewer resolves');

select throws_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L, null, now() - interval '1 day')$$,
         (select hosp_b from k), (select st_x2 from k)),
  '23514', null,
  '4.4 a PAST expiry is refused at the door (grant_case_access precedent, verbatim)');

select lives_ok(
  format($$select public.grant_role('hospital', %L, 'quality_reviewer', %L, null, now() + interval '60 days')$$,
         (select hosp_b from k), (select st_x from k)),
  '4.5 FUP-QO-1·A: re-granting an identical membership with a NEW expiry succeeds silently...');

select ok(
  (select m.expires_at < now() + interval '31 days'
   from public.memberships m, k
   where m.principal_id = k.st_x and m.role = 'quality_reviewer'),
  '4.6 FUP-QO-1·A ⭐: ...and does NOT extend the existing expiry (targeted ON CONFLICT DO NOTHING — the deferred seam limit, pinned)');

-- Backdate (as postgres — no door mutates expiry; that is 292 §2.1's contract).
update public.memberships m set expires_at = now() - interval '1 hour'
  where m.principal_id = (select st_x from k) and m.role = 'quality_reviewer';

select ok(
  not app.is_quality_reviewer_of_for((select hosp_b from k), (select st_x from k)),
  '4.7 CENTRAL EXPIRY ⭐: an expired reviewer resolves to NOTHING (has_role''s single filter)');

select ok(
  exists (select 1 from public.audit_log
          where action = 'membership.expiry_changed'
            and (metadata->>'role') = 'quality_reviewer'),
  '4.8 the expiry change emitted its audit verb (trg_audit_memberships is role-generic)');

select ok(
  exists (select 1 from public.audit_log
          where action = 'membership.granted'
            and (metadata->>'role') = 'quality_reviewer'),
  '4.9 the grant emitted membership.granted with the new role in PHI-free metadata');

-- FUP-QO-1·B — the commission-tier atomic-replace path does NOT write expiry.
select test_helpers.claims_for((select sa_y from k), false);
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff', %L, null, now() + interval '10 days')$$,
         (select comm_y from k), (select st_x2 from k)),
  '4.10 fixture: a commission grant carrying an expiry lands via the INSERT path');

select ok(
  (select m.expires_at is not null and m.expires_at < now() + interval '11 days'
   from public.memberships m, k
   where m.principal_id = k.st_x2 and m.commission_id = k.comm_y),
  '4.11 ...with the 10-day expiry persisted');

select test_helpers.claims_for((select oa_b from k), false);
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff_admin', %L, null, now() + interval '90 days')$$,
         (select comm_y from k), (select st_x2 from k)),
  '4.12 fixture: re-granting a DIFFERENT commission role takes the atomic-replace UPDATE path');

select ok(
  (select m.role = 'staff_admin'
      and m.expires_at is not null
      and m.expires_at < now() + interval '11 days'
   from public.memberships m, k
   where m.principal_id = k.st_x2 and m.commission_id = k.comm_y),
  '4.13 FUP-QO-1·B ⭐: the replace changed the ROLE but left expires_at untouched (10-day value survives; the 90-day argument was deliberately ignored — the deferred seam limit, pinned)');

select * from finish();
rollback;
