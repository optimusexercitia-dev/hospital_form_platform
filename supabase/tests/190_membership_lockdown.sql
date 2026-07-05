-- WS-1 · Membership write-path lockdown (C-3; closes H-6, H-7).
-- Migration: 20260711000000_membership_write_lockdown.sql
-- Plan: docs/plans/membership-write-path-lockdown.md  (Verification §pgTAP 1–6).
--
-- The lock: this suite fails if a future migration re-adds a write policy / grant,
-- re-introduces a self-grantable RPC, weakens the anti-lockout, or stops auditing a
-- grant. The invariant cannot silently reopen.
--
-- Covers:
--   §1  Neither table has any INSERT/UPDATE/DELETE/ALL policy; authenticated holds
--       no INSERT/UPDATE/DELETE grant. SELECT on organization_members still granted.
--   §2  A direct INSERT/UPDATE as a seeded org_admin / nsp_org_admin is rejected by
--       RLS (no policy + no grant => permission denied 42501).
--   §3  Each assign_*/add_* RPC rejects self-grant (42501).
--   §4  revoke_org_admin rejects removing the last org_admin (HC081); a non-last
--       removal succeeds.
--   §5  Happy paths: assign_org_admin -> row; assign_nsp_coordinator -> row;
--       add_pqs_member -> enrollment AND the PHI read resolves; revoke_* -> gone.
--   §6  Every grant/revoke in §5 emits an audit row (correct verb + scope; NO PHI in
--       payload) AND the affected chains stay verify_audit_chain-intact.

begin;
select plan(40);

-- HARD REQUIREMENT (QA-B-1 lesson): the keystone assertions below exercise
-- add_pqs_member (needs the roster live) and rely on audit_write actually emitting
-- (audit_write early-returns when audit_trail is off). Enable BOTH flags in the
-- fixture so the flag-guarded tests execute rather than silently skip.
update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- Personas (superuser inserts, RLS/grant-exempt — the lockdown does not affect the
-- fixture builder):
--   sa_x  -> org_admin of org_b (the appointer / anti-lockout subject / chain reader)
--   sa_y  -> nsp_org_admin of org_b (curates the PQS roster; direct-write attacker)
--   st_x  -> per-hospital nsp_coordinator of hosp_b (a full PHI operator)
insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values ((select org_b from k), (select sa_x from k), 'org_admin', null);
insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values ((select org_b from k), (select sa_y from k), 'nsp_org_admin', null);
insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values ((select org_b from k), (select st_x from k), 'nsp_coordinator', (select hosp_b from k));

-- ============================================================================
-- §1: no write policy, no write grant (the structural lock)
-- ============================================================================
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'organization_members'
     and cmd in ('INSERT','UPDATE','DELETE','ALL')),
  0,
  '1.1: organization_members has NO INSERT/UPDATE/DELETE/ALL policy');
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'pqs_members'),
  0,
  '1.2: pqs_members has NO policy at all (RPC-only door, like case_access)');

select ok(not has_table_privilege('authenticated', 'public.organization_members', 'INSERT'),
  '1.3: authenticated has NO INSERT grant on organization_members');
select ok(not has_table_privilege('authenticated', 'public.organization_members', 'UPDATE'),
  '1.4: authenticated has NO UPDATE grant on organization_members');
select ok(not has_table_privilege('authenticated', 'public.organization_members', 'DELETE'),
  '1.5: authenticated has NO DELETE grant on organization_members');
select ok(not has_table_privilege('authenticated', 'public.pqs_members', 'INSERT'),
  '1.6: authenticated has NO INSERT grant on pqs_members');
select ok(not has_table_privilege('authenticated', 'public.pqs_members', 'UPDATE'),
  '1.7: authenticated has NO UPDATE grant on pqs_members');
select ok(not has_table_privilege('authenticated', 'public.pqs_members', 'DELETE'),
  '1.8: authenticated has NO DELETE grant on pqs_members');
-- SELECT stays (the read path is intact — the session/org readers depend on it).
select ok(has_table_privilege('authenticated', 'public.organization_members', 'SELECT'),
  '1.9: authenticated KEEPS SELECT on organization_members (read path intact)');

-- ============================================================================
-- §2: a direct write as a real org_admin / nsp_org_admin is rejected (42501)
-- ============================================================================
-- The C-3a vector: org_admin self-inserting an nsp_coordinator row directly.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.organization_members (organization_id, user_id, role, hospital_id)
            values (%L::uuid, %L::uuid, 'nsp_coordinator', %L::uuid) $$,
         (select org_b from k), (select sa_x from k), (select hosp_b from k)),
  '42501', null,
  '2.1: org_admin direct INSERT into organization_members rejected (C-3a closed)');
select throws_ok(
  format($$ update public.organization_members set role = 'org_admin'
            where user_id = %L::uuid and organization_id = %L::uuid $$,
         (select st_x from k), (select org_b from k)),
  '42501', null,
  '2.2: org_admin direct UPDATE of organization_members rejected (H-7 closed)');
reset role;

-- The C-3b vector: nsp_org_admin self-enrolling into the PHI roster directly.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.pqs_members (hospital_id, user_id)
            values (%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_y from k)),
  '42501', null,
  '2.3: nsp_org_admin direct INSERT into pqs_members rejected (C-3b closed)');
reset role;

-- ============================================================================
-- §3: every appointment RPC denies self-grant (42501, app._deny_self_grant)
-- ============================================================================
-- assign_org_admin: sa_x (org_admin) cannot grant itself.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_org_admin(%L::uuid, %L::uuid) $$,
         (select org_b from k), (select sa_x from k)),
  '42501', null,
  '3.1: assign_org_admin rejects self-grant (42501)');
-- assign_hospital_admin: sa_x (org_admin) cannot appoint itself.
select throws_ok(
  format($$ select public.assign_hospital_admin(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_x from k)),
  '42501', null,
  '3.2: assign_hospital_admin rejects self-grant (42501)');
-- assign_nsp_org_admin: sa_x (org_admin) cannot appoint itself.
select throws_ok(
  format($$ select public.assign_nsp_org_admin(%L::uuid, %L::uuid) $$,
         (select org_b from k), (select sa_x from k)),
  '42501', null,
  '3.3: assign_nsp_org_admin rejects self-grant (42501)');
reset role;
-- assign_nsp_coordinator: sa_y (nsp_org_admin) cannot appoint itself.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_nsp_coordinator(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_y from k)),
  '42501', null,
  '3.4: assign_nsp_coordinator rejects self-grant (42501)');
-- add_pqs_member: sa_y (nsp_org_admin) cannot self-enroll (the C-3b RPC gap).
select throws_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_y from k)),
  '42501', null,
  '3.5: add_pqs_member rejects self-enrollment (42501 — the C-3b RPC fix)');
reset role;

-- ============================================================================
-- §4: revoke_org_admin anti-lockout (HC081)
-- ============================================================================
-- sa_x is currently the ONLY org_admin of org_b -> cannot be removed.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.revoke_org_admin(%L::uuid, %L::uuid) $$,
         (select org_b from k), (select sa_x from k)),
  'HC081', null,
  '4.1: revoke_org_admin rejects removing the LAST org_admin (HC081 anti-lockout)');
reset role;

-- Appoint a SECOND org_admin (sa_y), then the first may be removed.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.assign_org_admin(%L::uuid, %L::uuid) $$,
         (select org_b from k), (select sa_y from k)),
  '4.2: assign_org_admin adds a SECOND org_admin (sa_y)');
select lives_ok(
  format($$ select public.revoke_org_admin(%L::uuid, %L::uuid) $$,
         (select org_b from k), (select st_y from k)),
  '4.3: revoke_org_admin of a NON-holder is a clean no-op (not last-of-kind)');
reset role;
-- sa_y is now an org_admin too; sa_x (not last anymore) can be revoked.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.revoke_org_admin(%L::uuid, %L::uuid) $$,
         (select org_b from k), (select sa_x from k)),
  '4.4: revoke_org_admin removes a non-last org_admin (sa_x) successfully');
reset role;
select ok(
  not exists (select 1 from public.organization_members
             where organization_id = (select org_b from k)
               and user_id = (select sa_x from k) and role = 'org_admin'),
  '4.5: sa_x org_admin row is gone after revoke');
-- Restore sa_x as an org_admin for the remaining sections (leave a stable state).
insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values ((select org_b from k), (select sa_x from k), 'org_admin', null)
  on conflict do nothing;

-- ============================================================================
-- §5 + §6: happy paths still work AND every write emits a chain-valid audit row
-- ============================================================================
create temp table ac on commit drop as
  select count(*)::int as before from public.audit_log;
grant select on ac to authenticated;

-- (5a) assign_nsp_coordinator by the nsp_org_admin (sa_y) -> row appears.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.assign_nsp_coordinator(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select st_y from k)),
  '5.1: nsp_org_admin assign_nsp_coordinator succeeds');
reset role;
select ok(
  app.is_nsp_coordinator_of_for((select hosp_b from k), (select st_y from k)),
  '5.2: st_y is now recognized as nsp_coordinator of hosp_b');

-- (5b) add_pqs_member by the coordinator (st_x) -> enrollment + PHI read resolves.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table enrolled on commit drop as
  select * from public.add_pqs_member((select hosp_b from k), (select sa_x from k));
reset role;
grant select on enrolled to authenticated;
select is(
  (select user_id from enrolled), (select sa_x from k),
  '5.3: add_pqs_member returns the enrolled row for sa_x');
select ok(
  app.is_pqs_member_of_for((select hosp_b from k), (select sa_x from k)),
  '5.4: sa_x PHI read now resolves (is_pqs_member_of_for = true after enrollment)');

-- (5c) remove_pqs_member -> gone.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.remove_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_x from k)),
  '5.5: coordinator remove_pqs_member succeeds');
reset role;
select ok(
  not app.is_pqs_member_of_for((select hosp_b from k), (select sa_x from k)),
  '5.6: sa_x no longer a PHI operator after removal');

-- (6a) the writes above emitted audit rows (count grew).
select ok(
  (select count(*)::int from public.audit_log) > (select before from ac),
  '6.1: the §5 grants/revokes emitted audit rows (count grew)');

-- (6b) the coordinator grant emitted an organization_member.granted row with the
--      correct scope (org + hospital), NO PHI in the payload.
select is(
  (select count(*)::int from public.audit_log
   where action = 'organization_member.granted'
     and entity_type = 'organization_member'
     and hospital_id = (select hosp_b from k)
     and organization_id = (select org_b from k)
     and metadata ->> 'role' = 'nsp_coordinator'
     and metadata ->> 'user_id' = (select st_y from k)::text),
  1,
  '6.2: organization_member.granted audit row for the coordinator grant (scope + role, no PHI)');

-- (6c) the pqs enrollment emitted a pqs_member.enrolled row scoped to the hospital,
--      carrying ONLY user_id + hospital_id (never the PHI it unlocks).
select is(
  (select count(*)::int from public.audit_log
   where action = 'pqs_member.enrolled'
     and entity_type = 'pqs_member'
     and hospital_id = (select hosp_b from k)
     and metadata ->> 'user_id' = (select sa_x from k)::text),
  1,
  '6.3: pqs_member.enrolled audit row scoped to hosp_b (user + hospital only)');
-- No PHI key ever appears in a membership audit payload.
select ok(
  not exists (
    select 1 from public.audit_log
    where action in ('organization_member.granted','organization_member.revoked',
                     'organization_member.role_changed','pqs_member.enrolled',
                     'pqs_member.removed')
      and (metadata ? 'name' or metadata ? 'mrn' or metadata ? 'body'
           or metadata ? 'summary' or metadata ? 'sex' or metadata ? 'dob')),
  '6.4: NO PHI key (name/mrn/body/...) in any membership audit payload (Rule 11)');

-- (6d) the removal emitted a pqs_member.removed row.
select is(
  (select count(*)::int from public.audit_log
   where action = 'pqs_member.removed'
     and metadata ->> 'user_id' = (select sa_x from k)::text),
  1,
  '6.5: pqs_member.removed audit row after remove_pqs_member');

-- (6e) tamper-evidence intact: the org chain (org_admin grants) and the hospital
--      chain (coordinator + pqs grants) both still verify. Read as sa_x (org_admin
--      of org_b -> passes both the org-tier and hospital-tier authz).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok(
  (select ok from public.verify_audit_chain(null, (select org_b from k))),
  '6.6: org audit chain remains intact after the membership writes (verify_audit_chain)');
select ok(
  (select ok from public.verify_audit_chain(null, null, (select hosp_b from k))),
  '6.7: hospital audit chain remains intact after the membership writes');
reset role;

-- ============================================================================
-- §7: the shared self-guard + the new RPCs exist with the right shape
-- ============================================================================
select has_function('app', '_deny_self_grant', array['uuid'],
  '7.1: app._deny_self_grant(uuid) exists (shared self-exclusion helper)');
select has_function('public', 'assign_org_admin', array['uuid','uuid'],
  '7.2: public.assign_org_admin(uuid, uuid) exists (the new org_admin door)');
select has_function('public', 'revoke_org_admin', array['uuid','uuid'],
  '7.3: public.revoke_org_admin(uuid, uuid) exists');
-- t19: the new RPCs are NOT anon-executable (PUBLIC revoked).
select ok(
  not has_function_privilege('anon', 'public.assign_org_admin(uuid,uuid)', 'EXECUTE'),
  '7.4: assign_org_admin is NOT anon-executable (t19 grant hygiene)');
select ok(
  not has_function_privilege('anon', 'public.revoke_org_admin(uuid,uuid)', 'EXECUTE'),
  '7.5: revoke_org_admin is NOT anon-executable (t19 grant hygiene)');

select * from finish();
rollback;
