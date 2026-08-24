-- =============================================================================
-- AUTHZ · M3 — defect ①: bare assignment must NOT confer patient identifiers.
-- ADR 0078 (confirmed defect ①, one of the THREE justifications for the program):
--   "can_write_case_content DOES filter ca.level='write'; the PHI door filters
--    nothing. So a grant deliberately issued read-only opens patient identifiers,
--    and a bare phase or narrative assignment does the same, unqualified."
-- Amends Rule 12: "ordinary case read and bare assignment no longer imply
-- patient-identifier read."
--
-- ⚠⚠ THIS IS A NARROWING, NOT A DENIAL. M1/M2 removed reach nobody should have
-- had; M3 removes reach people HAVE TODAY. So the POSITIVE TWIN is the whole
-- risk: a narrowing that denies EVERYONE passes the negative BY CONSTRUCTION.
-- The surviving PHI population is enumerated from the catalog below and each
-- member is proven to still read.
--
-- ⚠ CONTENT MUST BE UNAFFECTED. The assignee KEEPS can_read_case; only PHI goes.
-- Both directions are keystoned — conflating them is exactly what made M1's
-- keystones 33/34 vacuous.
-- =============================================================================

begin;
select plan(22);   -- ADR 0078 Stage B: pin FLIPPED (read grant ⇏ PHI) + dead flag-OFF branch removed

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid as admin, (v->>'sa_x')::uuid as sa_x,
         (v->>'st_x')::uuid as st_x, (v->>'st_x2')::uuid as st_x2,
         (v->>'sa_y')::uuid as sa_y, (v->>'comm_x')::uuid as comm_x,
         (v->>'form_u')::uuid as form_u, (v->>'ver_u')::uuid as ver_u,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'case_access', 'case_participants', 'case_patient', 'audit_trail');
update app.feature_flags set enabled = false where key in ('case_types', 'case_referrals');

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, patient_mode)
values ('00000000-0000-0000-0000-0000000a3001', (select comm_x from k), 96001, (select sa_x from k),
        'commission_default', 'optional');

-- The PHI itself, via the real coordinator door.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_participant_patient('00000000-0000-0000-0000-0000000a3001', null,
       'Paciente Alvo', 'MRN-M3-001');
reset role;

-- st_x2 = a PLAIN MEMBER whose ONLY reach is a NARRATIVE ASSIGNMENT.
insert into public.case_narrative_types (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000a3002', (select comm_x from k), 'Relato', 1);
insert into public.case_narratives
  (id, case_id, narrative_type_id, display_label, display_position, assigned_to)
values ('00000000-0000-0000-0000-0000000a3003', '00000000-0000-0000-0000-0000000a3001',
        '00000000-0000-0000-0000-0000000a3002', 'Relato', 1, (select st_x2 from k));

-- ===========================================================================
-- PRE-FLIGHT — the fixture must isolate the ARM UNDER TEST. If st_x2 held any
-- other PHI arm, the negative below would prove nothing.
-- ===========================================================================
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x2 from k)), false,
  'PRE ⭐: the assignee is NOT staff_admin — no coordinator arm to confound the test');
select is((select exists (select 1 from public.case_access_grants
           where case_id = '00000000-0000-0000-0000-0000000a3001' and principal_id = (select st_x2 from k))), false,
  'PRE ⭐: the assignee holds NO grant — the assignment arm is his ONLY reach');
select is((select exists (select 1 from app.feature_flags where key = 'case_access')), false,
  'PRE: the case_access flag is RETIRED (Stage B) — a single always-on path');
-- ⭐ ADR 0078 M4: assert the rest too, don't assume them. `case_patient` gates the
-- PHI writer this suite's whole fixture depends on; `case_referrals` OFF pins the
-- branch where the (LIVE) PQS referral arm cannot confound the assignee measurement.
select is(app.feature_enabled('case_patient'), true,
  'FLAG: case_patient is ON — else set_participant_patient rejects and the fixture is empty');
select is(app.feature_enabled('case_referrals'), false,
  'FLAG: case_referrals is OFF here — pins out the LIVE PQS referral-PHI arm so only the assignment arm is measured');
select is((select count(*)::int from public.patient_identifiers), 1,
  'PRE: the PHI exists — there is something to read');

-- ===========================================================================
-- M3 ⭐ THE NARROWING — bare assignment no longer confers PHI.
-- ===========================================================================
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a3001', (select st_x2 from k)), false,
  'M3 ⭐ defect ①: a BARE NARRATIVE ASSIGNEE cannot reach the PHI door (today: true)');

-- …asserted as ROWS READ under RLS, not as a predicate's return value (ADR 0072
-- delta 3 / ETH·E1). The RPC is the only door — direct SELECT is revoked.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select (public.get_case_patient('00000000-0000-0000-0000-0000000a3001')) is null), true,
  'M3 ⭐ RULE 12: …and the audited door returns NULL — he reads ZERO identifier rows');
reset role;

-- A PHASE assignment is the sibling arm — both go, or the fix is half-done.
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, assigned_to)
select '00000000-0000-0000-0000-0000000a3004', '00000000-0000-0000-0000-0000000a3001', 1,
       'Apuração', (select form_u from k), (select ver_u from k), (select st_x from k);
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'PRE ⭐: the phase assignee is NOT staff_admin either');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a3001', (select st_x from k)), false,
  'M3 ⭐ defect ①: a BARE PHASE ASSIGNEE cannot reach the PHI door (today: true)');

-- ===========================================================================
-- ⛔ CONTENT IS UNAFFECTED — the assignee KEEPS case read. Only PHI goes.
-- Without this, M3 is indistinguishable from "assignees lost the case".
-- ===========================================================================
select is(app.can_read_case('00000000-0000-0000-0000-0000000a3001', (select st_x2 from k)), true,
  'M3 ⭐ CONTENT INTACT: the narrative assignee STILL reads the case (assignment = content reach)');
select is(app.can_read_case('00000000-0000-0000-0000-0000000a3001', (select st_x from k)), true,
  'M3 ⭐ CONTENT INTACT: the phase assignee STILL reads the case');
select is(app.can_write_case_narrative('00000000-0000-0000-0000-0000000a3003', (select st_x2 from k)), true,
  'M3 CONTENT INTACT: the narrative assignee STILL writes his narrative (D10 assignment arm survives)');

-- ===========================================================================
-- ⛔ THE POSITIVE TWIN — MANDATORY, and the whole risk of a narrowing.
-- Population enumerated FROM THE CATALOG (flag ON): is_staff_admin_of_for OR an
-- unexpired case_access grant. Each must STILL read the PHI.
-- ===========================================================================
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a3001', (select sa_x from k)), true,
  'M3 POSITIVE TWIN ⭐: the COORDINATOR still reaches the PHI door');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select (public.get_case_patient('00000000-0000-0000-0000-0000000a3001'))->>'mrn'), 'MRN-M3-001',
  'M3 POSITIVE TWIN ⭐: …and actually READS the MRN through the audited door');
reset role;

-- ⭐ ADR 0078 STAGE B — DEFECT ①·2 CLOSED, and THIS is the pin that was left to flip.
-- The old pin asserted "a read grant STILL reaches PHI" and warned it was the deferred
-- half of defect ①. Stage B closes it: PHI is a per-column grant now, so a plain READ
-- (or WRITE) grant NO LONGER confers PHI. The flip is the visible landing.
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000a3001', (select sa_y from k), 'read', (select sa_x from k));
select is(app.can_read_case('00000000-0000-0000-0000-0000000a3001', (select sa_y from k)), true,
  'M3 POSITIVE TWIN ⭐: a read grantee STILL reaches case content (reach preserved)');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a3001', (select sa_y from k)), false,
  'M3 ⭐ DEFECT ①·2 FLIP: a plain READ grant NO LONGER confers PHI (was true under case_access.level)');

-- The NEW capability: an explicit read_standard_phi grant DOES confer PHI (per column,
-- not via write) — and the narrowing did not deny everyone.
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000a3001', (select sa_y from k), 'read',
       (select sa_x from k), null, null, true);
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000a3001', (select sa_y from k)), true,
  'M3 ⭐ NEW CAPABILITY: a manual_grant with read_standard_phi=true confers PHI');
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select (public.get_case_patient('00000000-0000-0000-0000-0000000a3001'))->>'mrn'), 'MRN-M3-001',
  'M3 POSITIVE TWIN ⭐: …and actually READS it through the audited door');
reset role;

-- ===========================================================================
-- ⛔ THE FLAG-OFF BRANCH IS GONE (ADR 0078 B4/D9). The old "case_access OFF" section
-- here tested the S5L legacy member arm — which conferred PATIENT IDENTIFIERS to every
-- member and which Stage B DELETES. There is no second body to prove any more: the
-- member arm confers read_case_deliberation ONLY (A15), never PHI, at every
-- visibility_policy. That invariant is owned + mutation-proven by 234/238, not re-pinned
-- here (M3's scope is the assignment arm).
-- ===========================================================================

-- ===========================================================================
-- STRUCTURAL — catalog facts, so a refactor cannot silently restore the arms.
--
-- ⚠ WEAKENED BY ADR 0078 A2 — READ BEFORE TRUSTING THESE TWO. `can_read_case_patient`
-- is now a thin projection of app._case_caps, so its body names no table at all and
-- these regexes pass almost by construction. They still guard THIS body (an arm
-- smuggled back in here would fire them), but **the risk has MOVED**: the bare
-- assignment arm could be re-added inside `_case_caps` conferring `read_standard_phi`,
-- and NO text regex can catch that — once every arm lives in one function, "which arm
-- confers which bit" is not text-separable.
-- ⇒ The load-bearing evidence for defect ① is now BEHAVIOURAL: tests 20-22 below, and
--   234's K5 (both legs: assignment KEEPS content, gains NO PHI), which is
--   MUTATION-PROVEN to go RED when the arm is reverted — a guarantee this regex never
--   had. Do not treat a green here as proof of defect ①.
-- ===========================================================================
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_read_case_patient'
             and p.prosrc ~ 'case_phases'), 0,
  'M3 STRUCTURAL ⭐: can_read_case_patient no longer references case_phases at all');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = 'can_read_case_patient'
             and p.prosrc ~ 'case_narratives'), 0,
  'M3 STRUCTURAL ⭐: …nor case_narratives — both bare-assignment arms are GONE');

-- ⛔ SCOPE FENCE: can_read_case KEEPS both assignment arms — assignment is content
-- reach (D10). If this ever hits 0, M3 over-reached into A2's territory.
-- ⛔ REPOINTED TO THE RESOLVER BY ADR 0078 A2. `can_read_case` is now a thin projection
-- of app._case_caps (A24·2), so its own body names no arm at all. The arms MOVED; they
-- were not removed. Behaviour is identical (392-cell A/B: LOST = 0, GAINED = 0) and
-- 234's K5 pins both legs with a mutation proof. The fence follows the mechanism.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'app' and p.proname = '_case_caps'
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'case_phases'
             and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'case_narratives'), 1,
  'M3 SCOPE FENCE ⭐ (A2): the resolver KEEPS the assignment arms — M3 narrowed PHI ONLY');

select * from finish();
rollback;
