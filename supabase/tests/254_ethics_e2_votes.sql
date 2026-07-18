-- =============================================================================
-- ETH·E2 (ADR 0073 D3/D4) — BE-3 gate: decisions/votes RLS + the cast_case_vote
--   recusal/respondent vote-exclusion (the E1-consumption keystone).
--
-- ⛔ NON-VACUITY (M6/233 + the no-regression-twin trap): the recused voter AND the
-- respondent voter are BOTH authority-passing commission members — so their HC0J5 is
-- reached ONLY through the exclusion branch, never the authority branch (a non-member
-- gets 42501, a DISTINCT code). The companion mutation audit
-- (supabase/tests/mutation/be3-cast-vote-mutation-audit.sh) neutralizes the exclusion
-- inside cast_case_vote and REQUIRES each HC0J5 keystone (and, via drop-constraint, the
-- HC0J4 keystone) to go RED while the authority keystone stays GREEN.
--
-- Proven on a FRESH reset (pgtap-needs-fresh-reset). Setup rows are inserted as superuser
-- (RLS-bypassing); the vote-door + visibility are asserted under each persona.
--
-- Personas (bootstrap): admin, sa_x (staff_admin of comm_x — a MEMBER), st_x / st_x2
-- (plain members of comm_x), sa_y (staff_admin of comm_y — foreign commission, NOT a
-- member of comm_x). st_x becomes the RESPONDENT; st_x2 becomes RECUSED — both stay
-- comm_x members (authority-passing).
-- =============================================================================

begin;
select plan(25);

-- ethics flag ON so cast_case_vote passes its assert; audit_trail ON for the audit row.
update app.feature_flags set enabled = true where key in ('ethics', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Fixture (superuser): an explicit_grants_only ETHICS case (marked by its
-- ethics_case_details row) with a decision + its 1:1 details; and a
-- commission_default NON-ethics case + decision (for the ethics-typed gate).
-- ---------------------------------------------------------------------------
reset role;

insert into public.cases
  (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values
  ('00000000-0000-0000-0000-0000000e2001', (select comm_x from k), 92101, (select sa_x from k),
   'explicit_grants_only', 'ethics_investigation'),
  ('00000000-0000-0000-0000-0000000e2002', (select comm_x from k), 92102, (select sa_x from k),
   'commission_default', 'non_phi_internal');

-- Mark the first case ethics-typed.
insert into public.ethics_case_details (case_id) values ('00000000-0000-0000-0000-0000000e2001');

-- A decision on each case.
insert into public.case_decisions (id, case_id, decision_type, summary_md, status)
values
  ('00000000-0000-0000-0000-0000000e2050', '00000000-0000-0000-0000-0000000e2001',
   'ethics_ruling', 'Proposta de decisão.', 'voted'),
  ('00000000-0000-0000-0000-0000000e2051', '00000000-0000-0000-0000-0000000e2002',
   'mm_ruling', 'Decisão de caso comum.', 'voted');

-- A sanction type (org_x) + the 1:1 decision details (denormalized case_id).
insert into public.ethics_sanction_types (id, organization_id, key, display_name)
values ('00000000-0000-0000-0000-0000000e2060', (select org_x from k), 'censura_publica', 'Censura pública');
insert into public.ethics_decision_details (decision_id, case_id, sanction_type_id)
values ('00000000-0000-0000-0000-0000000e2050', '00000000-0000-0000-0000-0000000e2001',
        '00000000-0000-0000-0000-0000000e2060');

-- ===========================================================================
-- Block A — SELECT boundary (st_x / st_x2 still CLEAN members here).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_decisions
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'case_decisions: the coordinator reads the decision');
select is((select count(*)::int from public.ethics_decision_details
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_decision_details: the coordinator reads the details (denormalized case_id)');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_decisions
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'case_decisions: a foreign-commission user reads ZERO rows');
select is((select count(*)::int from public.ethics_decision_details
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_decision_details: a foreign-commission user reads ZERO rows');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_decisions
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'case_decisions: a non-granted member of the explicit_grants_only case reads ZERO rows');
reset role;

-- POS granted member: grant st_x2 read, assert he reads the decision.
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000e2001', (select st_x2 from k),
                             'read', (select sa_x from k));
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_decisions
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'case_decisions: a case grantee reads the decision');
reset role;

-- ===========================================================================
-- Block B — a clean member casts a successful vote; then set up the exclusions.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2050', 'approve', 'de acordo') $$,
  'cast_case_vote: an eligible member casts a vote');
reset role;
select is((select count(*)::int from public.case_votes
           where decision_id = '00000000-0000-0000-0000-0000000e2050'), 1,
  'cast_case_vote: the vote row persisted');

-- Respondent fixture: st_x becomes respondent_doctor of the ethics case (base-table
-- resolution: case_participants → respondent_doctor role → professional_participants →
-- professional_profiles.user_id = st_x). st_x stays a comm_x member (authority-passing).
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000e2101', (select org_x from k), 'professional',
        'professional_identity', 'Dr. Réu');
insert into public.professional_profiles (id, organization_id, user_id, full_name, link_state)
values ('00000000-0000-0000-0000-0000000e2102', (select org_x from k), (select st_x from k),
        'Dr. Réu', 'linked');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000e2101', '00000000-0000-0000-0000-0000000e2102');
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000e2103', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);
insert into public.case_participants (case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000e2001', '00000000-0000-0000-0000-0000000e2101',
        '00000000-0000-0000-0000-0000000e2103', true);

-- Recuse st_x2 (he holds a read grant from Block A — the deny must beat the grant).
insert into public.case_recusals (case_id, user_id, source, reason_md)
values ('00000000-0000-0000-0000-0000000e2001', (select st_x2 from k), 'coordinator', 'conflito');

-- Structural double-lock (E1 can_read_case): the excluded voters read ZERO decisions.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_decisions
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'double-lock: the respondent reads ZERO case_decisions (E1 can_read_case denies the case)');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_decisions
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'double-lock: the recused member reads ZERO case_decisions (deny beats the read grant)');
reset role;

-- ===========================================================================
-- Block C — the vote-exclusion keystones (the mutation-audit targets).
-- ===========================================================================
-- ⭐ st_x is an authority-passing member AND the respondent → the exclusion branch,
-- not the authority branch, refuses him. Assert the SPECIFIC HC0J5.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2050', 'approve') $$,
  'HC0J5', null,
  'cast_case_vote: the respondent member is refused with HC0J5');
reset role;

-- ⭐ st_x2 is an authority-passing member AND recused → HC0J5 (not 42501).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2050', 'reject') $$,
  'HC0J5', null,
  'cast_case_vote: the recused member is refused with HC0J5');
reset role;

-- ⭐ AUTHORITY keystone (stays GREEN under the exclusion mutation): a non-member gets a
-- DISTINCT code (42501), never HC0J5 — proving authority and exclusion are separable.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2050', 'approve') $$,
  '42501', null,
  'cast_case_vote: a non-member is refused with 42501 not HC0J5');
reset role;

-- ⭐ HC0J4 keystone (mutation-audited by dropping the unique): a second vote by the same
-- member is refused.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2050', 'reject') $$,
  'HC0J4', null,
  'cast_case_vote: a duplicate vote is refused with HC0J4');
-- value CHECK (a valid member, bad value → check_violation BEFORE the unique).
select throws_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2050', 'bogus') $$,
  '23514', null,
  'cast_case_vote: an out-of-vocabulary vote value is rejected (check)');
-- a non-existent decision → P0002 (before authority — no oracle beyond existence).
select throws_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2fff', 'approve') $$,
  'P0002', null,
  'cast_case_vote: a non-existent decision raises P0002');
-- a decision on a NON-ethics case → HC0J0 (the ethics-typed gate, before authority).
select throws_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2051', 'approve') $$,
  'HC0J0', null,
  'cast_case_vote: a decision on a non-ethics case is refused with HC0J0');
reset role;

-- ===========================================================================
-- Block D — app.eligible_voters excludes recused + respondent, includes a clean member.
-- ===========================================================================
select is((select count(*)::int from app.eligible_voters('00000000-0000-0000-0000-0000000e2001')
           where eligible_voters = (select sa_x from k)), 1,
  'eligible_voters: a clean member (sa_x) is eligible');
select is((select count(*)::int from app.eligible_voters('00000000-0000-0000-0000-0000000e2001')
           where eligible_voters = (select st_x from k)), 0,
  'eligible_voters: the respondent is excluded');
select is((select count(*)::int from app.eligible_voters('00000000-0000-0000-0000-0000000e2001')
           where eligible_voters = (select st_x2 from k)), 0,
  'eligible_voters: the recused member is excluded');

-- ===========================================================================
-- Block E — audit (Rule 11): the successful vote emitted exactly one PHI-free row.
-- ===========================================================================
select is((select count(*)::int from public.audit_log
           where action = 'case.vote_cast' and entity_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'audit: the cast vote emitted exactly one case.vote_cast row');
select ok(
  not exists (select 1 from public.audit_log
              where action = 'case.vote_cast' and metadata::text ilike '%de acordo%'),
  'audit (Rule 11): the vote row carries NO rationale/free-text payload');

-- ===========================================================================
-- Block F — case_votes SELECT boundary.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_votes
           where decision_id = '00000000-0000-0000-0000-0000000e2050'), 1,
  'case_votes: the coordinator reads the vote row');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_votes
           where decision_id = '00000000-0000-0000-0000-0000000e2050'), 0,
  'case_votes: a foreign-commission user reads ZERO rows');
reset role;

-- ===========================================================================
-- Block G — flag-OFF fallback: with ethics OFF, cast_case_vote raises HC000.
-- ===========================================================================
update app.feature_flags set enabled = false where key = 'ethics';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.cast_case_vote('00000000-0000-0000-0000-0000000e2050', 'abstain') $$,
  'HC000', null,
  'flag-OFF: cast_case_vote raises HC000 when the ethics flag is off');
reset role;

select * from finish();
rollback;
