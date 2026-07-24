-- pgTAP — BE-2 current-revision reader sweep (Case Correction Lifecycle).
--
-- Fixture: a completed case phase whose CURRENT-revision pointer
-- (case_phases.current_response_id) is set to the chain ROOT by the submit sync
-- trigger, then a SUBMITTED-but-unapproved SUCCESSOR (supersedes_id = root, same
-- phase) built as service-role (guard_supersession_coherent permits the coherent
-- chain for auth.uid() null). The successor selects a DIFFERENT option so any
-- reader that resolved the wrong row (or double-counted) is caught numerically.
--
-- Keystones:
--   K4 first submit sets the pointer + auto-completes the phase.
--   K3 the successor's submit takes NO effect (pointer + status unchanged) —
--      mutation-proof: neutralize the sync early-return and this goes RED.
--   K1 with the pointer at root, all three readers resolve the ROOT (never the
--      successor, never a double-count).
--   K2 re-point (simulating BE-3 approval) → all three resolve the SUCCESSOR,
--      single-counted.
--   K5 chain-tip rule: a successor pointing at the now-superseded root is rejected.
--   K6 the answer_map completed-filter: a voided (non-completed) phase → empty map.
--
-- Assertion count: 14

begin;
select plan(14);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'cases_extras');
-- case_phase_results deliberately OFF so compute_case_phase_result no-ops (this
-- fixture needs no result vocabulary; the sync trigger still runs).

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- SETUP · a self-contained form (one scored + flagged checkbox), a case + one
-- active phase assigned to st_x. All as superuser (setup, not the SUT).
-- ---------------------------------------------------------------------------
create temp table fx on commit drop as select
  gen_random_uuid() as form_id,
  gen_random_uuid() as ver_id,
  gen_random_uuid() as sec_id,
  gen_random_uuid() as it_chk;
grant select on fx to authenticated;

do $$
declare
  v_form uuid; v_ver uuid; v_sec uuid; v_chk uuid; v_comm uuid; v_sa uuid;
begin
  select form_id, ver_id, sec_id, it_chk into v_form, v_ver, v_sec, v_chk from fx;
  select comm_x, sa_x into v_comm, v_sa from k;

  insert into public.forms (id, commission_id, title, created_by)
    values (v_form, v_comm, 'Correction Readers Form', v_sa);
  insert into public.form_versions (id, form_id, version_number, status)
    values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default)
    values (v_sec, v_ver, 0, true);
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (v_chk, v_sec, 0, 'checkbox', 'chk', 'Marque', false);
  insert into public.form_item_options (item_id, position, code, label, score, flagged) values
    (v_chk, 0, 'a', 'A', 3, true),
    (v_chk, 1, 'b', 'B', 5, true),
    (v_chk, 2, 'c', 'C', 0, false);

  perform public.publish_form_version(v_ver);
end;
$$;

-- Case + one active phase (emits_result false) assigned to st_x; build the ROOT
-- response, submit it (fires the sync trigger → pointer + auto-complete), then
-- build a submitted successor. Stash ids for the assertions.
create temp table t on commit drop as select
  gen_random_uuid() as case_id,
  gen_random_uuid() as phase_id,
  gen_random_uuid() as root_id,
  gen_random_uuid() as succ_id,
  gen_random_uuid() as succ2_id;
grant select on t to authenticated;

do $$
declare
  v_case uuid; v_phase uuid; v_root uuid; v_succ uuid;
  v_comm uuid; v_sa uuid; v_st uuid; v_form uuid; v_ver uuid; v_chk uuid;
begin
  select case_id, phase_id, root_id, succ_id into v_case, v_phase, v_root, v_succ from t;
  select comm_x, sa_x, st_x into v_comm, v_sa, v_st from k;
  select form_id, ver_id, it_chk into v_form, v_ver, v_chk from fx;

  insert into public.cases (id, commission_id, case_number, status, created_by)
    values (v_case, v_comm, 930001, 'in_review', v_sa);

  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, assigned_to,
     is_ad_hoc, emits_result)
  values
    (v_phase, v_case, 0, v_form, v_ver, 'Fase', 'active', v_st, true, false);
  perform set_config('app.in_case_rpc', 'off', true);

  -- ROOT: in_progress → select 'a' (score 3, flagged) → submit (sync fires).
  insert into public.responses
    (id, form_version_id, commission_id, created_by, status, case_phase_id)
  values (v_root, v_ver, v_comm, v_st, 'in_progress', v_phase);
  perform test_helpers.add_selection(v_root, v_chk, array['a']);
  update public.responses set status = 'submitted', submitted_at = now() where id = v_root;

  -- SUCCESSOR: service-role coherent chain (auth.uid() null). Select 'b' (score 5,
  -- flagged) so a mis-resolved reader is caught. Submit → sync must early-return.
  insert into public.responses
    (id, form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
  values (v_succ, v_ver, v_comm, v_st, 'in_progress', v_phase, v_root);
  perform test_helpers.add_selection(v_succ, v_chk, array['b']);
  update public.responses set status = 'submitted', submitted_at = now() where id = v_succ;
end;
$$;

-- ---------------------------------------------------------------------------
-- K4 · first submit set the pointer + auto-completed the phase.
-- ---------------------------------------------------------------------------
select is(
  (select current_response_id from public.case_phases where id = (select phase_id from t)),
  (select root_id from t),
  'K4: sync_case_phase_on_submit set current_response_id to the ROOT on first submit');
select is(
  (select status from public.case_phases where id = (select phase_id from t)),
  'completed',
  'K4: first submit auto-completed the phase');

-- ---------------------------------------------------------------------------
-- K3 · the sync early-return in ISOLATION. In the natural flow the phase is
--      already `completed` when a successor is submitted, so the pre-existing
--      `WHERE status='active'` clause co-guards the pointer/status and MASKS the
--      early-return. To make this a true mutation-proof keystone, construct a
--      phase kept ACTIVE with a submitted predecessor + pointer: without the
--      early-return, the successor's submit WOULD complete the phase and move the
--      pointer; with it, the phase stays inert. Neutralize
--      `if new.supersedes_id is not null then return new` and BOTH assertions go RED.
-- ---------------------------------------------------------------------------
create temp table t3 on commit drop as select
  gen_random_uuid() as case_id,
  gen_random_uuid() as phase_id,
  gen_random_uuid() as root_id,
  gen_random_uuid() as succ_id;
grant select on t3 to authenticated;

do $$
declare
  v_case uuid; v_phase uuid; v_root uuid; v_succ uuid;
  v_comm uuid; v_sa uuid; v_st uuid; v_form uuid; v_ver uuid;
begin
  select case_id, phase_id, root_id, succ_id into v_case, v_phase, v_root, v_succ from t3;
  select comm_x, sa_x, st_x into v_comm, v_sa, v_st from k;
  select form_id, ver_id into v_form, v_ver from fx;

  insert into public.cases (id, commission_id, case_number, status, created_by)
    values (v_case, v_comm, 930002, 'in_review', v_sa);

  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, assigned_to,
     is_ad_hoc, emits_result)
  values
    (v_phase, v_case, 0, v_form, v_ver, 'Fase', 'active', v_st, true, false);

  -- Predecessor inserted ALREADY submitted (no submit UPDATE → sync never fires →
  -- the phase stays `active`). Pointer set to it, as the backfill/sync would.
  insert into public.responses
    (id, form_version_id, commission_id, created_by, status, case_phase_id, submitted_at)
  values (v_root, v_ver, v_comm, v_st, 'submitted', v_phase, now());
  update public.case_phases set current_response_id = v_root where id = v_phase;
  perform set_config('app.in_case_rpc', 'off', true);

  -- Coherent successor (service-role), then submit → fires sync on an ACTIVE phase.
  insert into public.responses
    (id, form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
  values (v_succ, v_ver, v_comm, v_st, 'in_progress', v_phase, v_root);
  update public.responses set status = 'submitted', submitted_at = now() where id = v_succ;
end;
$$;

select is(
  (select status from public.case_phases where id = (select phase_id from t3)),
  'active',
  'K3: an unapproved successor submit did NOT complete the phase (early-return isolated)');
select is(
  (select current_response_id from public.case_phases where id = (select phase_id from t3)),
  (select root_id from t3),
  'K3: an unapproved successor submit did NOT move the pointer (early-return isolated)');

-- ---------------------------------------------------------------------------
-- K1 · with the pointer at the root, all readers resolve the ROOT.
-- ---------------------------------------------------------------------------
select is(
  app.case_phase_answer_map((select phase_id from t)),
  '{"chk": ["a"]}'::jsonb,
  'K1: case_phase_answer_map resolves the ROOT revision (a), not the successor (b)');
select is(
  (select total_score from app.case_phase_option_aggregates((select phase_id from t))),
  3::numeric,
  'K1: case_phase_option_aggregates total_score = 3 (ROOT only; not double-counted)');
select is(
  (select flagged_options from app.case_phase_option_aggregates((select phase_id from t))),
  1,
  'K1: case_phase_option_aggregates flagged_options = 1 (ROOT only)');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (public.get_case_detail((select case_id from t)) -> 'phases' -> 0 ->> 'response_id')::uuid,
  (select root_id from t),
  'K1: get_case_detail phase response_id resolves the ROOT revision');
reset role;

-- ---------------------------------------------------------------------------
-- K2 · re-point (service-role, simulating BE-3 approval) → readers resolve the
--      SUCCESSOR, single-counted.
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases set current_response_id = (select succ_id from t)
    where id = (select phase_id from t);
  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

select is(
  app.case_phase_answer_map((select phase_id from t)),
  '{"chk": ["b"]}'::jsonb,
  'K2: after re-point, case_phase_answer_map resolves the SUCCESSOR (b)');
select is(
  (select total_score from app.case_phase_option_aggregates((select phase_id from t))),
  5::numeric,
  'K2: after re-point, total_score = 5 (SUCCESSOR only; single-counted, not 8)');
select is(
  (select flagged_options from app.case_phase_option_aggregates((select phase_id from t))),
  1,
  'K2: after re-point, flagged_options = 1 (SUCCESSOR only)');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (public.get_case_detail((select case_id from t)) -> 'phases' -> 0 ->> 'response_id')::uuid,
  (select succ_id from t),
  'K2: after re-point, get_case_detail phase response_id resolves the SUCCESSOR');
reset role;

-- ---------------------------------------------------------------------------
-- K5 · chain-tip rule — a successor pointing at the now-superseded root (pointer
--      is at the successor) is rejected by guard_supersession_coherent (HC0H1),
--      even for a service-role writer.
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$
    insert into public.responses
      (id, form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
    values (%L, %L, %L, %L, 'in_progress', %L, %L)
  $$,
    (select succ2_id from t), (select ver_id from fx), (select comm_x from k),
    (select st_x from k), (select phase_id from t), (select root_id from t)),
  'HC0H1', null,
  'K5: a successor superseding the non-current (root) response is refused (HC0H1 chain-tip)');

-- ---------------------------------------------------------------------------
-- K6 · the answer_map completed-filter — a voided phase yields an empty map
--      (keeps voided answers out of recommend_when).
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases set status = 'voided' where id = (select phase_id from t);
  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

select is(
  app.case_phase_answer_map((select phase_id from t)),
  '{}'::jsonb,
  'K6: case_phase_answer_map on a voided (non-completed) phase is empty');

select * from finish();
rollback;
