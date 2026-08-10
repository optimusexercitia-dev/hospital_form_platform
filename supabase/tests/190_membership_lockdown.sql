-- WS-1 · Membership write-path lockdown (C-3; closes H-6, H-7).
-- Migration: 20260711000000_membership_write_lockdown.sql
-- Plan: docs/plans/membership-write-path-lockdown.md  (Verification §pgTAP 1–6).
--
-- The lock: this suite fails if a future migration re-adds a write policy / grant,
-- re-introduces a self-grantable RPC, weakens the anti-lockout, or stops auditing a
-- grant. The invariant cannot silently reopen.
--
-- Covers (MEM collapse: organization_members/commission_members/pqs_members are now
-- the single public.memberships table; the invariants below carry over verbatim):
--   §1  memberships has no INSERT/UPDATE/DELETE/ALL policy; authenticated holds
--       no INSERT/UPDATE/DELETE grant. SELECT on memberships still granted.
--   §2  A direct INSERT/UPDATE as a seeded org_admin / nsp_org_admin is rejected by
--       RLS (no write policy + no write grant => permission denied 42501).
--   §3  Each assign_*/add_* RPC rejects self-grant (42501).
--   §4  revoke_org_admin rejects removing the last org_admin (HC081); a non-last
--       removal succeeds.
--   §5  Happy paths: assign_org_admin -> row; assign_nsp_coordinator -> row;
--       add_pqs_member -> enrollment AND the PHI read resolves; revoke_* -> gone.
--   §6  Every grant/revoke in §5 emits a unified membership.* audit row (correct verb
--       + scope; NO PHI in payload) AND the affected chains stay verify_audit_chain-intact.

begin;
select plan(38);

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
-- ⚠ PRECONDITION, ASSERTED RATHER THAN INHERITED (AFF T3.5). This file reasons about
-- "the LAST org_admin", so it must CONTROL how many exist — and until T3.5 it merely
-- inherited "the bootstrap creates none". T3.5 added an org_admin to the shared
-- bootstrap (FUP-PCITV-1 row 6: without one, the ORG disjunct of
-- `is_tenancy_admin_of` was unexercised by six isolation keystones), and the
-- anti-lockout assertions went red — correctly. One fixture cannot satisfy both specs,
-- so the spec that OWNS the count normalizes it HERE, before building its own, instead
-- of depending on a fixture it does not control. Rolled back with the transaction.
-- Targets ONLY the bootstrap's own persona, by its key in the fixture's jsonb — not
-- "every org_admin of org_b", which also deleted the one this file builds for itself.
delete from public.memberships
 where role = 'org_admin' and commission_id is null and hospital_id is null
   and principal_id = (((select v from ctx)) ->> 'oa_b')::uuid;
select is(
  (select count(*)::int from public.memberships
    where organization_id = (select org_b from k) and role = 'org_admin'), 0,
  '0.0 org_admin precondition: org_b starts with ZERO org_admins before this file builds its own');

insert into public.memberships (organization_id, principal_id, role, hospital_id)
  values ((select org_b from k), (select sa_x from k), 'org_admin', null);
insert into public.memberships (organization_id, principal_id, role, hospital_id)
  values ((select org_b from k), (select sa_y from k), 'nsp_org_admin', null);
insert into public.memberships (organization_id, principal_id, role, hospital_id)
  values ((select org_b from k), (select st_x from k), 'nsp_coordinator', (select hosp_b from k));

-- ============================================================================
-- §1: no write policy, no write grant (the structural lock). Reads ARE allowed
-- (memberships carries a unified SELECT policy + grant — the collapse's read path;
-- see 20260720000000_memberships_table.sql). Only INSERT/UPDATE/DELETE are locked.
-- ============================================================================
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'memberships'
     and cmd in ('INSERT','UPDATE','DELETE','ALL')),
  0,
  '1.1: memberships has NO INSERT/UPDATE/DELETE/ALL policy (SELECT policy is legitimate)');

select ok(not has_table_privilege('authenticated', 'public.memberships', 'INSERT'),
  '1.3: authenticated has NO INSERT grant on memberships');
select ok(not has_table_privilege('authenticated', 'public.memberships', 'UPDATE'),
  '1.4: authenticated has NO UPDATE grant on memberships');
select ok(not has_table_privilege('authenticated', 'public.memberships', 'DELETE'),
  '1.5: authenticated has NO DELETE grant on memberships');
-- (1.6-1.8 retired: pqs_member rows now live on the SAME memberships table as
-- org/commission rows, so 1.3-1.5 already cover them — no separate table to probe.)
-- SELECT stays (the read path is intact — the session/org readers depend on it).
select ok(has_table_privilege('authenticated', 'public.memberships', 'SELECT'),
  '1.9: authenticated KEEPS SELECT on memberships (read path intact)');

-- ============================================================================
-- §2: a direct write as a real org_admin / nsp_org_admin is rejected (42501)
-- ============================================================================
-- The C-3a vector: org_admin self-inserting an nsp_coordinator row directly.
select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
set local role authenticated;
select throws_ok(
  format($$ insert into public.memberships (organization_id, principal_id, role, hospital_id)
            values (%L::uuid, %L::uuid, 'nsp_coordinator', %L::uuid) $$,
         (select org_b from k), (select sa_x from k), (select hosp_b from k)),
  '42501', null,
  '2.1: org_admin direct INSERT into memberships rejected (C-3a closed)');
select throws_ok(
  format($$ update public.memberships set role = 'org_admin'
            where principal_id = %L::uuid and organization_id = %L::uuid $$,
         (select st_x from k), (select org_b from k)),
  '42501', null,
  '2.2: org_admin direct UPDATE of memberships rejected (H-7 closed)');
reset role;

-- The C-3b vector: nsp_org_admin self-enrolling into the PHI roster directly
-- (a pqs_member-role row on the same collapsed memberships table).
select test_helpers.claims_for((select sa_y from k), false, 'nsp_org_admin');
set local role authenticated;
select throws_ok(
  format($$ insert into public.memberships (organization_id, hospital_id, principal_id, role)
            values (%L::uuid, %L::uuid, %L::uuid, 'pqs_member') $$,
         (select org_b from k), (select hosp_b from k), (select sa_y from k)),
  '42501', null,
  '2.3: nsp_org_admin direct INSERT of a pqs_member row into memberships rejected (C-3b closed)');
reset role;

-- ============================================================================
-- §3: every appointment RPC denies self-grant (42501, app._deny_self_grant)
-- ============================================================================
-- assign_org_admin: sa_x (org_admin) cannot grant itself.
select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
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
select test_helpers.claims_for((select sa_y from k), false, 'nsp_org_admin');
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
-- §4: revoke_org_admin anti-lockout (HC0G1, re-homed from HC081 by the MEM collapse)
-- ============================================================================
-- sa_x is currently the ONLY org_admin of org_b -> cannot be removed.
select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
set local role authenticated;
select throws_ok(
  format($$ select public.revoke_org_admin(%L::uuid, %L::uuid) $$,
         (select org_b from k), (select sa_x from k)),
  'HC0G1', null,
  '4.1: revoke_org_admin rejects removing the LAST org_admin (HC0G1 anti-lockout)');
reset role;

-- Appoint a SECOND org_admin (sa_y), then the first may be removed.
select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
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
select test_helpers.claims_for((select sa_y from k), false, 'org_admin');
set local role authenticated;
select lives_ok(
  format($$ select public.revoke_org_admin(%L::uuid, %L::uuid) $$,
         (select org_b from k), (select sa_x from k)),
  '4.4: revoke_org_admin removes a non-last org_admin (sa_x) successfully');
reset role;
select ok(
  not exists (select 1 from public.memberships
             where organization_id = (select org_b from k)
               and principal_id = (select sa_x from k) and role = 'org_admin'),
  '4.5: sa_x org_admin row is gone after revoke');
-- Restore sa_x as an org_admin for the remaining sections (leave a stable state).
insert into public.memberships (organization_id, principal_id, role, hospital_id)
  values ((select org_b from k), (select sa_x from k), 'org_admin', null)
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;

-- ============================================================================
-- §5 + §6: happy paths still work AND every write emits a chain-valid audit row
-- ============================================================================
create temp table ac on commit drop as
  select count(*)::int as before from public.audit_log;
grant select on ac to authenticated;

-- (5a) assign_nsp_coordinator by the nsp_org_admin (sa_y) -> row appears.
select test_helpers.claims_for((select sa_y from k), false, 'nsp_org_admin');
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
-- add_pqs_member now RETURNS VOID (the shim over grant_role) — assert enrollment via
-- app.has_role instead of reading a returned row (O-5).
select test_helpers.claims_for((select st_x from k), false, 'nsp_coordinator');
set local role authenticated;
select lives_ok(
  format($$ select public.add_pqs_member(%L::uuid, %L::uuid) $$,
         (select hosp_b from k), (select sa_x from k)),
  '5.3: add_pqs_member enrolls sa_x (void return)');
reset role;
select ok(
  app.has_role('hospital', (select hosp_b from k), 'pqs_member', (select sa_x from k)),
  '5.3b: sa_x now enrolled per app.has_role (hospital, pqs_member)');
select ok(
  app.is_pqs_member_of_for((select hosp_b from k), (select sa_x from k)),
  '5.4: sa_x PHI read now resolves (is_pqs_member_of_for = true after enrollment)');

-- (5c) remove_pqs_member -> gone.
select test_helpers.claims_for((select st_x from k), false, 'nsp_coordinator');
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

-- (6b) the coordinator grant emitted a membership.granted row with the
--      correct scope (org + hospital), NO PHI in the payload.
select is(
  (select count(*)::int from public.audit_log
   where action = 'membership.granted'
     and entity_type = 'membership'
     and hospital_id = (select hosp_b from k)
     and organization_id = (select org_b from k)
     and metadata ->> 'role' = 'nsp_coordinator'
     and metadata ->> 'user_id' = (select st_y from k)::text),
  1,
  '6.2: membership.granted audit row for the coordinator grant (scope + role, no PHI)');

-- (6c) the pqs enrollment emitted a membership.granted row scoped to the hospital,
--      carrying ONLY user_id + hospital_id (never the PHI it unlocks).
select is(
  (select count(*)::int from public.audit_log
   where action = 'membership.granted'
     and entity_type = 'membership'
     and hospital_id = (select hosp_b from k)
     and metadata ->> 'role' = 'pqs_member'
     and metadata ->> 'user_id' = (select sa_x from k)::text),
  1,
  '6.3: membership.granted audit row scoped to hosp_b for the pqs enrollment (user + hospital only)');
-- No PHI key ever appears in a membership audit payload.
select ok(
  not exists (
    select 1 from public.audit_log
    where action in ('membership.granted','membership.revoked','membership.role_changed')
      and (metadata ? 'name' or metadata ? 'mrn' or metadata ? 'body'
           or metadata ? 'summary' or metadata ? 'sex' or metadata ? 'dob')),
  '6.4: NO PHI key (name/mrn/body/...) in any membership audit payload (Rule 11)');

-- (6d) the removal emitted a membership.revoked row.
select is(
  (select count(*)::int from public.audit_log
   where action = 'membership.revoked'
     and metadata ->> 'user_id' = (select sa_x from k)::text
     and metadata ->> 'role' = 'pqs_member'),
  1,
  '6.5: membership.revoked audit row after remove_pqs_member');

-- (6e) tamper-evidence intact: the org chain (org_admin grants) and the hospital
--      chain (coordinator + pqs grants) both still verify. Read as sa_x (org_admin
--      of org_b -> passes both the org-tier and hospital-tier authz).
select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
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
