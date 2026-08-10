-- =============================================================================
-- AUTHZ · Stage B — case_access → case_access_grants HARD CUT. ADR 0078 B1–B5.
--
-- WHAT THIS PROVES. The grant mechanism moved from a single `level` column to
-- per-capability columns. This is an INTENDED semantic change (defect ①·2 closure),
-- NOT an equivalence: a read/write grant NO LONGER confers PHI — PHI is conferred iff
-- the read_standard_phi column is set, and NEVER by write (A16 — disjoint chains).
--
-- ⛔ EVERY keystone is PAIRED (§7.7): a narrowing that denies everyone passes its
-- negative by construction, so each PHI-deny is twinned with the positive that must
-- STILL hold (content/write is preserved; PHI is grantable per-column). Falsifiability
-- is proven ONE ARM AT A TIME by supabase/tests/mutation/b-mutation-audit.sh — a test
-- that cannot fail is not evidence (§7.1).
--
-- ⭐ THE FIXTURE IS THE TRAP. Each principal is asserted to hold ONLY the arm under
-- test BEFORE the arm is measured; the PHI keystones set the patient through the real
-- door first, so a false "no PHI" cannot come from an empty patient fixture (§7.1 #3).
-- =============================================================================
begin;
select plan(33);

-- case_access is RETIRED (B4). The flags this suite needs are the ones that make the
-- PHI door and the attachment fence reachable — NOT case_access.
update app.feature_flags set enabled = true
  where key in ('case_patient', 'case_participants', 'cases_multi_phase',
                'meetings', 'attachments', 'case_narratives');

-- ⭐ B4 ASSERTION (§7.2 #1 / §7.3): the flag is GONE, not merely off. A reading is not
-- a fact until pinned to the state claimed. `feature_enabled` reads coalesce(...,false).
select is(app.feature_enabled('case_access'), false,
  'B4 ⭐: the case_access flag is RETIRED — feature_enabled defaults it to false');
select is((select exists (select 1 from app.feature_flags where key = 'case_access')), false,
  'B4 ⭐: the case_access flag ROW is deleted (not just disabled)');
select is(app.feature_enabled('case_patient'), true,
  'FLAG: case_patient ON — else the PHI door rejects and every PHI keystone is vacuous');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,      -- coordinator of comm_x
         (v->>'st_x')::uuid   as st_x,      -- plain member of comm_x
         (v->>'st_x2')::uuid  as st_x2,     -- plain member of comm_x
         (v->>'sa_y')::uuid   as sa_y,      -- foreign coordinator -> made grantee
         (v->>'st_y')::uuid   as st_y,      -- foreign staff -> made org_admin of org_x
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ── FIXTURE: one commission_default, PHI-bearing case; the patient set through the
--    real coordinator door so PHI reach is gated only by the capability. ──────────
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, patient_enabled)
values ('00000000-0000-0000-0000-0000000b1001', (select comm_x from k), 95001, (select sa_x from k),
        'commission_default', true);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_participant_patient('00000000-0000-0000-0000-0000000b1001', null, 'Paciente B1', 'MRN-B1-001');
reset role;

-- st_y is MADE an org_admin of org_x (for the B6 deadlock-exit arm). sa_y is a foreign
-- coordinator (no arm on comm_x) so a grant is his ONLY reach.
insert into public.memberships (principal_id, organization_id, role)
values ((select st_y from k), (select org_x from k), 'org_admin');

-- ===========================================================================
-- ⭐ PRE-FLIGHT — each principal holds ONLY the arm under test.
-- ===========================================================================
select is(app.has_case_capability('00000000-0000-0000-0000-0000000b1001', (select sa_y from k), 'read_case_content'), false,
  'PRE ⭐: sa_y (foreign coordinator) has NO reach on comm_x''s case before any grant');
select is(app.is_member_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: st_y (org_admin) is NOT a member of comm_x — the B6 arm cannot self-escalate');
select is(app.is_tenancy_admin_of_for((select comm_x from k), (select st_y from k)), true,
  'PRE ⭐: …but the org-admin arm DOES resolve for comm_x (the deadlock exit is genuinely his)');

-- ===========================================================================
-- K1 · DEFECT ①·2 FLIP — the headline. A read/write grant confers content/write but
-- NOT PHI; PHI is a per-column grant.
-- ===========================================================================
-- (a) a plain READ grant (grant_ca = direct row, so this tests the RESOLVER's reading
-- of the columns, not the door's membership gate — sa_y is a foreign coordinator).
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000b1001', (select sa_y from k), 'read');

select is(app.can_read_case('00000000-0000-0000-0000-0000000b1001', (select sa_y from k)), true,
  'K1a POSITIVE TWIN: a read grant STILL confers case content (reach preserved)');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000b1001', (select sa_y from k)), false,
  'K1b ⭐ DEFECT ①·2 FLIP: a plain READ grant NO LONGER confers PHI (was true under case_access.level)');

-- (b) the same grantee, now with read_standard_phi — the NEW per-column capability.
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000b1001', (select sa_y from k), 'read',
       null, null, null, true);

select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000b1001', (select sa_y from k)), true,
  'K1c ⭐ NEW CAPABILITY: a manual_grant with read_standard_phi=true DOES confer PHI');

-- (c) a WRITE grant (no PHI) — write must NOT confer PHI (A16, disjoint chains).
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000b1001', (select st_x from k), 'write');

select is(app.can_write_case_content('00000000-0000-0000-0000-0000000b1001', (select st_x from k)), true,
  'K1d POSITIVE TWIN: a write grant confers write_case_content');
select is(app.can_read_case('00000000-0000-0000-0000-0000000b1001', (select st_x from k)), true,
  'K1e: write ⇒ read content (lattice)');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000b1001', (select st_x from k)), false,
  'K1f ⭐ A16: a WRITE grant does NOT confer PHI — write and PHI are disjoint chains');

-- ===========================================================================
-- K2 · SOURCE UNREACHABILITY — only manual_grant is producible by any door.
-- ===========================================================================
select is((select bool_and(source = 'manual_grant') from public.case_access_grants),
  true, 'K2: every grant the doors produced carries source=manual_grant');
select is((select count(*)::int from public.case_access_grants
           where source in ('nsp_investigation', 'referral', 'break_glass')),
  0, 'K2 ⭐: the RESERVED sources are UNREACHABLE — no writer produces them');

-- ===========================================================================
-- K3 · DIRECT-DML EXPLOIT (BUG-SUP-002) — authenticated has no direct access,
-- independent of the RPC doors.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_access_grants), 0,
  'K3a ⭐: RLS returns ZERO rows to authenticated (a coordinator reads the roster only via list_case_access)');
select throws_ok(
  $$insert into public.case_access_grants (case_id, principal_id, read_case_content)
    values ('00000000-0000-0000-0000-0000000b1001', (select st_x2 from k), true)$$,
  '42501',
  null,
  'K3b ⭐: a direct INSERT by authenticated is DENIED (no INSERT privilege + no write policy) — only the DEFINER doors write');
reset role;
-- The direct UPDATE/DELETE exploit: authenticated cannot even see the rows to target,
-- and holds no UPDATE/DELETE privilege.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$update public.case_access_grants set read_standard_phi = true$$,
  '42501', null,
  'K3c ⭐: a direct UPDATE (self-escalate to PHI) by authenticated is DENIED');
reset role;

-- ===========================================================================
-- K4 · list_case_access PROJECTS THE CLEARANCE (max_confidentiality — omitted today).
-- The ceiling has no reachable write path (A19), so it is set here as postgres (the
-- only writer pre-pilot) to prove the door SURFACES it.
-- ===========================================================================
update public.case_access_grants set max_confidentiality = 'legal_privileged'
 where case_id = '00000000-0000-0000-0000-0000000b1001' and principal_id = (select st_x from k);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select max_confidentiality from public.list_case_access('00000000-0000-0000-0000-0000000b1001')
    where user_id = (select st_x from k)),
  'legal_privileged',
  'K4 ⭐: list_case_access PROJECTS max_confidentiality (the clearance, absent from the old shape)');
select is(
  (select read_standard_phi from public.list_case_access('00000000-0000-0000-0000-0000000b1001')
    where user_id = (select sa_y from k)),
  true,
  'K4b: list_case_access projects the PHI tier too');
reset role;

-- ===========================================================================
-- K5 · EXCLUSION (U1) preserved + B6 org-admin deadlock arm + grantee membership.
-- ===========================================================================
-- Make sa_x (coordinator) recused from the case — authority holds, so a failure is the
-- EXCLUSION (HC0F1), not authority (§7.1 structural defense).
insert into public.case_recusals (case_id, user_id, source, recused_by)
values ('00000000-0000-0000-0000-0000000b1001', (select sa_x from k), 'coordinator', (select sa_x from k));

select is(app.is_staff_admin_of_for((select comm_x from k), (select sa_x from k)), true,
  'PRE ⭐ (K5): the recused principal IS a coordinator — a failure below is exclusion, not authority');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-0000000b1001',
      (select st_x2 from k), 'read')$$,
  'HC0F1', null,
  'K5a ⭐ U1: a RECUSED coordinator cannot grant on the case she is recused from (HC0F1)');
select throws_ok(
  $$select public.revoke_case_access('00000000-0000-0000-0000-0000000b1001', (select st_x from k))$$,
  'HC0F1', null,
  'K5b U1: …nor revoke on that case');
reset role;

-- B6: the org_admin (NOT a member) is the deadlock exit — may grant to a member.
select test_helpers.claims_for((select st_y from k), false, 'org_admin');
set local role authenticated;
select lives_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-0000000b1001', (select st_x2 from k), 'read')$$,
  'K5c ⭐ B6: the org-admin deadlock arm CAN grant to a commission member');
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-0000000b1001', (select sa_y from k), 'read')$$,
  'HC021', null,
  'K5d: …but the grantee must be a commission member (sa_y is foreign) — HC021');
reset role;

select is(
  (select reason_code from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-0000000b1001' and principal_id = (select st_x2 from k)),
  'org_admin_deadlock_exit',
  'K5e: the B6 grant is stamped org_admin_deadlock_exit (a real governance signal)');

-- ===========================================================================
-- K6 · NO PHI INFERRED FROM INVOLVEMENT LEVEL (B5). A read/write grant stores
-- read_standard_phi=false — PHI is never inferred from the level (the same translation
-- the B5 seed + data migration use). (The bootstrap truncates cases → cascades away the
-- committed seed grants, so this asserts the invariant on a real grant, not the seed.)
-- ===========================================================================
select is(
  (select read_standard_phi from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-0000000b1001'
      and principal_id = (select st_x from k) and write_case_content),
  false,
  'K6 ⭐ B5: a WRITE grant stores read_standard_phi=false — no PHI inferred from the involvement level');

-- ===========================================================================
-- K7 · COORDINATOR BOOTSTRAP (D5·6) — may ISSUE read_restricted_phi WITHOUT holding it.
-- ===========================================================================
-- Lift sa_x's recusal so she can grant again.
update public.case_recusals set lifted_at = now(), lifted_by = (select sa_x from k)
 where case_id = '00000000-0000-0000-0000-0000000b1001' and user_id = (select sa_x from k);

select is(app.has_case_capability('00000000-0000-0000-0000-0000000b1001', (select sa_x from k), 'read_restricted_phi'),
  false, 'PRE ⭐ (K7): the coordinator does NOT hold read_restricted_phi (A24·7 excludes it)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-0000000b1001',
      (select st_x2 from k), 'read', null, null, false, true)$$,
  'K7a ⭐ D5·6: the coordinator ISSUES read_restricted_phi she does not hold (the bootstrap)');
reset role;

select is(app.has_case_capability('00000000-0000-0000-0000-0000000b1001', (select st_x2 from k), 'read_restricted_phi'),
  true, 'K7b: the grantee now holds read_restricted_phi');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000b1001', (select st_x2 from k), 'read_standard_phi'),
  true, 'K7c: …and read_standard_phi by lattice (restricted ⇒ standard)');

-- ===========================================================================
-- K8 · B3 FENCE — reclassify_attachment REJECTS the two ceiling labels pre-pilot.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.reclassify_attachment(gen_random_uuid(), 'phi', 'legal_privileged')$$,
  '23514', null,
  'K8a ⭐ B3: reclassify_attachment REJECTS legal_privileged (the data-destroying trap is fenced)');
select throws_ok(
  $$select public.reclassify_attachment(gen_random_uuid(), 'phi', 'credentialing_sensitive')$$,
  '23514', null,
  'K8b ⭐ B3: …and credentialing_sensitive');
reset role;

-- ===========================================================================
-- K9 · ACTIVE PARTIAL-UNIQUE (lead D1) — NULLS NOT DISTINCT prevents a duplicate
-- active manual grant despite source_entity_id IS NULL. Direct inserts as postgres
-- (the index, not the door's upsert, is under test).
-- ===========================================================================
-- sa_x is a real profile with no active grant on b1001 (he is the grantor here).
insert into public.case_access_grants (case_id, principal_id, source, read_case_content)
values ('00000000-0000-0000-0000-0000000b1001', (select sa_x from k), 'manual_grant', true);
select throws_ok(
  $$insert into public.case_access_grants (case_id, principal_id, source, read_case_content)
    values ('00000000-0000-0000-0000-0000000b1001', (select sa_x from k), 'manual_grant', true)$$,
  '23505', null,
  'K9 ⭐ D1: a SECOND active manual grant for the same (case, principal) raises unique_violation (NULLS NOT DISTINCT)');

select * from finish();
rollback;
