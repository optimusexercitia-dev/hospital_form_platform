-- S1·MEM · Single `public.memberships` collapse — the lock.
-- Migrations: 20260720000000_memberships_table .. 20260720000400_memberships_audit_and_drop_legacy.
-- Spec: docs/plans/memberships-collapse-s6-1.md §6. ADR 0075 (write-path split).
--
-- The lock: this suite fails if the collapse regresses — a direct write path reopens,
-- self-grant/self-escalation is admitted, the anti-lockout weakens, a membership
-- predicate stops resolving through has_role, the shape CHECK is loosened, a grant is
-- not audited under the unified membership.* verb family, or case_access gets coupled
-- to memberships.
--
-- Covers (spec §6 + readiness additions 2b/6b/7b):
--   §1  no write policy / no authenticated DML grant on memberships (structural lock).
--   §2  direct INSERT/UPDATE/DELETE as a seeded org_admin/staff_admin/nsp_org_admin
--       rejected (2b: staff_admin — the newly-locked commission path).
--   §3  door + shims reject self-grant (42501); staff self-escalation stays 42501 (D3).
--   §4  revoke_role last-org_admin anti-lockout (HC0G1); non-last succeeds.
--   §5  happy path per tier: grant_role -> row + wrapper true; revoke_role -> gone + false.
--   §6  each grant/revoke emits exactly one audit row (6b: membership.* verb present;
--       the 3 legacy families absent; no PHI in payload).
--   §7  27-wrapper truth-table negatives (7b: driven by the VERIFIED predicate inventory,
--       including the "missed" is_entitled_document_approver that read commission_members).
--   §8  is_pqs_member_of_any resolves the synthetic pqs_member role.
--   §9  expires_at inertness (NULL never filters; past filters).
--   §10 shape CHECK rejects illegal shapes.
--   §11 grant idempotency (on conflict do nothing).
--   §12 case_access untouched by the collapse.
--
-- ACT Stage 1 (ADR 0106; lead ruling 2026-08-09): every inline
-- `set_config('request.jwt.claims', json_build_object(...))` call below is routed
-- through `test_helpers.claims_for(<principal>)` — this file is Stage 3's caller-only
-- hat condition landing on `has_role`, so its 27-wrapper truth table and grant/revoke
-- assertions must carry the `p_active_role` slot rather than being rewritten inside
-- Stage 3's own red window. `claims_for` mints `p_active_role => null` by default
-- (no claim), so this is behaviour-preserving today. It also always sets an
-- `is_admin` key (default false) the raw payload below omitted — verified inert:
-- `app.is_admin()` reads `(claims->>'is_admin') = 'true'`, so an absent key (NULL)
-- and an explicit `'false'` both evaluate to non-true and fall through identically
-- to the `profiles.is_admin` check (docs/plans/act-as-buildnotes.md has the full
-- diff + the catalog-verified `is_admin()` body).

begin;
select plan(65);   -- ADR 0078 Stage B: +1 (case_access_grants successor assertion)

update app.feature_flags set enabled = true where key = 'audit_trail';
update app.feature_flags set enabled = true where key = 'patient_safety';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,   -- staff_admin of comm_x
         (v->>'st_x')::uuid   as st_x,   -- staff of comm_x
         (v->>'st_x2')::uuid  as st_x2,  -- staff of comm_x
         (v->>'sa_y')::uuid   as sa_y,   -- staff_admin of comm_y
         (v->>'st_y')::uuid   as st_y,   -- staff of comm_y
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- Org/hospital-tier personas (superuser inserts — RLS/grant-exempt fixture builder).
--   sa_x  -> org_admin of org_b (appointer / anti-lockout subject).
--   sa_y  -> nsp_org_admin of org_b (appoints coordinators; direct-write attacker).
--   st_x  -> nsp_coordinator of hosp_b (full PHI operator).
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  ((select org_b from k), null, (select sa_x from k), 'org_admin'),
  ((select org_b from k), null, (select sa_y from k), 'nsp_org_admin'),
  ((select org_b from k), (select hosp_b from k), (select st_x from k), 'nsp_coordinator');

-- ============================================================================
-- §1 · No write path on the storage (structural lock)
-- ============================================================================
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='memberships'
     and cmd in ('INSERT','UPDATE','DELETE','ALL')),
  0, '1.1: memberships has NO INSERT/UPDATE/DELETE/ALL policy');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema='public' and table_name='memberships'
     and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')),
  0, '1.2: authenticated holds NO INSERT/UPDATE/DELETE grant on memberships');

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema='public' and table_name='memberships'
     and grantee='authenticated' and privilege_type='SELECT'),
  1, '1.3: authenticated retains a SELECT grant (RLS-gated reads resolve)');

select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='memberships' and cmd='SELECT'),
  1, '1.4: exactly one SELECT policy on memberships');

-- ============================================================================
-- §2 · Direct write as a seeded role is rejected (2b: staff_admin path too)
-- ============================================================================
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select throws_ok($$
  insert into public.memberships (commission_id, principal_id, role)
  values ((select comm_x from k), (select st_y from k), 'staff') $$,
  '42501', null, '2.1: org_admin direct INSERT into memberships rejected');
reset role;

set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
-- sa_x is a staff_admin of comm_x (the newly-locked commission path, readiness 2b).
select throws_ok($$
  insert into public.memberships (commission_id, principal_id, role)
  values ((select comm_x from k), (select st_x2 from k), 'staff_admin') $$,
  '42501', null, '2.2: staff_admin direct INSERT into memberships rejected (newly-locked path)');
select throws_ok($$
  delete from public.memberships
  where commission_id=(select comm_x from k) and principal_id=(select st_x from k) $$,
  '42501', null, '2.3: staff_admin direct DELETE from memberships rejected');
reset role;

set local role authenticated;
select test_helpers.claims_for((select sa_y from k));
select throws_ok($$
  insert into public.memberships (organization_id, hospital_id, principal_id, role)
  values ((select org_b from k), (select hosp_b from k), (select sa_y from k), 'pqs_member') $$,
  '42501', null, '2.4: nsp_org_admin direct self-INSERT into memberships rejected');
reset role;

-- ============================================================================
-- §3 · Self-grant (42501) + staff self-escalation stays 42501 (D3)
-- ============================================================================
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select throws_ok($$ select public.grant_role('organization',
  (select org_b from k), 'org_admin', (select sa_x from k)) $$,
  '42501', null, '3.1: grant_role rejects self-grant (42501)');
select throws_ok($$ select public.assign_org_admin(
  (select org_b from k), (select sa_x from k)) $$,
  '42501', null, '3.2: assign_org_admin shim rejects self-grant (42501)');
reset role;

-- A plain staff CANNOT escalate itself (or anyone) to staff_admin (stays 42501, D3).
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select throws_ok($$ select public.grant_role('commission',
  (select comm_x from k), 'staff_admin', (select st_x2 from k)) $$,
  '42501', null, '3.3: plain staff cannot grant staff_admin (self-escalation blocked, 42501)');
reset role;

-- A staff_admin who is NOT an org/hospital admin also cannot grant staff_admin.
-- sa_x is an org_admin (would be authorized), so use a CLEAN staff_admin: promote st_y
-- to staff_admin of comm_y (st_y holds no org/hospital role) and have IT try.
insert into public.memberships (commission_id, principal_id, role)
  values ((select comm_y from k), (select st_y from k), 'staff_admin')
  on conflict do nothing;
delete from public.memberships
  where commission_id=(select comm_y from k) and principal_id=(select st_y from k) and role='staff';
set local role authenticated;
select test_helpers.claims_for((select st_y from k));
select throws_ok($$ select public.grant_role('commission',
  (select comm_y from k), 'staff_admin', (select sa_y from k)) $$,
  '42501', null, '3.4: a plain staff_admin cannot grant staff_admin (role-pin, 42501)');
reset role;
-- Undo: restore st_y as plain staff of comm_y for the rest of the suite.
delete from public.memberships
  where commission_id=(select comm_y from k) and principal_id=(select st_y from k) and role='staff_admin';
insert into public.memberships (commission_id, principal_id, role)
  values ((select comm_y from k), (select st_y from k), 'staff') on conflict do nothing;

-- ============================================================================
-- §4 · Anti-lockout HC0G1 (last org_admin) + non-last succeeds
-- ============================================================================

-- ⚠ PRECONDITION, ASSERTED RATHER THAN INHERITED (AFF T3.5). This section reasons about
-- "the LAST org_admin", so it must CONTROL how many exist; until T3.5 it merely
-- inherited "the bootstrap creates none". T3.5 added an org_admin to the shared
-- bootstrap (FUP-PCITV-1 row 6 — without one, the ORG disjunct of
-- `is_tenancy_admin_of` was unexercised by six isolation keystones). One fixture
-- cannot satisfy both specs, so the spec that OWNS the count normalizes it here.
-- ⚠ Runs BEFORE the role switch below: a DELETE as `authenticated` is refused and
-- aborts the file — which is how the first placement of this block was caught.
-- Targets ONLY the bootstrap's own persona, by its key in the fixture's jsonb — not
-- "every org_admin of org_b", which also deleted the one this file builds for itself.
delete from public.memberships
 where role = 'org_admin' and commission_id is null and hospital_id is null
   and principal_id = (((select v from ctx)) ->> 'oa_b')::uuid;

-- sa_x is currently org_b's ONLY org_admin -> a self... no: sa_x cannot self-revoke
-- via self path anyway; revoke a DIFFERENT last-admin. Set up: grant a 2nd org_admin,
-- then revoke sa_x (non-last, succeeds), then revoke the survivor (last, HC0G1).
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));

select lives_ok($$ select public.grant_role('organization',
  (select org_b from k), 'org_admin', (select st_y from k)) $$,
  '4.1: org_admin grants a SECOND org_admin (setup)');
select lives_ok($$ select public.revoke_role('organization',
  (select org_b from k), 'org_admin', (select sa_x from k)) $$,
  '4.2: revoking a NON-last org_admin succeeds');
reset role;
-- st_y is now the last org_admin of org_b; st_y revoking itself... use its session.
set local role authenticated;
select test_helpers.claims_for((select st_y from k));
select throws_ok($$ select public.revoke_role('organization',
  (select org_b from k), 'org_admin', (select st_y from k)) $$,
  'HC0G1', null, '4.3: revoking the LAST org_admin rejected (HC0G1)');
reset role;
-- Restore sa_x as org_admin for the rest of the suite (superuser).
insert into public.memberships (organization_id, principal_id, role)
  values ((select org_b from k), (select sa_x from k), 'org_admin')
  on conflict do nothing;
delete from public.memberships
  where organization_id=(select org_b from k) and principal_id=(select st_y from k) and role='org_admin';

-- ============================================================================
-- §5 · Happy path per tier: grant -> row + wrapper true; revoke -> gone + false
-- ============================================================================
-- (a) commission staff: sa_x (org_admin OR staff_admin) grants st_y as staff of comm_x.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select lives_ok($$ select public.grant_role('commission',
  (select comm_x from k), 'staff', (select st_y from k)) $$,
  '5.1: grant_role staff succeeds');
reset role;
select ok(app.is_member_of_for((select comm_x from k), (select st_y from k)),
  '5.2: is_member_of true after staff grant');
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select lives_ok($$ select public.revoke_role('commission',
  (select comm_x from k), 'staff', (select st_y from k)) $$,
  '5.3: revoke_role staff succeeds');
reset role;
select ok(not app.is_member_of_for((select comm_x from k), (select st_y from k)),
  '5.4: is_member_of false after staff revoke');

-- (b) hospital nsp_coordinator: sa_y (nsp_org_admin) grants + revokes st_y as coordinator.
set local role authenticated;
select test_helpers.claims_for((select sa_y from k));
select lives_ok($$ select public.grant_role('hospital',
  (select hosp_b from k), 'nsp_coordinator', (select st_y from k)) $$,
  '5.5: grant_role nsp_coordinator succeeds');
reset role;
select ok(app.is_nsp_coordinator_of_for((select hosp_b from k), (select st_y from k)),
  '5.6: is_nsp_coordinator_of true after grant');

-- (c) hospital pqs_member: st_x (coordinator) grants st_x2 as pqs_member.
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select lives_ok($$ select public.grant_role('hospital',
  (select hosp_b from k), 'pqs_member', (select st_x2 from k)) $$,
  '5.7: coordinator grant_role pqs_member succeeds');
select lives_ok($$ select public.add_pqs_member(
  (select hosp_b from k), (select st_y from k)) $$,
  '5.8: add_pqs_member shim (void) succeeds');
reset role;
select ok(app.is_pqs_member_of_for((select hosp_b from k), (select st_x2 from k)),
  '5.9: is_pqs_member_of true after pqs grant');

-- (d) organization tier: sa_x (org_admin) grants st_x2 as nsp_org_admin.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select lives_ok($$ select public.grant_role('organization',
  (select org_b from k), 'nsp_org_admin', (select st_x2 from k)) $$,
  '5.10: grant_role nsp_org_admin succeeds');
reset role;
select ok(app.is_nsp_org_admin_of_for((select org_b from k), (select st_x2 from k)),
  '5.11: is_nsp_org_admin_of true after grant');

-- ============================================================================
-- §6 · Audit: unified membership.* verbs; legacy families absent; no PHI (6b)
-- ============================================================================
select ok(
  (select count(*) from public.audit_log where action='membership.granted') > 0,
  '6.1: membership.granted audit rows exist (unified verb)');
select ok(
  (select count(*) from public.audit_log where action='membership.revoked') > 0,
  '6.2: membership.revoked audit rows exist');
select is(
  (select count(*)::int from public.audit_log
   where action like 'commission_member.%'
      or action like 'organization_member.%'
      or action like 'pqs_member.%'),
  0, '6.3: NO legacy membership verb families present (D1 hard-cut)');
select is(
  (select count(*)::int from public.audit_log
   where action='membership.granted'
     and (metadata::text ilike '%mrn%' or metadata::text ilike '%cpf%'
          or metadata ? 'full_name' or metadata ? 'name')),
  0, '6.4: membership.granted metadata carries NO PHI (role+scope+who only)');
select is(
  (select entity_type from public.audit_log where action='membership.granted' limit 1),
  'membership', '6.5: audit entity_type is membership');

-- Exactly one audit row per grant op (count delta): grant a fresh staff, assert +1.
select is(
  (select count(*)::int from public.audit_log
   where action='membership.granted' and metadata->>'user_id'=(select st_y from k)::text
     and metadata->>'commission_id'=(select comm_x from k)::text),
  1, '6.6: exactly one membership.granted row for the §5.1 staff grant');

-- ============================================================================
-- §7 · Predicate truth-table negatives (7b: the VERIFIED membership-reading set,
--       including the "missed" is_entitled_document_approver)
-- ============================================================================
-- A principal WITHOUT a grant → wrapper false; WITH → true. st_y has no grants now
-- (all revoked / never granted the tested role).
select ok(not app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)),
  '7.1: is_staff_admin_of false for a plain staff');
select ok(app.is_staff_admin_of_for((select comm_x from k), (select sa_x from k)),
  '7.2: is_staff_admin_of true for the staff_admin');
select ok(app.is_tenancy_admin_of_for((select comm_x from k), (select sa_x from k)),
  '7.3: is_tenancy_admin_of true for the org_admin of the commission org');
select ok(not app.is_tenancy_admin_of_for((select comm_x from k), (select st_x from k)),
  '7.4: is_tenancy_admin_of false for a plain staff');
select ok(app.is_pqs_operator_of_for((select hosp_b from k), (select st_x from k)),
  '7.5: is_pqs_operator_of true for a coordinator with no member row');
select ok(app.is_pqs_operator_of_for((select hosp_b from k), (select st_x2 from k)),
  '7.6: is_pqs_operator_of true for a member with no coordinator row');
-- 7.7/7.8/7.9 harden (QA m3): these wrappers take only a scope arg and read auth.uid()
-- internally, so drive each with a session JWT for a true/false truth pair (not just an
-- `is not null` smoke). is_org_level_admin_within: an org-tier admin (hospital_admin /
-- nsp_org_admin) of the org. st_x2 was granted nsp_org_admin of org_b in §5.10; st_x is
-- only a hospital-tier operator of hosp_b (no org-tier admin grant).
set local role authenticated;
select test_helpers.claims_for((select st_x2 from k));
select ok(app.is_org_level_admin_within((select org_b from k)),
  '7.7a: is_org_level_admin_within TRUE for an nsp_org_admin of the org');
select test_helpers.claims_for((select st_x from k));
select ok(not app.is_org_level_admin_within((select org_b from k)),
  '7.7b: is_org_level_admin_within FALSE for a hospital-only operator (no org-tier admin grant)');
reset role;

-- is_hospital_member_of: member of ANY commission in the hospital. sa_x is a staff_admin
-- of comm_x (under hosp_b); the platform admin holds no commission membership.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select ok(app.is_hospital_member_of((select hosp_b from k)),
  '7.8a: is_hospital_member_of TRUE for a commission member of the hospital');
select test_helpers.claims_for((select admin from k));
select ok(not app.is_hospital_member_of((select hosp_b from k)),
  '7.8b: is_hospital_member_of FALSE for a non-member (platform admin)');
reset role;

-- is_org_member: any commission membership within the org. sa_x is a member of comm_x in
-- org_b; the platform admin holds none.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select ok(app.is_org_member((select org_b from k)),
  '7.9a: is_org_member TRUE for a commission member of the org');
select test_helpers.claims_for((select admin from k));
select ok(not app.is_org_member((select org_b from k)),
  '7.9b: is_org_member FALSE for a non-member (platform admin)');
reset role;
-- The MISSED predicate: is_entitled_document_approver read commission_members. It must
-- still resolve — sa_x is a member of comm_x (in hosp_b) → entitled for hosp_b.
select ok(app.is_entitled_document_approver((select hosp_b from k), (select sa_x from k)),
  '7.10: is_entitled_document_approver true for a hospital commission member (repointed)');
select ok(not app.is_entitled_document_approver((select hosp_b from k), (select admin from k)),
  '7.11: is_entitled_document_approver false for a non-member (platform admin)');
-- is_pqs_operator_in_org: st_x is a coordinator of hosp_b in org_b.
select ok(app.is_pqs_operator_in_org_for((select org_b from k), (select st_x from k)),
  '7.12: is_pqs_operator_in_org true for a coordinator in the org');

-- ============================================================================
-- §8 · is_pqs_member_of_any resolves the synthetic pqs_member role
-- ============================================================================
select ok(app.is_pqs_member_of_any((select st_x2 from k)),
  '8.1: is_pqs_member_of_any true for an enrolled principal');
select ok(not app.is_pqs_member_of_any((select sa_x from k)),
  '8.2: is_pqs_member_of_any false for a non-enrolled principal');

-- ============================================================================
-- §9 · expires_at inertness
-- ============================================================================
-- Set a FUTURE expiry on st_x2's pqs grant → still resolves (inert).
update public.memberships set expires_at = now() + interval '1 day'
  where principal_id=(select st_x2 from k) and role='pqs_member';
select ok(app.is_pqs_member_of_for((select hosp_b from k), (select st_x2 from k)),
  '9.1: a future expires_at does NOT filter (grant still resolves)');
-- Set a PAST expiry → filters out.
update public.memberships set expires_at = now() - interval '1 day'
  where principal_id=(select st_x2 from k) and role='pqs_member';
select ok(not app.is_pqs_member_of_for((select hosp_b from k), (select st_x2 from k)),
  '9.2: a past expires_at filters the grant (wrapper false)');
-- Reset to NULL for cleanliness.
update public.memberships set expires_at = null
  where principal_id=(select st_x2 from k) and role='pqs_member';
select ok(app.is_pqs_member_of_for((select hosp_b from k), (select st_x2 from k)),
  '9.3: NULL expires_at never filters (permanent grant)');

-- ============================================================================
-- §10 · Shape CHECK rejects illegal shapes (superuser — bypasses RLS, hits the CHECK)
-- ============================================================================
select throws_ok($$
  insert into public.memberships (commission_id, organization_id, principal_id, role)
  values ((select comm_x from k), (select org_b from k), (select st_y from k), 'staff') $$,
  '23514', null, '10.1: staff with a non-null organization_id rejected (shape CHECK)');
select throws_ok($$
  insert into public.memberships (organization_id, commission_id, principal_id, role)
  values ((select org_b from k), (select comm_x from k), (select st_y from k), 'org_admin') $$,
  '23514', null, '10.2: org_admin with a non-null commission_id rejected');
select throws_ok($$
  insert into public.memberships (organization_id, principal_id, role)
  values ((select org_b from k), (select st_y from k), 'pqs_member') $$,
  '23514', null, '10.3: pqs_member with a null hospital_id rejected');
select throws_ok($$
  insert into public.memberships (hospital_id, principal_id, role)
  values ((select hosp_b from k), (select st_y from k), 'hospital_admin') $$,
  '23514', null, '10.4: hospital_admin with a null organization_id rejected');
select lives_ok($$
  insert into public.memberships (organization_id, hospital_id, commission_id, principal_id, role, title_id)
  values (null, null, (select comm_x from k), (select st_y from k), 'staff',
          (select id from public.commission_member_titles
             where commission_id=(select comm_x from k) limit 1)) $$,
  '10.5: title_id on a valid commission row is allowed (control for 10.6)');
select throws_ok($$
  insert into public.memberships (organization_id, principal_id, role, title_id)
  values ((select org_b from k), (select st_y from k), 'org_admin',
          (select id from public.commission_member_titles
             where commission_id=(select comm_x from k) limit 1)) $$,
  '23514', null, '10.6: title_id on a non-commission row rejected (title_scope CHECK)');
-- clean up the 10.5 control row.
delete from public.memberships where commission_id=(select comm_x from k)
  and principal_id=(select st_y from k) and role='staff';

-- ============================================================================
-- §11 · Grant idempotency — no duplicate row.
--    ⚠ The mechanism changed on 2026-08-07: this header said `on conflict do nothing`.
--    Since QO·FUP F1 (ADR 0102) the kernel's targeted clause is `do update set
--    expires_at = coalesce(excluded.expires_at, memberships.expires_at)`. §11 still
--    proves NO DUPLICATE ROW — which is what it is for, and what the targeted conflict
--    target guarantees — but "nothing happens" is no longer true of the statement. The
--    calls below pass no expiry, so coalesce(null, existing) writes the existing value
--    back and the row is unchanged. `306` §4 owns the expiry behaviour itself.
-- ============================================================================
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select lives_ok($$ select public.grant_role('commission',
  (select comm_x from k), 'staff', (select st_y from k)) $$, '11.1: grant staff (setup)');
select lives_ok($$ select public.grant_role('commission',
  (select comm_x from k), 'staff', (select st_y from k)) $$, '11.2: duplicate grant is a no-op (idempotent)');
reset role;
select is(
  (select count(*)::int from public.memberships
   where commission_id=(select comm_x from k) and principal_id=(select st_y from k) and role='staff'),
  1, '11.3: exactly one row after a duplicate grant (no duplicate)');

-- ============================================================================
-- §12 · the per-case ACL is untouched by the collapse (no role/memberships coupling).
-- ADR 0078 Stage B replaced case_access with case_access_grants (per-capability).
-- ============================================================================
select hasnt_table('public', 'case_access', '12.1: legacy case_access is RETIRED (Stage B hard cut)');
select has_table('public', 'case_access_grants', '12.1b: case_access_grants is its per-capability successor');
select hasnt_column('public', 'case_access_grants', 'role',
  '12.2: case_access_grants has NO role column (a per-case capability ACL, not a role table)');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema='public' and table_name='case_access_grants' and column_name='level'),
  0, '12.3: no `level` column — involvement is per-capability now (read_case_content, write_case_content, …)');

select * from finish();
rollback;
