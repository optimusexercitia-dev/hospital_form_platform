-- Multi-phase cases (Phase 7): the migration family 20260613090004-090007.
-- Covers case-number minting (per-commission, independent across commissions),
-- the template-slot recommend_when validation (P0016/P0017), the snapshot
-- (pinned versions + P0017), the sequential/skip/state guards (P0018/P0019/
-- P0020/P0021/P0022), the submit trigger (ativa -> concluida) and recompute, the
-- responses unique indexes, the terminal-state guards, and THE PHASE-7
-- INVARIANT: case_phase_answer_map returns '{}' for an in-progress source phase
-- and the populated map only once submitted. The cases RPCs are feature-flagged
-- OFF by default, so this file flips cases_multi_phase ON inside its rolled-back
-- transaction. RPCs are mostly security-invoker, so we act as the relevant
-- persona (authenticated) for each call; assertions reset to superuser to read.

begin;
select plan(35);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- The features are dark by default; enable them for the duration of this txn.
-- cases_extras is needed for the outcome RPCs exercised by the D3 conclude gate
-- (create_case_outcome / set_process_outcomes / set_case_outcome).
update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');
-- This file asserts the PRE-Case-Access-Control behavior — the coordinator-only
-- get_case_detail gate (test "leaks nothing to a non-staff_admin") and the
-- assignee-only phase fill via the original member-read RLS. With case_access ON,
-- get_case_detail re-gates to can_read_case (a phase assignee may now read) and the
-- invoker phase reads tighten. Keep the flag OFF here; the re-gated behavior +
-- submitted-only preservation are covered by 144_case_access. (ADR 0033 Consequences.)
update app.feature_flags set enabled = false where key = 'case_access';

-- Convenience accessors.
create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u,
         (v->>'ver_u')::uuid   as ver_u,
         (v->>'item_mc')::uuid as item_mc,
         (v->>'sec_u')::uuid   as sec_u,
         (v->>'form_y')::uuid  as form_y
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- 0) The feature gate: an RPC raises when the flag is OFF.
-- =========================================================================
update app.feature_flags set enabled = false where key = 'cases_multi_phase';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_process_template(%L,'X',null) $$, (select comm_x from k)),
  '23514',
  null,
  'cases RPCs are gated by the cases_multi_phase flag (raises when OFF)'
);
reset role;
update app.feature_flags set enabled = true where key = 'cases_multi_phase';

-- =========================================================================
-- Build a 2-phase template in commission X (both bound to form_u), phase 2
-- carrying a recommend_when over phase 1's u_q1.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Óbito M&M', null)).id as tid;
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 1');
select public.add_template_phase(
  (select tid from tpl), (select form_u from k), 'Fase 2',
  jsonb_build_object('from_phase',1,'question_key','u_q1','op','equals','value','Sim'));
reset role;

-- ---- 1) recommend_when referencing a NON-EARLIER phase is rejected (P0016) --
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_template_phase(%L,%L,'Bad',
            jsonb_build_object('from_phase',5,'question_key','u_q1','op','equals','value','Sim')) $$,
          (select tid from tpl), (select form_u from k)),
  'HC016',
  null,
  'add_template_phase rejects a recommend_when whose from_phase is not earlier (P0016)'
);
reset role;

-- ---- 2) recommend_when referencing an ABSENT key is rejected (P0016) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_template_phase(%L,%L,'Bad2',
            jsonb_build_object('from_phase',1,'question_key','nope','op','equals','value','Sim')) $$,
          (select tid from tpl), (select form_u from k)),
  'HC016',
  null,
  'add_template_phase rejects a recommend_when referencing an absent question_key (P0016)'
);
reset role;

-- ---- 3) publish the template ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.publish_process_template((select tid from tpl))).status,
  'active',
  'publish_process_template flips draft -> active'
);
reset role;

-- =========================================================================
-- create_case_from_template: snapshot + minting.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso A')).id as cid;
reset role;
grant select on cse to authenticated;

-- ---- 4) case_number is 1 (first case in commission X) ----
select is(
  (select case_number from public.cases where id = (select cid from cse)),
  1,
  'first case in a commission mints case_number = 1'
);

-- ---- 5) two pendente phases were materialized with PINNED versions ----
select is(
  (select count(*)::int from public.case_phases
   where case_id = (select cid from cse) and status = 'pendente'
     and form_version_id is not null),
  2,
  'snapshot materializes both phases as pendente with a pinned form_version_id'
);

-- ---- 6) the pinned version is form_u's published version ----
select is(
  (select distinct form_version_id from public.case_phases
   where case_id = (select cid from cse)),
  (select ver_u from k),
  'pinned form_version_id is the form''s currently-published version'
);

-- ---- 7) a SECOND case in commission X mints case_number = 2 ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.create_case_from_template((select tid from tpl), 'Caso B')).case_number,
  2,
  'the next case in the same commission mints case_number = 2 (per-commission counter)'
);
reset role;

-- ---- 8) a case in commission Y starts again at 1 (independent counter) ----
-- Build a minimal 1-phase template in Y bound to form_y (published in bootstrap).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table tpl_y on commit drop as
  select (public.create_process_template((select comm_y from k), 'Y proc', null)).id as tid;
reset role;
grant select on tpl_y to authenticated;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl_y), (select form_y from k), 'Y F1');
select public.publish_process_template((select tid from tpl_y));
select is(
  (public.create_case_from_template((select tid from tpl_y), 'Y caso')).case_number,
  1,
  'case numbering is per-commission: commission Y starts at 1 independently'
);
reset role;

-- =========================================================================
-- activate_phase: guards.
-- =========================================================================
create temp table cp on commit drop as
  select id, position from public.case_phases where case_id = (select cid from cse);
grant select on cp to authenticated;

-- ---- 9) PARALLEL activation + BLOCKER enforcement (D1/D4) ----
-- The sequential-unlock guard is GONE: a phase with empty blocks activates
-- regardless of earlier phases (parallel). A phase that LISTS a blocker is HC018
-- until that blocker settles — satisfied by EITHER concluida OR nao_necessaria
-- (both D4 satisfiers). Built on a SEPARATE template/case so `cse`'s linear flow
-- (tests 10-24) is undisturbed. This is a self-contained sub-scenario (5 asserts).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table btpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Blockers 90', null)).id as tid;
reset role;
grant select on btpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from btpl), (select form_u from k), 'B1');
-- B2 blocks [1]; B3 blocks [2].
select public.add_template_phase((select tid from btpl), (select form_u from k), 'B2', null, null, array[1]);
select public.add_template_phase((select tid from btpl), (select form_u from k), 'B3', null, null, array[2]);
select public.publish_process_template((select tid from btpl));
reset role;

-- Case A: tests parallel activation + D4-A (concluida unblocks).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table bcse on commit drop as
  select (public.create_case_from_template((select tid from btpl), 'Caso Blocker A')).id as cid;
reset role;
grant select on bcse to authenticated;
create temp table bcp on commit drop as
  select id, position from public.case_phases where case_id = (select cid from bcse);
grant select on bcp to authenticated;

-- (9a) B2 is BLOCKED while B1 (its blocker) is pendente.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.activate_phase(%L,%L) $$,
          (select id from bcp where position = 2), (select st_x from k)),
  'HC018',
  null,
  'activate_phase rejects a phase whose blocker is unsettled (HC018 via blocks)'
);
reset role;

-- (9b) B1 (empty blocks) activates freely — parallel, no strict-sequential guard.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.activate_phase((select id from bcp where position = 1), (select st_x from k))).status,
  'ativa',
  'a phase with empty blocks activates freely (parallel; sequential guard removed)'
);
reset role;

-- (9c) Settle B1 by CONCLUIDA -> B2 unblocks (D4 satisfier A).
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'concluida', completed_at = now()
  where id = (select id from bcp where position = 1);
select set_config('app.in_case_rpc', 'off', true);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.activate_phase((select id from bcp where position = 2), (select st_x from k))).status,
  'ativa',
  'D4 satisfier A: a CONCLUIDA blocker unblocks the dependent phase'
);
reset role;

-- Case B: tests D4-B (nao_necessaria/skip unblocks). B3 blocks [2]; skip B2.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table bcse2 on commit drop as
  select (public.create_case_from_template((select tid from btpl), 'Caso Blocker B')).id as cid;
reset role;
grant select on bcse2 to authenticated;
create temp table bcp2 on commit drop as
  select id, position from public.case_phases where case_id = (select cid from bcse2);
grant select on bcp2 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase((select id from bcp2 where position = 2));
select is(
  (public.activate_phase((select id from bcp2 where position = 3), (select st_x from k))).status,
  'ativa',
  'D4 satisfier B: a NAO_NECESSARIA (skipped) blocker unblocks the dependent phase'
);
reset role;

-- ---- 10) assigning a NON-member -> P0021 ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.activate_phase(%L,%L) $$,
          (select id from cp where position = 1), (select st_y from k)),
  'HC021',
  null,
  'activate_phase rejects an assignee who is not a commission member (P0021)'
);
reset role;

-- ---- 11) activate phase 1, assigned to staff X ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.activate_phase((select id from cp where position = 1), (select st_x from k))).status,
  'ativa',
  'activate_phase sets the phase to ativa and assigns it'
);
reset role;

-- =========================================================================
-- start_or_resume_phase: assignee gate + the one-response-per-phase index.
-- =========================================================================
-- ---- 12) a NON-assignee cannot start the phase (P0022) ----
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.start_or_resume_phase(%L) $$, (select id from cp where position = 1)),
  'HC022',
  null,
  'start_or_resume_phase rejects a caller who is not the assignee (P0022)'
);
reset role;

-- ---- 13) the assignee starts the phase; a response with case_phase_id set ----
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table rsp on commit drop as
  select (public.start_or_resume_phase((select id from cp where position = 1))).id as rid;
reset role;
grant select on rsp to authenticated;
select is(
  (select case_phase_id from public.responses where id = (select rid from rsp)),
  (select id from cp where position = 1),
  'start_or_resume_phase creates a response bridged to the phase (case_phase_id set)'
);

-- ---- 14) resume returns the SAME response (one-per-phase index) ----
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (public.start_or_resume_phase((select id from cp where position = 1))).id,
  (select rid from rsp),
  'start_or_resume_phase resumes the single existing response for the phase'
);
reset role;

-- =========================================================================
-- THE PHASE-7 INVARIANT: case_phase_answer_map is SUBMITTED-ONLY.
-- =========================================================================
-- Answer the required item (u_q1 = 'Sim') but DO NOT submit yet.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  (select rid from rsp), (select sec_u from k),
  jsonb_build_object((select item_mc from k)::text, to_jsonb('Sim'::text)));
reset role;

-- ---- 15) in-progress source phase -> answer_map is '{}' (THE INVARIANT) ----
select is(
  app.case_phase_answer_map((select id from cp where position = 1)),
  '{}'::jsonb,
  'case_phase_answer_map returns {} for an in-progress source phase (Phase-7 invariant)'
);

-- ---- 16) recompute leaves phase 2 NOT recommended while source is in-progress
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.recompute_recommendations((select cid from cse));
reset role;
select is(
  (select recommended from public.case_phases where id = (select id from cp where position = 2)),
  false,
  'recompute does NOT recommend over an in-progress (empty-map) source phase'
);

-- =========================================================================
-- Submit the phase: the trigger advances it and recompute flips phase 2.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.submit_response((select rid from rsp));
reset role;

-- ---- 17) the submit trigger advances phase 1 -> concluida ----
select is(
  (select status from public.case_phases where id = (select id from cp where position = 1)),
  'concluida',
  'sync_case_phase_on_submit advances the phase to concluida on submission'
);

-- ---- 18) now answer_map is POPULATED (submitted) ----
select is(
  app.case_phase_answer_map((select id from cp where position = 1)) ->> 'u_q1',
  'Sim',
  'case_phase_answer_map returns the answers once the source phase is submitted'
);

-- ---- 19) recompute flagged phase 2 recommended (gate = Sim) ----
select is(
  (select recommended from public.case_phases where id = (select id from cp where position = 2)),
  true,
  'recompute flags a pendente phase recommended when its recommend_when is met'
);

-- =========================================================================
-- Terminal-state guards.
-- =========================================================================
-- ---- 20) a concluida phase cannot be directly mutated (guard) ----
set local role authenticated;
select test_helpers.claims_for((select sa_x from k), false);
select throws_ok(
  format($$ update public.case_phases set status = 'ativa' where id = %L $$,
          (select id from cp where position = 1)),
  '23514',
  null,
  'a concluida phase is frozen against a direct status change (guard)'
);
reset role;

-- ---- 21) skip phase 2 (pendente -> nao_necessaria) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.skip_phase((select id from cp where position = 2))).status,
  'nao_necessaria',
  'skip_phase marks a pendente phase nao_necessaria'
);
reset role;

-- ---- 22) skipping an already-terminal phase -> P0019 ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.skip_phase(%L) $$, (select id from cp where position = 2)),
  'HC019',
  null,
  'skip_phase rejects a phase that is not pendente (P0019)'
);
reset role;

-- =========================================================================
-- close_case + the D3 CONCLUDE GATE + the case terminal guard.
-- =========================================================================
-- ---- 23) D3 conclude gate: HC031 (unsettled) / HC028 (outcome required) / OK ----
-- (23a) HC031: a case with an UNSETTLED (pendente/ativa) phase cannot conclude.
-- Build a fresh 2-phase case (both pendente) and try to close it.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table gcse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Gate')).id as cid;
reset role;
grant select on gcse to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select cid from gcse)),
  'HC031',
  null,
  'close_case rejects a case with unsettled (pendente/ativa) phases (HC031)'
);
reset role;

-- (23b) HC028: a SETTLED case whose process OFFERS outcomes cannot conclude with
-- none chosen. Build an outcome + a template offering it + a case, settle, close.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table goc on commit drop as
  select (public.create_case_outcome((select comm_x from k), 'Desfecho gate', 'green', false, false)).id as oid;
grant select on goc to authenticated;
create temp table gtpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc gate', null)).id as tid;
grant select on gtpl to authenticated;
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from gtpl), (select form_u from k), 'GF1');
select public.set_process_outcomes((select tid from gtpl), array[(select oid from goc)]);
select public.publish_process_template((select tid from gtpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table gcse2 on commit drop as
  select (public.create_case_from_template((select tid from gtpl), 'Caso Gate Outcome')).id as cid;
reset role;
grant select on gcse2 to authenticated;

-- Settle the only phase (skip), then close must require an outcome (HC028).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase((select id from public.case_phases
  where case_id = (select cid from gcse2) and position = 1));
select throws_ok(
  format($$ select public.close_case(%L) $$, (select cid from gcse2)),
  'HC028',
  null,
  'close_case rejects a settled case that offers outcomes but has none chosen (HC028)'
);
-- Choose the offered outcome -> close now succeeds.
select public.set_case_outcome((select cid from gcse2), (select oid from goc));
select is(
  (public.close_case((select cid from gcse2))).status,
  'concluido',
  'close_case succeeds once settled AND an offered outcome is chosen'
);
reset role;

-- (23c) The original happy path: cse is settled (phase1 concluida, phase2 skipped)
-- and offers NO outcomes -> close succeeds. Leaves cse terminal for test 24.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.close_case((select cid from cse))).status,
  'concluido',
  'close_case flips a settled, no-outcome case to concluido'
);
reset role;

-- ---- 24) operating on a closed case -> P0020 ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_ad_hoc_phase(%L,%L,'late',null,null) $$,
          (select cid from cse), (select form_u from k)),
  'HC020',
  null,
  'a closed case rejects further phase operations (P0020)'
);
reset role;

-- =========================================================================
-- RLS read boundary: a cross-commission member cannot read X's case/phases,
-- and list_cases_board / get_case_detail leak nothing to a non-staff_admin.
-- =========================================================================
-- ---- 25) staff Y (commission Y) sees no rows of commission X's case ----
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.cases where id = (select cid from cse)),
  0,
  'a cross-commission member cannot read another commission''s case (RLS)'
);
reset role;

-- ---- 26) list_cases_board returns empty for a non-staff_admin (plain staff) --
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_cases_board((select comm_x from k))),
  0,
  'list_cases_board (definer, is_staff_admin_of-gated) returns nothing to plain staff'
);
reset role;

-- ---- 27) get_case_detail (definer envelope) leaks nothing to a non-staff_admin
-- INFO-2: the gated read raises no_data_found (mapped to "not found") for a
-- caller who is not a staff_admin of the case's commission — a plain staff
-- member, even of the SAME commission, gets nothing (no header, no phases, no
-- in-progress answers). Faster feedback than the E2E.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.get_case_detail(%L) $$, (select cid from cse)),
  'P0002',
  null,
  'get_case_detail leaks nothing to a non-staff_admin caller (raises not-found)'
);
reset role;

-- =========================================================================
-- HC017: create_case_from_template against a form with NO published version.
-- =========================================================================
-- MINOR-1. Snapshot integrity: a phase bound to an unpublished form cannot pin a
-- version, so case creation is rejected. publish_process_template does NOT check
-- the phase forms are published (only recommend_when), so the guard fires here at
-- snapshot time. Build a DRAFT-ONLY form in commission X, a 1-phase template
-- bound to it, publish the template, and assert HC017 on case creation.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

create temp table draftform on commit drop as
  select (public.create_form((select comm_x from k), 'Draft only', null)).form_id as fid;
reset role;
grant select on draftform to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl_np on commit drop as
  select (public.create_process_template((select comm_x from k), 'Sem publicação', null)).id as tid;
reset role;
grant select on tpl_np to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl_np), (select fid from draftform), 'F1');
select public.publish_process_template((select tid from tpl_np));
reset role;

-- ---- 28) HC017: the bound form has no published version ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_from_template(%L, 'np') $$, (select tid from tpl_np)),
  'HC017',
  null,
  'create_case_from_template rejects a phase whose form has no published version (HC017)'
);
reset role;

select * from finish();
rollback;
