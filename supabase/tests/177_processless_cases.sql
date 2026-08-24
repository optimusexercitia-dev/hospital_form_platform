-- processless_cases — Create a Case with NO process ("Sem processo").
-- Plan buzzing-wandering-hedgehog; migration 20260630000006_processless_cases.sql.
-- Mirrors 115_case_outcomes.sql + 151_case_patient.sql (begin/plan/flag-flips/
-- bootstrap + ctx/k temp tables).
--
-- Proves the two new SECURITY DEFINER WRITE RPCs + the editable offered-set:
--   * create_case by a staff_admin → template_version_id NULL, minted case_number, status
--     'not_started', ZERO case_phases.
--   * an OPTIONAL offered-outcome set (two same-commission non-archived → two
--     case_offered_outcomes rows); a cross-commission/archived outcome → HC030.
--   * patient_mode optional/none snapshot vs set_case_patient (check_violation
--     23514 when false).
--   * plain staff (non-coordinator) → 42501.
--   * processless_cases flag OFF → check_violation; cases_extras OFF: empty set
--     succeeds, non-empty raises.
--   * close_case on a zero-phase empty-offered case succeeds (HC031 0-phase pass,
--     HC028 not triggered); a non-empty offered set with no chosen outcome →
--     HC028, then set_case_outcome → closes.
--   * add_ad_hoc_phase on a process-less case succeeds; then close_case requires
--     it settled (HC031).
--   * set_case_offered_outcomes: replace works; plain staff → 42501; cross-
--     commission → HC030; terminal case → HC025; removing the currently-assigned
--     outcome → HC029; removing a non-assigned id → succeeds.
--   * RLS: a foreign-commission member cannot read the case's case_offered_outcomes;
--     a forged direct INSERT is denied by case_offered_outcomes_staff_admin_write.
--
-- All four required flags ON for the txn (hermetic; not dependent on migration order).

begin;
select plan(31);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'cases_extras', 'case_patient', 'processless_cases');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u
  from ctx;
grant select on k to authenticated;

-- Two non-archived outcomes in commission X, one in commission Y, one ARCHIVED in X.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table oc on commit drop as
  select (public.create_case_outcome((select comm_x from k), 'Óbito evitável', 'red', true, true)).id   as adverse_id,
         (public.create_case_outcome((select comm_x from k), 'Sem intercorrências', 'green', false, false)).id as plain_id;
grant select on oc to authenticated;
create temp table oc_arch on commit drop as
  select (public.create_case_outcome((select comm_x from k), 'Arquivado', 'amber', false, false)).id as arch_id;
grant select on oc_arch to authenticated;
-- Archive it (so the HC030 non-archived guard can reject it).
update public.case_outcomes set archived = true where id = (select arch_id from oc_arch);
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table oc_y on commit drop as
  select (public.create_case_outcome((select comm_y from k), 'Óbito Y', 'red', false, true)).id as oid_y;
grant select on oc_y to authenticated;
reset role;

-- =========================================================================
-- 1) create_case by a staff_admin → template_version_id NULL, minted number,
--    status 'not_started', ZERO case_phases.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case((select comm_x from k), 'Caso sem processo')).id as cid;
grant select on cse to authenticated;
reset role;

-- ADR 0096: cases were re-keyed template_id -> template_version_id. The point of
-- this assertion is unchanged — a process-less case is bound to NO process — so
-- it moves to the new column rather than being dropped.
select is(
  (select template_version_id from public.cases where id = (select cid from cse)),
  null::uuid,
  'create_case mints a case with template_version_id NULL (process-less)');
select ok(
  (select case_number from public.cases where id = (select cid from cse)) is not null,
  'create_case mints a case_number (the BEFORE-INSERT trigger fires for a null-template insert)');
select is(
  (select status from public.cases where id = (select cid from cse)),
  'not_started',
  'create_case lands the case at status nao_iniciado (column default)');
select is(
  (select count(*)::int from public.case_phases where case_id = (select cid from cse)),
  0,
  'create_case creates ZERO case_phases (ad-hoc phases grown later)');

-- =========================================================================
-- 2) With two same-commission non-archived outcomes → two case_offered_outcomes.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse2 on commit drop as
  select (public.create_case((select comm_x from k), 'Caso com desfechos', false,
            array[(select adverse_id from oc), (select plain_id from oc)])).id as cid;
grant select on cse2 to authenticated;
reset role;

select is(
  (select count(*)::int from public.case_offered_outcomes where case_id = (select cid from cse2)),
  2,
  'create_case with two same-commission non-archived outcomes writes two case_offered_outcomes rows');

-- =========================================================================
-- 3) A cross-commission (and an archived) outcome → HC030.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Cross-comm', false, array[%L]::uuid[]) $$,
         (select comm_x from k), (select oid_y from oc_y)),
  'HC030', null,
  'create_case rejects a cross-commission outcome (HC030)');
select throws_ok(
  format($$ select public.create_case(%L, 'Archived', false, array[%L]::uuid[]) $$,
         (select comm_x from k), (select arch_id from oc_arch)),
  'HC030', null,
  'create_case rejects an ARCHIVED outcome of the same commission (HC030)');
reset role;

-- =========================================================================
-- 4) patient_mode optional/none snapshot vs set_case_patient.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_phi on commit drop as
  select (public.create_case((select comm_x from k), 'Caso PHI', true)).id     as cid_on,
         (public.create_case((select comm_x from k), 'Caso sem PHI', false)).id as cid_off;
grant select on cse_phi to authenticated;
reset role;

select is(
  (select patient_mode from public.cases where id = (select cid_on from cse_phi)),
  'optional',
  -- ADR 0137 D1: create_case KEEPS its boolean argument (supabase/tests/357 SS1.6
  -- pins the signature verbatim) and MAPS it - true -> 'optional', never
  -- 'required'. A process-less case has no template version to carry a mode.
  'create_case(p_patient_enabled:=true) snapshots patient_mode = optional');
select is(
  (select has_patient from public.cases where id = (select cid_on from cse_phi)),
  false, 'a freshly-created PHI-capable case has has_patient = false (no identifiers yet)');

-- The coordinator can set PHI on a patient-collecting case.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_patient(%L, 'Paciente Teste', 'MRN-PL-1') $$,
         (select cid_on from cse_phi)),
  'set_case_patient succeeds on a patient-collecting process-less case');
reset role;
select is(
  (select has_patient from public.cases where id = (select cid_on from cse_phi)),
  true, 'set_case_patient flips has_patient = true on the process-less case');

-- patient_mode = 'none' ⇒ set_case_patient raises check_violation (23514).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_patient(%L, 'Nao', 'MRN-0') $$,
         (select cid_off from cse_phi)),
  '23514', null,
  'set_case_patient on a patient_mode=none process-less case raises check_violation (23514)');
reset role;

-- =========================================================================
-- 5) Plain staff (non-coordinator) calling create_case → 42501.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Staff caso') $$, (select comm_x from k)),
  '42501', null,
  'a plain staff (non-coordinator) cannot create_case (42501)');
reset role;

-- =========================================================================
-- 6) processless_cases flag OFF → check_violation; cases_extras OFF behaviour.
-- =========================================================================
update app.feature_flags set enabled = false where key = 'processless_cases';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case(%L, 'Flag off') $$, (select comm_x from k)),
  '23514', null,
  'processless_cases flag OFF ⇒ create_case raises check_violation (23514)');
reset role;
update app.feature_flags set enabled = true where key = 'processless_cases';

-- cases_extras OFF: an EMPTY offered set still creates fine (the extras gate only
-- fires when outcomes are supplied); a NON-EMPTY set raises check_violation.
update app.feature_flags set enabled = false where key = 'cases_extras';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_noextra on commit drop as
  select (public.create_case((select comm_x from k), 'Sem extras')).id as cid;
grant select on cse_noextra to authenticated;
select ok(
  (select cid from cse_noextra) is not null,
  'cases_extras OFF + empty outcomes ⇒ create_case still succeeds');
select throws_ok(
  format($$ select public.create_case(%L, 'Com extras off', false, array[%L]::uuid[]) $$,
         (select comm_x from k), (select adverse_id from oc)),
  '23514', null,
  'cases_extras OFF + a NON-EMPTY offered set ⇒ create_case raises check_violation (23514)');
reset role;
update app.feature_flags set enabled = true where key = 'cases_extras';

-- =========================================================================
-- 7) close_case on a zero-phase, empty-offered case → succeeds
--    (HC031 0-phase pass, HC028 not triggered).
-- =========================================================================
-- cse (test 1) is a zero-phase case with NO offered outcomes.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.close_case((select cid from cse))).status,
  'completed',
  'close_case on a zero-phase, empty-offered process-less case succeeds (HC031 pass + no HC028)');
reset role;

-- =========================================================================
-- 8) A non-empty offered set + no chosen outcome → close_case raises HC028;
--    after set_case_outcome → closes.
-- =========================================================================
-- cse2 (test 2) is a zero-phase case offering two outcomes, none chosen.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select cid from cse2)),
  'HC028', null,
  'close_case on an offered-set case with no chosen outcome → HC028');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_outcome((select cid from cse2), (select adverse_id from oc));
select is(
  (public.close_case((select cid from cse2))).status,
  'completed',
  'close_case succeeds once an offered outcome is chosen (HC028 cleared)');
reset role;

-- =========================================================================
-- 9) add_ad_hoc_phase on a process-less case → succeeds; then close_case
--    requires it settled (HC031).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_ph on commit drop as
  select (public.create_case((select comm_x from k), 'Caso fase avulsa')).id as cid;
grant select on cse_ph to authenticated;
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table adhoc on commit drop as
  select (public.add_ad_hoc_phase((select cid from cse_ph), (select form_u from k), 'Fase avulsa')).id as pid;
grant select on adhoc to authenticated;
reset role;

select ok(
  (select count(*)::int from public.case_phases where case_id = (select cid from cse_ph)) = 1,
  'add_ad_hoc_phase appends a phase to a process-less case');

-- An open ad-hoc phase blocks conclusion (HC031 unsettled-phases gate).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select cid from cse_ph)),
  'HC031', null,
  'close_case on a process-less case with an unsettled ad-hoc phase → HC031');
reset role;

-- Skip the phase, then close succeeds.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase((select pid from adhoc));
select is(
  (public.close_case((select cid from cse_ph))).status,
  'completed',
  'close_case succeeds once the ad-hoc phase is settled');
reset role;

-- =========================================================================
-- 10) set_case_offered_outcomes: replace works; plain staff → 42501;
--     cross-commission → HC030; terminal case → HC025.
-- =========================================================================
-- A fresh non-terminal process-less case offering ONE outcome.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_ed on commit drop as
  select (public.create_case((select comm_x from k), 'Caso editor', false,
            array[(select adverse_id from oc)])).id as cid;
grant select on cse_ed to authenticated;
reset role;

-- Replace the offered set with the OTHER (plain) outcome.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_offered_outcomes((select cid from cse_ed), array[(select plain_id from oc)]);
reset role;
select is(
  (select outcome_id from public.case_offered_outcomes where case_id = (select cid from cse_ed)),
  (select plain_id from oc),
  'set_case_offered_outcomes replaces the offered set (delete-then-insert)');

-- Plain staff → 42501.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_offered_outcomes(%L, array[%L]::uuid[]) $$,
         (select cid from cse_ed), (select plain_id from oc)),
  '42501', null,
  'set_case_offered_outcomes by a plain staff → 42501 (coordinator-gated)');
reset role;

-- Cross-commission outcome → HC030.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_offered_outcomes(%L, array[%L]::uuid[]) $$,
         (select cid from cse_ed), (select oid_y from oc_y)),
  'HC030', null,
  'set_case_offered_outcomes rejects a cross-commission outcome (HC030)');
reset role;

-- A terminal case → HC025. (cse2 was concluded in test 8.)
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_offered_outcomes(%L, array[%L]::uuid[]) $$,
         (select cid from cse2), (select plain_id from oc)),
  'HC025', null,
  'set_case_offered_outcomes on a terminal (concluido) case → HC025');
reset role;

-- =========================================================================
-- 11) Removing the currently-ASSIGNED outcome from the set → HC029; removing a
--     non-assigned id → succeeds.
-- =========================================================================
-- A case offering BOTH outcomes; assign the adverse one.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_asg on commit drop as
  select (public.create_case((select comm_x from k), 'Caso atribuído', false,
            array[(select adverse_id from oc), (select plain_id from oc)])).id as cid;
grant select on cse_asg to authenticated;
select public.set_case_outcome((select cid from cse_asg), (select adverse_id from oc));
reset role;

-- Dropping the ASSIGNED (adverse) outcome from the offered list → HC029.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_offered_outcomes(%L, array[%L]::uuid[]) $$,
         (select cid from cse_asg), (select plain_id from oc)),
  'HC029', null,
  'set_case_offered_outcomes refuses to drop the currently-assigned outcome (HC029)');
reset role;

-- Dropping the NON-assigned (plain) outcome, keeping the assigned one → succeeds.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_offered_outcomes(%L, array[%L]::uuid[]) $$,
         (select cid from cse_asg), (select adverse_id from oc)),
  'set_case_offered_outcomes can drop a NON-assigned outcome (keeping the assigned one)');
reset role;
select is(
  (select count(*)::int from public.case_offered_outcomes where case_id = (select cid from cse_asg)),
  1,
  'after dropping the non-assigned outcome only the assigned one remains offered');

-- =========================================================================
-- 12) RLS isolation on case_offered_outcomes.
-- =========================================================================
-- A foreign-commission member (staff of Y) cannot read X's offered rows.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_offered_outcomes where case_id = (select cid from cse2)),
  0,
  'RLS: a foreign-commission member reads ZERO of another case''s case_offered_outcomes');
reset role;

-- A foreign-commission member's forged direct INSERT is denied by the write policy.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.case_offered_outcomes (case_id, outcome_id) values (%L, %L) $$,
         (select cid from cse_ed), (select oid_y from oc_y)),
  '42501', null,
  'RLS: a forged direct INSERT into case_offered_outcomes is denied (case_offered_outcomes_staff_admin_write)');
reset role;

select * from finish();
rollback;
