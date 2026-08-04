-- Phase 16 (Standards Crosswalk & Readiness/Gap Engine v2) — Migration A schema
-- census. ADR 0093 (D2/D3/D4/D7 + Amendment 1 A1·2 + Amendment 2) + plan Wave 1.
-- Migration 20260903000800_accreditation_schema.sql.
--
-- Scope: SCHEMA structure only — tables, CHECK/unique/composite-FK, RLS
-- enabled + policy shape, grants (authenticated has NO write on any of the
-- five), audit + touch + guard triggers, the flag row. Asserted against the
-- live catalog (pg_class/pg_policy/pg_constraint/information_schema/
-- has_table_privilege) — never migration text (the standing "text is not
-- truth" rule). `app.artifact_belongs_to_commission` / `app.evidence_status_of`
-- (Migration B) and the RPCs/doors (Wave 2, pgTAP 280-284, incl. the
-- foreign-hospital_admin / cross-org readiness-door proofs) are OUT of scope
-- here by design — this file only proves the five tables the RPCs will sit on.
--
--   §0 — flag `accreditation` exists, ASSERTED not forced. Enabled — Phase
--        16 is PO-APPROVED and 20260904000100_enable_accreditation is the
--        gate-flip migration this whole test suite runs on top of (a fresh
--        `db reset` applies EVERY migration, so pgTAP only ever observes
--        FINAL state, never the transient "seeded OFF" moment Migration A
--        alone produced). This assertion originally read the OPPOSITE
--        value: Migration A's own insert deliberately used enabled=false
--        (the column DEFAULTs true — Amendment 2 A2·3), and 278 asserted
--        that discipline was followed AT THE TIME. That was a transient
--        truth about one migration's authoring, not a standing safety
--        property pgTAP can keep enforcing after the deliberate,
--        two-migration gate-flip (the FF-program lesson this phase's own
--        header comments cite) completed as designed — so this is the
--        CORRECT new truth, not a test weakened until green.
--   §A — the five tables exist.
--   §B — CHECK constraints: declared (pg_constraint) AND behaviorally enforced
--        (an invalid write is rejected) — frameworks.status,
--        standards.level (0/4 rejected, 1/2/3 the leveled domain),
--        evidence_links.artifact_kind (an 11th bogus kind rejected),
--        standard_assessments.status.
--   §C — uniques: the two PARTIAL uniques on frameworks (global key+version;
--        owned key — same key under two DIFFERENT owners is NOT a collision),
--        evidence_links' 4-tuple (incl. the DELIBERATE case/ethics_procedure
--        double-link NOT colliding), standard_assessments' pair,
--        standard_ownerships' pair, standards' (framework_id, code).
--   §D — the same-framework composite parent FK: a cross-framework parent is
--        rejected; a same-framework parent succeeds (positive control).
--   §E — RLS enabled (not forced, matching the platform-wide convention —
--        146/146 tables) + exactly one SELECT-only policy per table.
--   §F — grants: `authenticated` has SELECT and NOTHING else on any of the
--        five (posture (b) — every write is a Wave 2 DEFINER RPC).
--   §G — audit + touch + guard triggers attached.
--   §H — RLS row-visibility (assert ROWS READ, not the predicate's boolean
--        return — the ETH·E1 lesson): global framework visible to everyone;
--        an owned framework visible only to its commission; evidence_links /
--        standard_assessments member-scoped isolation between comm_x/comm_y.
--   §I — standard_ownerships: the guard trigger rejects a responsible
--        commission whose hospital does not match (check_violation), accepts
--        a matching one; a hospital member reads the row, a plain outsider
--        does not. (The foreign-hospital_admin / cross-org negative belongs
--        to Wave 2's hospital_readiness keystones, pgTAP 284, once a second
--        hospital_admin persona is a first-class fixture need — not
--        duplicated here.)

begin;

select plan(84);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'org_b')::uuid   as org_b,
         (v->>'hosp_b')::uuid  as hosp_b
  from ctx;
grant select on k to authenticated;

-- A clean non-member (authenticated, member of nothing) — mirrors 260_charters.sql.
create temp table o on commit drop as select gen_random_uuid() as outsider;
grant select on o to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', (select outsider from o),
         'authenticated', 'authenticated', (select outsider from o) || '@test', now(), now();
update public.profiles set full_name = 'Outsider 278', home_organization_id = (select org_b from k)
  where id = (select outsider from o);

-- A SECOND hospital (no commissions of its own) — needed ONLY so §I's guard-
-- trigger negative has a real, FK-valid, genuinely-mismatched hospital id.
create temp table h2 on commit drop as select gen_random_uuid() as hosp_c;
grant select on h2 to authenticated;
insert into public.hospitals (id, organization_id, name, slug)
  select hosp_c, (select org_b from k), 'Hosp 278', 'hosp-278-' || substr(hosp_c::text, 1, 8)
  from h2;

-- ===========================================================================
-- §0 · Flag — asserted, never forced.
-- ===========================================================================
select ok(app.feature_enabled('accreditation'),
  '0. flag accreditation is ON — Phase 16 is PO-APPROVED; 20260904000100_enable_accreditation is the gate-flip this suite runs on top of (see the header note: this replaces the pre-gate "seeded false" assertion, it does not weaken it)');
select is(
  (select enabled from app.feature_flags where key = 'accreditation'),
  true,
  '0b. app.feature_flags row for accreditation has enabled = true'
);

-- ===========================================================================
-- §A · Tables exist.
-- ===========================================================================
select has_table('public', 'accreditation_frameworks', 'A1. accreditation_frameworks exists');
select has_table('public', 'accreditation_standards', 'A2. accreditation_standards exists');
select has_table('public', 'evidence_links', 'A3. evidence_links exists');
select has_table('public', 'standard_assessments', 'A4. standard_assessments exists');
select has_table('public', 'standard_ownerships', 'A5. standard_ownerships exists');

-- ===========================================================================
-- §B · CHECK constraints — declared AND behaviorally enforced.
-- ===========================================================================
select ok(
  exists (select 1 from pg_constraint where conname = 'accreditation_frameworks_status_check'),
  'B1. accreditation_frameworks_status_check is declared'
);
select throws_ok(
  format($$ insert into public.accreditation_frameworks (key, name, version, status)
            values ('bogus', 'Bogus', '1', 'nope') $$),
  '23514', null, 'B2. frameworks.status rejects a value outside ativo|arquivado'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'accreditation_standards_level_check'),
  'B3. accreditation_standards_level_check is declared'
);
insert into public.accreditation_frameworks (id, key, name, version, status)
  values ('27800000-0000-0000-0000-00000000000f', '278-fw', '278 Framework', '1', 'ativo');
select throws_ok(
  format($$ insert into public.accreditation_standards (framework_id, code, title, level)
            values ('27800000-0000-0000-0000-00000000000f', 'S0', 'Zero', 0) $$),
  '23514', null, 'B4. standards.level rejects 0 (outside 1..3)'
);
select throws_ok(
  format($$ insert into public.accreditation_standards (framework_id, code, title, level)
            values ('27800000-0000-0000-0000-00000000000f', 'S4', 'Four', 4) $$),
  '23514', null, 'B5. standards.level rejects 4 (outside 1..3)'
);
select lives_ok(
  format($$ insert into public.accreditation_standards (id, framework_id, code, title, level)
            values ('27800000-0000-0000-0000-000000000001',
                    '27800000-0000-0000-0000-00000000000f', 'S1', 'Um', 1) $$),
  'B6. standards.level = 1 is accepted (in-range positive control)'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'evidence_links_artifact_kind_check'),
  'B7. evidence_links_artifact_kind_check is declared'
);
select throws_ok(
  format($$ insert into public.evidence_links (commission_id, standard_id, artifact_kind, artifact_id)
            values (%L, '27800000-0000-0000-0000-000000000001', 'safety_event', gen_random_uuid()) $$,
    (select comm_x from k)),
  '23514', null, 'B8. evidence_links.artifact_kind rejects a kind outside the 10-value list (safety_event declined, D4)'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'standard_assessments_status_check'),
  'B9. standard_assessments_status_check is declared'
);
select throws_ok(
  format($$ insert into public.standard_assessments (commission_id, standard_id, status)
            values (%L, '27800000-0000-0000-0000-000000000001', 'quase') $$,
    (select comm_x from k)),
  '23514', null, 'B10. standard_assessments.status rejects a value outside the 4-value CHECK'
);

-- ===========================================================================
-- §C · Uniques.
-- ===========================================================================
select ok(
  exists (select 1 from pg_indexes
    where indexname = 'accreditation_frameworks_global_key_version_uq'
      and indexdef ilike '%UNIQUE%' and indexdef ilike '%WHERE (owner_commission_id IS NULL)%'),
  'C1. the global (key, version) partial unique is declared exactly where owner IS NULL'
);
select throws_ok(
  format($$ insert into public.accreditation_frameworks (key, name, version, status)
            values ('278-fw', 'Dup', '1', 'ativo') $$),
  '23505', null, 'C2. a second GLOBAL framework with the same (key, version) collides'
);
select lives_ok(
  format($$ insert into public.accreditation_frameworks (key, name, version, status, owner_commission_id)
            values ('278-fw', 'Owned by X', '1', 'ativo', %L) $$, (select comm_x from k)),
  'C3. the SAME key/version under a commission owner does NOT collide with the global row (different unique)'
);
select throws_ok(
  format($$ insert into public.accreditation_frameworks (key, name, version, status, owner_commission_id)
            values ('278-fw', 'Owned by X again', '2', 'ativo', %L) $$, (select comm_x from k)),
  '23505', null, 'C4. a second framework owned by comm_x with the SAME key collides (owner, key partial unique — version irrelevant)'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'accreditation_standards_framework_code_uq'),
  'C5. accreditation_standards (framework_id, code) unique is declared'
);
select throws_ok(
  format($$ insert into public.accreditation_standards (framework_id, code, title)
            values ('27800000-0000-0000-0000-00000000000f', 'S1', 'Duplicate code') $$),
  '23505', null, 'C6. a duplicate (framework_id, code) collides'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'evidence_links_unique'),
  'C7. evidence_links (commission, standard, kind, artifact) unique is declared'
);
select lives_ok(
  format($$ insert into public.evidence_links (commission_id, standard_id, artifact_kind, artifact_id)
            values (%L, '27800000-0000-0000-0000-000000000001', 'case', '27800000-0000-0000-0000-0000000000ca') $$,
    (select comm_x from k)),
  'C8. the first case-kind link for this (commission, standard, artifact) succeeds'
);
select throws_ok(
  format($$ insert into public.evidence_links (commission_id, standard_id, artifact_kind, artifact_id)
            values (%L, '27800000-0000-0000-0000-000000000001', 'case', '27800000-0000-0000-0000-0000000000ca') $$,
    (select comm_x from k)),
  '23505', null, 'C9. a second identical (commission, standard, case, artifact) link collides'
);
select lives_ok(
  format($$ insert into public.evidence_links (commission_id, standard_id, artifact_kind, artifact_id)
            values (%L, '27800000-0000-0000-0000-000000000001', 'ethics_procedure', '27800000-0000-0000-0000-0000000000ca') $$,
    (select comm_x from k)),
  'C10. the SAME artifact uuid under ethics_procedure does NOT collide with its case link — deliberate double-link (D4/plan Wave 1)'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'standard_assessments_unique'),
  'C11. standard_assessments (commission, standard) unique is declared'
);
select lives_ok(
  format($$ insert into public.standard_assessments (commission_id, standard_id, status)
            values (%L, '27800000-0000-0000-0000-000000000001', 'parcial') $$, (select comm_x from k)),
  'C12. the first assessment for (comm_x, standard) succeeds'
);
select throws_ok(
  format($$ insert into public.standard_assessments (commission_id, standard_id, status)
            values (%L, '27800000-0000-0000-0000-000000000001', 'conforme') $$, (select comm_x from k)),
  '23505', null, 'C13. a second assessment row for the SAME (commission, standard) collides — re-assessment is an UPDATE, not a second row'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'standard_ownerships_unique'),
  'C14. standard_ownerships (hospital, standard) unique is declared'
);

-- ===========================================================================
-- §D · Same-framework composite parent FK.
-- ===========================================================================
insert into public.accreditation_frameworks (id, key, name, version, status)
  values ('27800000-0000-0000-0000-00000000000e', '278-fw-other', '278 Other Framework', '1', 'ativo');
insert into public.accreditation_standards (id, framework_id, code, title)
  values ('27800000-0000-0000-0000-000000000002', '27800000-0000-0000-0000-00000000000e', 'OTHER-1', 'Outro');
select throws_ok(
  format($$ insert into public.accreditation_standards (framework_id, parent_id, code, title)
            values ('27800000-0000-0000-0000-00000000000f', '27800000-0000-0000-0000-000000000002', 'S1A', 'Filho cruzado') $$),
  '23503', null, 'D1. a standard cannot point parent_id at a standard from a DIFFERENT framework'
);
select lives_ok(
  format($$ insert into public.accreditation_standards (framework_id, parent_id, code, title)
            values ('27800000-0000-0000-0000-00000000000f', '27800000-0000-0000-0000-000000000001', 'S1A', 'Filho mesmo framework') $$),
  'D2. a standard CAN point parent_id at a standard in the SAME framework (positive control)'
);

-- ===========================================================================
-- §E · RLS enabled (not forced — matches the platform-wide convention) +
-- exactly one SELECT-only policy per table.
-- ===========================================================================
select is((select relrowsecurity from pg_class where oid = 'public.accreditation_frameworks'::regclass),
  true, 'E1a. RLS enabled on accreditation_frameworks');
select is((select relforcerowsecurity from pg_class where oid = 'public.accreditation_frameworks'::regclass),
  false, 'E1b. RLS NOT forced (matches the 146/146-table platform convention — writes are DEFINER, owner postgres)');
select is((select relrowsecurity from pg_class where oid = 'public.accreditation_standards'::regclass),
  true, 'E2. RLS enabled on accreditation_standards');
select is((select relrowsecurity from pg_class where oid = 'public.evidence_links'::regclass),
  true, 'E3. RLS enabled on evidence_links');
select is((select relrowsecurity from pg_class where oid = 'public.standard_assessments'::regclass),
  true, 'E4. RLS enabled on standard_assessments');
select is((select relrowsecurity from pg_class where oid = 'public.standard_ownerships'::regclass),
  true, 'E5. RLS enabled on standard_ownerships');

select is((select count(*)::int from pg_policy where polrelid = 'public.accreditation_frameworks'::regclass),
  1, 'E6a. accreditation_frameworks has exactly one policy');
select is((select count(*)::int from pg_policy
    where polrelid = 'public.accreditation_frameworks'::regclass and polcmd <> 'r'),
  0, 'E6b. that policy is SELECT-only — no write policy (DEFINER write door, Wave 2)');

select is((select count(*)::int from pg_policy where polrelid = 'public.accreditation_standards'::regclass),
  1, 'E7a. accreditation_standards has exactly one policy');
select is((select count(*)::int from pg_policy
    where polrelid = 'public.accreditation_standards'::regclass and polcmd <> 'r'),
  0, 'E7b. that policy is SELECT-only');

select is((select count(*)::int from pg_policy where polrelid = 'public.evidence_links'::regclass),
  1, 'E8a. evidence_links has exactly one policy');
select is((select count(*)::int from pg_policy
    where polrelid = 'public.evidence_links'::regclass and polcmd <> 'r'),
  0, 'E8b. that policy is SELECT-only');

select is((select count(*)::int from pg_policy where polrelid = 'public.standard_assessments'::regclass),
  1, 'E9a. standard_assessments has exactly one policy');
select is((select count(*)::int from pg_policy
    where polrelid = 'public.standard_assessments'::regclass and polcmd <> 'r'),
  0, 'E9b. that policy is SELECT-only');

select is((select count(*)::int from pg_policy where polrelid = 'public.standard_ownerships'::regclass),
  1, 'E10a. standard_ownerships has exactly one policy');
select is((select count(*)::int from pg_policy
    where polrelid = 'public.standard_ownerships'::regclass and polcmd <> 'r'),
  0, 'E10b. that policy is SELECT-only');

-- ===========================================================================
-- §F · Grants — `authenticated` has SELECT and nothing else, on all five.
-- ===========================================================================
select ok(has_table_privilege('authenticated', 'public.accreditation_frameworks', 'SELECT'),
  'F1a. authenticated CAN select accreditation_frameworks');
select ok(not has_table_privilege('authenticated', 'public.accreditation_frameworks', 'INSERT'),
  'F1b. authenticated cannot INSERT accreditation_frameworks');
select ok(not has_table_privilege('authenticated', 'public.accreditation_frameworks', 'UPDATE'),
  'F1c. authenticated cannot UPDATE accreditation_frameworks');
select ok(not has_table_privilege('authenticated', 'public.accreditation_frameworks', 'DELETE'),
  'F1d. authenticated cannot DELETE accreditation_frameworks');

select ok(has_table_privilege('authenticated', 'public.accreditation_standards', 'SELECT'),
  'F2a. authenticated CAN select accreditation_standards');
select ok(not has_table_privilege('authenticated', 'public.accreditation_standards', 'INSERT'),
  'F2b. authenticated cannot write accreditation_standards (INSERT)');

select ok(has_table_privilege('authenticated', 'public.evidence_links', 'SELECT'),
  'F3a. authenticated CAN select evidence_links');
select ok(not has_table_privilege('authenticated', 'public.evidence_links', 'INSERT'),
  'F3b. authenticated cannot write evidence_links (INSERT) — link_evidence is a Wave 2 DEFINER RPC');
select ok(not has_table_privilege('authenticated', 'public.evidence_links', 'DELETE'),
  'F3c. authenticated cannot DELETE evidence_links directly — unlink_evidence is a Wave 2 DEFINER RPC');

select ok(has_table_privilege('authenticated', 'public.standard_assessments', 'SELECT'),
  'F4a. authenticated CAN select standard_assessments');
select ok(not has_table_privilege('authenticated', 'public.standard_assessments', 'UPDATE'),
  'F4b. authenticated cannot write standard_assessments (UPDATE) — set_standard_assessment is Wave 2 DEFINER');

select ok(has_table_privilege('authenticated', 'public.standard_ownerships', 'SELECT'),
  'F5a. authenticated CAN select standard_ownerships');
select ok(not has_table_privilege('authenticated', 'public.standard_ownerships', 'INSERT'),
  'F5b. authenticated cannot write standard_ownerships — set_standard_ownership is is_hospital_admin_of-only, Wave 2 DEFINER');

-- ===========================================================================
-- §G · Triggers attached.
-- ===========================================================================
select has_trigger('public', 'accreditation_frameworks', 'touch_accreditation_frameworks_updated_at', 'G1a');
select has_trigger('public', 'accreditation_frameworks', 'audit_accreditation_frameworks_trg', 'G1b');
select has_trigger('public', 'accreditation_standards', 'touch_accreditation_standards_updated_at', 'G2a');
select has_trigger('public', 'accreditation_standards', 'audit_accreditation_standards_trg', 'G2b');
select has_trigger('public', 'evidence_links', 'audit_evidence_links_trg', 'G3');
select has_trigger('public', 'standard_assessments', 'audit_standard_assessments_trg', 'G4');
select has_trigger('public', 'standard_ownerships', 'audit_standard_ownerships_trg', 'G5a');
select has_trigger('public', 'standard_ownerships', 'guard_standard_ownership_hospital_trg', 'G5b');

-- ===========================================================================
-- §H · RLS row-visibility (assert ROWS READ, not the predicate — ETH·E1
-- lesson). The '278-fw' global framework (owner NULL) + comm_x's owned clone
-- (also key '278-fw') already exist from §C.
-- ===========================================================================
select test_helpers.claims_for((select outsider from o), false);
set local role authenticated;
select is(
  (select count(*)::int from public.accreditation_frameworks
     where key = '278-fw' and owner_commission_id is null),
  1, 'H1. a plain outsider (member of nothing) still reads the GLOBAL pack'
);
select is(
  (select count(*)::int from public.accreditation_frameworks
     where key = '278-fw' and owner_commission_id = (select comm_x from k)),
  0, 'H2. that same outsider is denied comm_x''s OWNED clone (Amendment 1 A1·2 — licensed text must not leak cross-tenant)'
);
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.accreditation_frameworks
     where key = '278-fw' and owner_commission_id = (select comm_x from k)),
  1, 'H3. a comm_x member reads comm_x''s owned clone'
);
select is(
  (select count(*)::int from public.accreditation_standards where framework_id = '27800000-0000-0000-0000-00000000000f'),
  2, 'H4. a comm_x member reads the global framework''s standards (S1 + S1A — global pack, visible to all, not just comm_x)'
);
select is(
  (select count(*)::int from public.evidence_links where standard_id = '27800000-0000-0000-0000-000000000001'),
  2, 'H5. a comm_x member reads comm_x''s own evidence links (both the case and ethics_procedure link from §C)'
);
select is(
  (select count(*)::int from public.standard_assessments where standard_id = '27800000-0000-0000-0000-000000000001'),
  1, 'H6. a comm_x member reads comm_x''s own assessment'
);
reset role;

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.accreditation_frameworks
     where key = '278-fw' and owner_commission_id = (select comm_x from k)),
  0, 'H7. a FOREIGN commission (comm_y) member is denied comm_x''s owned clone'
);
select is(
  (select count(*)::int from public.evidence_links where standard_id = '27800000-0000-0000-0000-000000000001'),
  0, 'H8. that same foreign member reads NONE of comm_x''s evidence links'
);
select is(
  (select count(*)::int from public.standard_assessments where standard_id = '27800000-0000-0000-0000-000000000001'),
  0, 'H9. that same foreign member reads NONE of comm_x''s assessments'
);
select is(
  (select count(*)::int from public.accreditation_standards where framework_id = '27800000-0000-0000-0000-00000000000f'),
  2, 'H10. the global framework''s standards stay visible to the foreign member too (not commission-scoped)'
);
reset role;

-- ===========================================================================
-- §I · standard_ownerships: the guard trigger + hospital-scoped RLS.
-- ===========================================================================
select throws_ok(
  format($$ insert into public.standard_ownerships (hospital_id, standard_id, responsible_commission_id)
            values (%L, '27800000-0000-0000-0000-000000000001', %L) $$,
    (select hosp_c from h2), (select comm_x from k)),
  '23514', null,
  'I1. the guard trigger rejects responsible_commission_id (comm_x, hospital=hosp_b) under a MISMATCHED hospital_id (hosp_c) — check_violation'
);
select lives_ok(
  format($$ insert into public.standard_ownerships (hospital_id, standard_id, responsible_commission_id)
            values (%L, '27800000-0000-0000-0000-000000000001', %L) $$,
    (select hosp_b from k), (select comm_x from k)),
  'I2. the guard trigger accepts a MATCHING hospital_id/responsible_commission_id pair (positive control)'
);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.standard_ownerships where standard_id = '27800000-0000-0000-0000-000000000001'),
  1, 'I3. a member of a hospital''s commission (st_x ∈ comm_x ∈ hosp_b) reads the hospital''s ownership row'
);
reset role;

select test_helpers.claims_for((select outsider from o), false);
set local role authenticated;
select is(
  (select count(*)::int from public.standard_ownerships where standard_id = '27800000-0000-0000-0000-000000000001'),
  0, 'I4. a plain outsider (member of no commission in hosp_b) is denied the ownership row'
);
reset role;

select * from finish();
rollback;
