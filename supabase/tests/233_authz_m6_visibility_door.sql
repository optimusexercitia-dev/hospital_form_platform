-- =============================================================================
-- AUTHZ · M6 — `cases.visibility_policy`: the guarded door. ADR 0078 A1 / A27.
--
-- WHAT THIS PROVES. `visibility_policy` decides who reaches a case on the member
-- surface. Before this unit it was writable by raw PostgREST PATCH (no trigger, and
-- `cases_staff_admin_write` is FOR ALL to `authenticated`), and the write emitted no
-- audit row. Measured live before the fix, as chefe.ccih against the seeded ethics
-- case, watching non-excluded staff2.ccih: reach f → t → f, audit delta 0.
--
-- ⛔ THIS UNIT IS A **NARROWING** (raw PATCH → blocked), AND §7.7 IS THE WHOLE REVIEW:
-- a denial's danger is that it does not bind; a NARROWING's danger is that it binds TOO
-- MUCH — and a narrowing that denies EVERYONE passes its negative keystones by
-- construction. So every deny below is paired with a POSITIVE TWIN, and the population
-- proof (M6·7) requires reach to MOVE. A probe that reads the same on both sides of the
-- change is measuring the wrong thing (§7.10) — that invariance is the alarm.
--
-- ⭐⭐ THE FIXTURE IS THE HARD PART, AND IT IS WHY M6·4 EXISTS.
-- NO SEEDED PERSONA IS BOTH EXCLUDED AND AUTHORIZED. Measured over the whole CCIH
-- roster + orgadmin.a + platform:
--     staff1.ccih   excluded=t  staff_admin=f  comm_admin=f
--     staff4.ccih   excluded=t  staff_admin=f  comm_admin=f
--     chefe.ccih    excluded=f  staff_admin=t  comm_admin=f
--     orgadmin.a    excluded=f  staff_admin=f  comm_admin=t
-- The two excluded personas are plain `staff`. So an exclusion keystone written against
-- a seeded persona raises **HC0F5 (authority)** and NEVER HC0F1 — it would be GREEN
-- while asserting nothing about the exclusion gate. That is §7.1 trap #3 verbatim
-- (`Missing precondition`), the exact shape that made an M1 keystone vacuous, and review
-- did not catch it there — reverting the fix did. Hence: the excluded principal below is
-- MADE a staff_admin, and BOTH legs are asserted (PRE ⭐) before the door is ever called.
--
-- Authority-first ordering (HC0F5 before HC0F1) is the structural defence that makes
-- that trap LOUD rather than silent: a twin lacking the authority precondition now fails
-- on HC0F5 instead of being caught by a throws_ok aimed at HC0F1.
--
-- Falsifiability is NOT self-evident from a green run — proven separately, one function
-- at a time, by supabase/tests/mutation/m6-mutation-audit.sh. A test that cannot fail is
-- not evidence (§7.1).
-- =============================================================================
begin;
select plan(29);

update app.feature_flags set enabled = true
  where key in ('case_participants', 'audit_trail', 'case_access');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- ⭐ FLAG ASSERTIONS (§7.3 / ADR 0078 M4). The updates above are an ASSUMPTION until
-- asserted — and this stack is reset constantly, so a reading is not a fact until it is
-- pinned to the state being claimed about. `audit_trail` is load-bearing: app.audit_write
-- RETURNS EARLY when it is off, so M6·6 would measure the flag, not the door.
-- Only the `enabled` column is the flag; a flag's `description` is prose (§7.2 #1).
-- ---------------------------------------------------------------------------
select is(app.feature_enabled('audit_trail'), true,
  'FLAG: audit_trail is ON — else audit_write returns early and M6·6 measures the flag, not the door');
select is((select exists (select 1 from app.feature_flags where key = 'case_access')), false,
  'B4: the case_access flag is RETIRED — can_read_case* has a single path now');

-- ---------------------------------------------------------------------------
-- FIXTURE · one case in comm_x, explicitly explicit_grants_only.
-- st_x is its respondent_doctor **and** a staff_admin (see the header).
-- st_x2 is a plain, NON-excluded member — the reach probe.
-- sa_x is a clean coordinator — the positive twin.
-- ---------------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-0000000f6001', (select comm_x from k), 99600,
        (select sa_x from k), 'explicit_grants_only');

insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000f6101', (select org_x from k), 'professional',
        'professional_identity', 'Dr. Réu');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-0000000f6102', (select org_x from k), (select st_x from k), 'Dr. Réu');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000f6101', '00000000-0000-0000-0000-0000000f6102');
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000f6103', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);
insert into public.case_participants (id, case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000f6104', '00000000-0000-0000-0000-0000000f6001',
        '00000000-0000-0000-0000-0000000f6101', '00000000-0000-0000-0000-0000000f6103', true);

-- ⭐⭐ THE PRECONDITION. Without this row, M6·4 denies on HC0F5 (authority) and proves
-- NOTHING about the exclusion gate. No seeded persona has both legs — see the header.
insert into public.memberships (principal_id, commission_id, role)
values ((select st_x from k), (select comm_x from k), 'staff_admin')
on conflict do nothing;

-- ===========================================================================
-- PRE-FLIGHT — the fixture is load-bearing; assert it, never assume it.
-- ===========================================================================
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f6001', (select st_x from k)), true,
  'PRE ⭐ leg 1/2: st_x is EXCLUDED from the case (the deny has something to read)');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), true,
  'PRE ⭐ leg 2/2: st_x ALSO holds staff_admin — so M6·4 reaches the EXCLUSION gate instead of dying on authority (§7.1 trap #3)');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f6001', (select st_x2 from k)), false,
  'PRE: st_x2 is NOT excluded — the reach probe measures VISIBILITY, not a hard deny (the masked-fixture error that hid D1 on the first run)');
select is(app.is_staff_admin_of_for((select comm_x from k), (select sa_x from k)), true,
  'PRE: sa_x is a clean coordinator — the positive twin has authority');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f6001', (select sa_x from k)), false,
  'PRE: …and is NOT excluded');

-- ===========================================================================
-- M6·1 ⭐ THE KEYSTONE — D1 IS CLOSED. This is `UPDATE 1` before the fix.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ update public.cases set visibility_policy = 'commission_default'
       where id = '00000000-0000-0000-0000-0000000f6001' $$,
  '23514', null,
  'M6·1 ⭐ D1 CLOSED: a staff_admin''s raw PATCH of visibility_policy is BLOCKED (measured `UPDATE 1`, silent, before this unit)');
reset role;
select is((select visibility_policy from public.cases where id = '00000000-0000-0000-0000-0000000f6001'),
  'explicit_grants_only',
  'M6·1: …and the policy SURVIVES the attempt — the block is not cosmetic');

-- The guard fires on CHANGE, not on MENTION. `BEFORE UPDATE OF col` fires whenever the
-- column appears in the SET list, so without `is distinct from` a full-row PATCH carrying
-- an unchanged value would eat a spurious raise. This is the binds-too-much twin (§7.7).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ update public.cases set visibility_policy = 'explicit_grants_only', label = 'toque'
       where id = '00000000-0000-0000-0000-0000000f6001' $$,
  'M6·1 POSITIVE TWIN ⭐: a PATCH that MENTIONS visibility_policy unchanged still LIVES — the guard binds on change, not on mention');
reset role;

-- ===========================================================================
-- M6·2 — the door WORKS for coordination. §7.7: the positive twin IS the review.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'commission_default') $$,
  'M6·2 ⭐ POSITIVE TWIN: a clean coordinator CAN re-scope the case through the door (the narrowing did not close the legitimate path)');
reset role;
select is((select visibility_policy from public.cases where id = '00000000-0000-0000-0000-0000000f6001'),
  'commission_default',
  'M6·2: …and the write LANDED (a door that raises nothing but writes nothing is the same bug)');

-- restore for the arms below
select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'explicit_grants_only');

-- ===========================================================================
-- M6·3 — a non-coordinator is DENIED on AUTHORITY (HC0F5).
-- ===========================================================================
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'commission_default') $$,
  'HC0F5', null,
  'M6·3: a plain member cannot re-scope the case — DENIED on AUTHORITY (HC0F5)');
reset role;

-- ===========================================================================
-- M6·4 ⭐⭐ THE EXCLUDED COORDINATOR IS DENIED (HC0F1) — A27's headline, and the
-- reason the fixture above exists. The respondent must not re-open the visibility
-- of the case in which he is the accused. He holds staff_admin, so HC0F5 does NOT
-- fire — this measures the EXCLUSION gate and nothing else.
--
-- It is also the PARITY line: the RLS qual this DEFINER bypasses carries
-- `AND NOT is_case_excluded(...)`. Without it the door would be WIDER than the raw
-- PATCH it replaces — LOST=0 would hold while GAINED went to 1.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'commission_default') $$,
  'HC0F1', null,
  'M6·4 ⭐⭐ OVER-GRANT TWIN: the RESPONDENT — who IS a staff_admin — cannot widen the case in which he is accused (HC0F1, not HC0F5)');
reset role;
select is((select visibility_policy from public.cases where id = '00000000-0000-0000-0000-0000000f6001'),
  'explicit_grants_only',
  'M6·4: …and the case stays CLOSED to the member surface — the deny is durable');

-- ===========================================================================
-- M6·5 — an invalid value is rejected on VALIDATION (HC0F6), and validation runs
-- THIRD: a principal who fails authority must NOT learn the value was invalid.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'everyone_lol') $$,
  'HC0F6', null,
  'M6·5: an invalid policy is rejected (HC0F6) — distinct from the column CHECK''s 23514, so the door''s own gate is what is being measured');
select throws_ok(
  $$ select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', null) $$,
  'HC0F6', null,
  'M6·5: …and NULL is rejected too (a NOT NULL column + a null argument must not reach the update)');
reset role;

-- ORDER PROOF: a non-coordinator passing garbage gets HC0F5, never HC0F6.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'everyone_lol') $$,
  'HC0F5', null,
  'M6·5 ORDER ⭐: authority is checked BEFORE validation — a stranger passing garbage gets HC0F5, so a keystone cannot mistake the precondition for the gate (M1·4)');
reset role;

select throws_ok(
  $$ select public.set_case_visibility('00000000-0000-0000-0000-0000000f6099', 'commission_default') $$,
  'P0002', null,
  'M6·5: an unknown case raises P0002 (fail closed)');

-- ===========================================================================
-- M6·6 — D2 IS CLOSED: the write emits EXACTLY ONE audit row, and it is PHI-free.
-- Measured before this unit: audit delta = 0 across the same flip.
-- ===========================================================================
create temp table audit_before on commit drop as
  select count(*) as n from public.audit_log;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'commission_default');
reset role;

select is(
  (select count(*)::int from public.audit_log) - (select n::int from audit_before), 1,
  'M6·6 ⭐ D2 CLOSED: the visibility change emits EXACTLY ONE audit row (measured delta = 0 before this unit — Rule 11 hole)');

select is(
  (select action from public.audit_log order by seq desc limit 1),
  'case.visibility_changed',
  'M6·6: …and it is the right verb');

select is(
  (select (metadata->>'visibility_policy') || '|' || (metadata->>'previous_visibility_policy')
     from public.audit_log order by seq desc limit 1),
  'commission_default|explicit_grants_only',
  'M6·6: …and it records BOTH sides of the transition (an audit row that omits the old value cannot prove a widening)');

-- Rule 11: the trail records THAT and WHO, never payloads/PHI. The case label is
-- case content and must not appear in the metadata.
update public.cases set label = 'SEGREDO-PHI-CANARY' where id = '00000000-0000-0000-0000-0000000f6001';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'explicit_grants_only');
reset role;
select is(
  (select (metadata::text ~ 'SEGREDO-PHI-CANARY') from public.audit_log
     order by seq desc limit 1),
  false,
  'M6·6 ⭐ Rule 11: the audit metadata is PHI-free — case content does not leak into the trail');

-- ===========================================================================
-- M6·7 ⭐⭐ THE BEHAVIOURAL PROOF — member reach FOLLOWS the policy, through the door.
-- Not a policy-TEXT assertion: text is not truth (§7.2), and three independent text
-- sweeps on this program failed in the same direction (§7.9). This is the same
-- f → t → f the raw PATCH produced — the SAME widening, now only through the audited
-- door. The middle value MUST move, or the probe measures nothing (§7.10).
-- ===========================================================================
select is(app.can_reach_case_on_member_surface('00000000-0000-0000-0000-0000000f6001', (select st_x2 from k)), false,
  'M6·7 (1/3): explicit_grants_only ⇒ a plain member does NOT reach the case');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'commission_default');
reset role;
select is(app.can_reach_case_on_member_surface('00000000-0000-0000-0000-0000000f6001', (select st_x2 from k)), true,
  'M6·7 (2/3) ⭐: commission_default ⇒ the member DOES reach it — the reading MOVED, so the probe is measuring the column');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'explicit_grants_only');
reset role;
select is(app.can_reach_case_on_member_surface('00000000-0000-0000-0000-0000000f6001', (select st_x2 from k)), false,
  'M6·7 (3/3): …and back to explicit_grants_only ⇒ reach closes again (f → t → f, the exact D1 signature, now audited)');

-- The excluded respondent NEVER reaches it on either policy — the hard deny outranks
-- the member arm, and re-scoping must not hand him the row (ADR 0072 D2 / MAJOR-3).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_visibility('00000000-0000-0000-0000-0000000f6001', 'commission_default');
reset role;
select is(app.can_reach_case_on_member_surface('00000000-0000-0000-0000-0000000f6001', (select st_x from k)), false,
  'M6·7 ⭐: the EXCLUDED respondent does not reach the case even under commission_default — widening must not out-vote the hard deny');

-- ===========================================================================
-- M6·8 — the ACLs. A door is only the door if PUBLIC cannot call it (t19 guard).
-- ===========================================================================
select is(
  has_function_privilege('public', 'public.set_case_visibility(uuid, text)', 'execute'),
  false,
  'M6·8: PUBLIC cannot execute set_case_visibility (REVOKE precedes GRANT)');
select is(
  has_function_privilege('authenticated', 'public.set_case_visibility(uuid, text)', 'execute'),
  true,
  'M6·8: …and `authenticated` can — the door exists for its callers');

select * from finish();
rollback;
