-- pgTAP — BE-3 correction request doors (Case Correction Lifecycle).
--
-- Covers the full door surface (file → start/save → resubmit → review →
-- approve/reject/withdraw) for phase + narrative + void, the guard corrector arm,
-- and the read arm. Keystones marked (MUTATION) are proven red-on-revert out of
-- band (documented in the BE-3 report); the committed assertions pin the GREEN
-- behavior:
--   K4  (MUTATION: remove the approve compute call → result stays baixo).
--   K2b (MUTATION: drop the guard corrector arm → the non-corrector INSERT succeeds).
--   K10 (MUTATION: null concluded_at/by in the narrative approve arm → K10 preserve red).
--   K3  chain-tip (mirror of 263 K5, kept for the door surface).
--
-- Fixture-flag lesson: case_corrections is enabled explicitly below.
--
-- Assertion count: 39

begin;
select plan(39);

update app.feature_flags set enabled = true
  where key in ('case_corrections', 'cases_multi_phase', 'cases_extras',
                'case_phase_results', 'case_narratives', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid  as sa_x,  (v->>'st_x')::uuid  as st_x,
         (v->>'st_x2')::uuid as st_x2, (v->>'sa_y')::uuid  as sa_y,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- Shared published form: one scored + flagged checkbox (a=3/flagged, b=5/flagged).
create temp table fx on commit drop as
  select gen_random_uuid() as form_id, gen_random_uuid() as ver_id,
         gen_random_uuid() as sec_id, gen_random_uuid() as chk_id;
grant select on fx to authenticated;
do $$
declare v_form uuid; v_ver uuid; v_sec uuid; v_chk uuid; v_comm uuid; v_sa uuid;
begin
  select form_id, ver_id, sec_id, chk_id into v_form, v_ver, v_sec, v_chk from fx;
  select comm_x, sa_x into v_comm, v_sa from k;
  insert into public.forms (id, commission_id, title, created_by) values (v_form, v_comm, 'Corr Doors', v_sa);
  insert into public.form_versions (id, form_id, version_number, status) values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default) values (v_sec, v_ver, 0, true);
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (v_chk, v_sec, 0, 'checkbox', 'chk', 'Marque', false);
  insert into public.form_item_options (item_id, position, code, label, score, flagged) values
    (v_chk, 0, 'a', 'A', 3, true), (v_chk, 1, 'b', 'B', 5, true), (v_chk, 2, 'c', 'C', 0, false);
  perform public.publish_form_version(v_ver);
end $$;

-- Result vocab (as staff_admin).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table vocab on commit drop as select
  (public.create_phase_result((select comm_x from k), 'Alto',  'red',   true)).id  as alto,
  (public.create_phase_result((select comm_x from k), 'Baixo', 'green', false)).id as baixo;
grant select on vocab to authenticated;
reset role;

-- Fixture helper: a completed phase (assigned p_assignee) with a submitted root
-- selecting p_code, pointer = root, emits_result false. Returns the ids.
create function pg_temp.mk_phase(p_case_num int, p_assignee uuid, p_code text)
returns table(case_id uuid, phase_id uuid, root_id uuid)
language plpgsql as $$
declare v_comm uuid; v_form uuid; v_ver uuid; v_chk uuid; v_sa uuid;
begin
  select comm_x, sa_x into v_comm, v_sa from k;
  select form_id, ver_id, chk_id into v_form, v_ver, v_chk from fx;
  case_id := gen_random_uuid(); phase_id := gen_random_uuid(); root_id := gen_random_uuid();
  insert into public.cases (id, commission_id, case_number, status, created_by)
    values (case_id, v_comm, p_case_num, 'in_review', v_sa);
  -- Insert the phase ACTIVE, then submit the root through the real UPDATE path so
  -- sync_case_phase_on_submit completes the phase AND sets current_response_id
  -- (BE-2). No guarded manual update (set_config is unreliable inside an SRF).
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, assigned_to, is_ad_hoc, emits_result)
    values (phase_id, case_id, 0, v_form, v_ver, 'Fase', 'active', p_assignee, true, false);
  insert into public.responses
    (id, form_version_id, commission_id, created_by, status, case_phase_id)
    values (root_id, v_ver, v_comm, p_assignee, 'in_progress', phase_id);
  perform test_helpers.add_selection(root_id, v_chk, array[p_code]);
  update public.responses set status = 'submitted', submitted_at = now() where id = root_id;
  return next;
end $$;

-- ===========================================================================
-- K1 · one open slot per target (HC0M2) + the index backstop (23505).
-- ===========================================================================
create temp table c1 on commit drop as select * from pg_temp.mk_phase(940001, (select st_x from k), 'a');
grant select on c1 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.file_correction_request('correction', %L, null, 'motivo 1', 'clerical', null) $$,
    (select phase_id from c1)),
  'K1: first correction request files ok');
select throws_ok(
  format($$ select public.file_correction_request('correction', %L, null, 'motivo 2', 'clerical', null) $$,
    (select phase_id from c1)),
  'HC0M2', null, 'K1: a second open request on the same target is refused (HC0M2)');
reset role;

-- K1b · index backstop: a direct duplicate open request row → 23505.
select throws_ok($$
  do $inner$ begin
    perform set_config('app.in_correction_rpc','on',true);
    insert into public.case_correction_requests
      (case_id, commission_id, kind, case_phase_id, status, reason, classification, requested_by)
    select case_id, (select comm_x from k), 'correction', phase_id, 'requested', 'dup', 'clerical', (select sa_x from k)
    from c1;
    perform set_config('app.in_correction_rpc','off',true);
  end $inner$; $$,
  '23505', null, 'K1b: the open-slot partial unique index backstops a direct duplicate (23505)');

-- ===========================================================================
-- K2 · authority.
-- ===========================================================================
-- K2a: a filer with no case read → 42501 (sa_y is a coordinator of the OTHER org).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.file_correction_request('correction', %L, null, 'x', 'clerical', null) $$,
    (select phase_id from c1)),
  '42501', null, 'K2a: a non-reader cannot file a correction request (42501)');
reset role;

-- K2b: a non-corrector member direct-INSERTs a case-bound successor → 42501
-- (guard corrector arm). c1 has an OPEN request with permitted_corrector = st_x.
-- MUTATION: drop the corrector arm in guard_supersession_coherent → this succeeds.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.responses (form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
    values ((select ver_id from fx), (select comm_x from k), %L, 'in_progress', %L, %L)
  $$, (select st_x2 from k), (select phase_id from c1), (select root_id from c1)),
  '42501', null, 'K2b: a non-corrector member cannot direct-INSERT a case-bound successor (42501)');
reset role;

-- ===========================================================================
-- K3 · chain-tip: supersede a non-current predecessor → HC0H1.
-- ===========================================================================
create temp table c3 on commit drop as select * from pg_temp.mk_phase(940003, (select st_x from k), 'a');
grant select on c3 to authenticated;
do $$
declare v_succ uuid := gen_random_uuid();
begin
  -- Clear any lingering JWT claims so this is a true service-role insert
  -- (reset role does NOT clear request.jwt.claims → auth.uid() would still be set).
  perform set_config('request.jwt.claims', '', true);
  -- service-role coherent successor, then move the pointer to it.
  insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id, submitted_at)
    values (v_succ, (select ver_id from fx), (select comm_x from k), (select st_x from k), 'submitted',
            (select phase_id from c3), (select root_id from c3), now());
  perform set_config('app.in_case_rpc','on',true);
  update public.case_phases set current_response_id = v_succ where id = (select phase_id from c3);
  perform set_config('app.in_case_rpc','off',true);
end $$;
select throws_ok(
  format($$
    insert into public.responses (form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
    values ((select ver_id from fx), (select comm_x from k), (select st_x from k), 'in_progress', %L, %L)
  $$, (select phase_id from c3), (select root_id from c3)),
  'HC0H1', null, 'K3: superseding a non-current (root) predecessor is refused (HC0H1 chain-tip)');

-- ===========================================================================
-- K4 · approve swap: pointer moves, result recomputed from successor answers,
--      impact_snapshot stamped. (MUTATION: remove the compute call → result baixo.)
-- ===========================================================================
create temp table c4 on commit drop as select gen_random_uuid() as case_id, gen_random_uuid() as phase_id,
       gen_random_uuid() as root_id, gen_random_uuid() as p2_id;
grant select on c4 to authenticated;
do $$
declare v_comm uuid; v_form uuid; v_ver uuid; v_chk uuid; v_sa uuid; v_st uuid; v_alto uuid; v_baixo uuid;
begin
  select comm_x, sa_x, st_x into v_comm, v_sa, v_st from k;
  select form_id, ver_id, chk_id into v_form, v_ver, v_chk from fx;
  select alto, baixo into v_alto, v_baixo from vocab;
  insert into public.cases (id, commission_id, case_number, status, created_by)
    values ((select case_id from c4), v_comm, 940004, 'in_review', v_sa);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, assigned_to, is_ad_hoc, emits_result, result_ruleset)
    values ((select phase_id from c4), (select case_id from c4), 0, v_form, v_ver, 'Fase', 'active', v_st, true, true,
      jsonb_build_object('rules', jsonb_build_array(
        jsonb_build_object('when', jsonb_build_object('question_key','__total_score__','op','gte','value',5),
                           'result_id', v_alto::text)),
        'default_result_id', v_baixo::text));
  -- a later phase so impact_snapshot has content
  insert into public.case_phases (id, case_id, position, form_id, form_version_id, title, status, is_ad_hoc, emits_result)
    values ((select p2_id from c4), (select case_id from c4), 1, v_form, v_ver, 'Fase 2', 'active', false, false);
  insert into public.case_phase_offered_results (case_id, result_id) values
    ((select case_id from c4), v_alto), ((select case_id from c4), v_baixo);
  -- Root: fill 'a' (score 3 → baixo), submit through the real path (sync completes
  -- the phase, sets the pointer, computes the result = baixo).
  insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id)
    values ((select root_id from c4), v_ver, v_comm, v_st, 'in_progress', (select phase_id from c4));
  perform test_helpers.add_selection((select root_id from c4), v_chk, array['a']);
  update public.responses set status = 'submitted', submitted_at = now() where id = (select root_id from c4);
end $$;

-- file (sa_x, default corrector = assignee st_x) → start (st_x) → edit to 'b' → resubmit → review/approve.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('correction', (select phase_id from c4), null, 'corrigir', 'factual', null);
reset role;
create temp table r4 on commit drop as
  select id as req from public.case_correction_requests where case_phase_id = (select phase_id from c4);
grant select on r4 to authenticated;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table d4 on commit drop as select public.start_correction_draft((select req from r4)) as draft;
grant select on d4 to authenticated;
reset role;
-- change the draft selection root 'a' → 'b' (score 5 → alto).
do $$
begin
  delete from public.answer_selected_options aso using public.answers a
    where aso.answer_id = a.id and a.response_id = (select draft from d4) and a.item_id = (select chk_id from fx);
  perform test_helpers.add_selection((select draft from d4), (select chk_id from fx), array['b']);
end $$;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.resubmit_correction((select req from r4));
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.review_correction((select req from r4));
select public.approve_correction((select req from r4), 'ok');
reset role;

select is((select current_response_id from public.case_phases where id = (select phase_id from c4)),
  (select draft from d4), 'K4: approve re-points current_response_id to the successor');
select is((select result_id from public.case_phases where id = (select phase_id from c4)),
  (select alto from vocab), 'K4: result recomputed from the successor answers (baixo → alto)');
select isnt((select impact_snapshot from public.case_correction_requests where id = (select req from r4)),
  null, 'K4: impact_snapshot is stamped at approval');

-- ===========================================================================
-- K5 · self-approval: corrector == approver → self_approved true.
-- ===========================================================================
create temp table c5 on commit drop as select * from pg_temp.mk_phase(940005, (select st_x from k), 'a');
grant select on c5 to authenticated;
-- sa_x files designating self as corrector, drafts, resubmits, approves.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('correction', (select phase_id from c5), null, 'auto', 'clerical', (select sa_x from k));
reset role;
create temp table r5 on commit drop as select id as req from public.case_correction_requests where case_phase_id = (select phase_id from c5);
grant select on r5 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.start_correction_draft((select req from r5));
select public.resubmit_correction((select req from r5));
select public.approve_correction((select req from r5), null);
reset role;
select is((select self_approved from public.case_correction_requests where id = (select req from r5)),
  true, 'K5: self-approval (corrector == approver) is recorded (self_approved = true)');

-- ===========================================================================
-- K6 · reject → draft editable again; resubmit works.
-- ===========================================================================
create temp table c6 on commit drop as select * from pg_temp.mk_phase(940006, (select st_x from k), 'a');
grant select on c6 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('correction', (select phase_id from c6), null, 'motivo', 'clerical', null);
reset role;
create temp table r6 on commit drop as select id as req from public.case_correction_requests where case_phase_id = (select phase_id from c6);
grant select on r6 to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table d6 on commit drop as select public.start_correction_draft((select req from r6)) as draft;
grant select on d6 to authenticated;
select public.resubmit_correction((select req from r6));
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.reject_correction((select req from r6), 'faltou dado');
reset role;
select is((select status from public.responses where id = (select draft from d6)), 'in_progress',
  'K6: reject flips the draft back to in_progress');
select is((select submitted_at from public.responses where id = (select draft from d6)), null,
  'K6: reject nulls the draft submitted_at');
select is((select status from public.case_correction_requests where id = (select req from r6)), 'rejected',
  'K6: request status = rejected');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.start_correction_draft((select req from r6));
select lives_ok(format($$ select public.resubmit_correction(%L) $$, (select req from r6)),
  'K6: after a rejection the corrector can resubmit again');
reset role;

-- ===========================================================================
-- K7 · withdraw deletes the draft; a resubmitted request cannot be withdrawn.
-- ===========================================================================
create temp table c7 on commit drop as select * from pg_temp.mk_phase(940007, (select st_x from k), 'a');
grant select on c7 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('correction', (select phase_id from c7), null, 'motivo', 'clerical', null);
reset role;
create temp table r7 on commit drop as select id as req from public.case_correction_requests where case_phase_id = (select phase_id from c7);
grant select on r7 to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table d7 on commit drop as select public.start_correction_draft((select req from r7)) as draft;
grant select on d7 to authenticated;
select public.withdraw_correction((select req from r7));
reset role;
select is((select count(*)::int from public.responses where id = (select draft from d7)), 0,
  'K7: withdraw deletes the in_progress draft');

-- resubmitted-then-withdraw is refused (HC0M7).
create temp table c7b on commit drop as select * from pg_temp.mk_phase(940008, (select st_x from k), 'a');
grant select on c7b to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('correction', (select phase_id from c7b), null, 'motivo', 'clerical', null);
reset role;
create temp table r7b on commit drop as select id as req from public.case_correction_requests where case_phase_id = (select phase_id from c7b);
grant select on r7b to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.start_correction_draft((select req from r7b));
select public.resubmit_correction((select req from r7b));
select throws_ok(format($$ select public.withdraw_correction(%L) $$, (select req from r7b)),
  'HC0M7', null, 'K7: a resubmitted request cannot be withdrawn (HC0M7)');
reset role;

-- ===========================================================================
-- K8 · flag OFF → every door raises HC000 (feature-disabled sentinel, MINOR-2).
--      Distinct from the invalid-state 23514 the same doors raise — proven by K8b.
-- ===========================================================================
update app.feature_flags set enabled = false where key = 'case_corrections';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok($$ select public.file_correction_request('correction', gen_random_uuid(), null, 'r', 'clerical', null) $$,
  'HC000', null, 'K8: file_correction_request refused (HC000) when flag OFF');
select throws_ok($$ select public.start_correction_draft(gen_random_uuid()) $$, 'HC000', null,
  'K8: start_correction_draft refused (HC000) when flag OFF');
select throws_ok($$ select public.save_correction_draft_body(gen_random_uuid(), 'x') $$, 'HC000', null,
  'K8: save_correction_draft_body refused (HC000) when flag OFF');
select throws_ok($$ select public.resubmit_correction(gen_random_uuid()) $$, 'HC000', null,
  'K8: resubmit_correction refused (HC000) when flag OFF');
select throws_ok($$ select public.review_correction(gen_random_uuid()) $$, 'HC000', null,
  'K8: review_correction refused (HC000) when flag OFF');
select throws_ok($$ select public.approve_correction(gen_random_uuid(), null) $$, 'HC000', null,
  'K8: approve_correction refused (HC000) when flag OFF');
select throws_ok($$ select public.reject_correction(gen_random_uuid(), 'r') $$, 'HC000', null,
  'K8: reject_correction refused (HC000) when flag OFF');
select throws_ok($$ select public.withdraw_correction(gen_random_uuid()) $$, 'HC000', null,
  'K8: withdraw_correction refused (HC000) when flag OFF');
reset role;
update app.feature_flags set enabled = true where key = 'case_corrections';

-- K8b · DISTINCTNESS keystone (MINOR-2). With the flag ON, an invalid door call raises
-- bare check_violation (23514) — a DIFFERENT SQLSTATE from the flag-off HC000 above. This
-- is what lets mapCorrectionError tell "feature disabled" (HC000 → "não disponível") apart
-- from "invalid state" (23514 → "a solicitação mudou de estado"). Mutation-sensitive both
-- ways: revert the assert to check_violation and the eight K8 rows go red; collapse this
-- target-XOR guard to HC000 and this row goes red. Neither regression passes silently.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok($$ select public.file_correction_request('correction', null, null, 'r', 'clerical', null) $$,
  '23514', null, 'K8b: flag ON + invalid target-XOR raises 23514 (distinct from flag-off HC000)');
reset role;

-- ===========================================================================
-- K9 · an excluded coordinator is denied (HC0F1) on file + approve. sa_x is
--      recused; sa_x reaches the exclusion gate because sa_x still holds
--      staff_admin (passes authority first). A real request (filed by the
--      non-excluded assignee st_x) lets the approve arm reach HC0F1 too.
-- ===========================================================================
create temp table c9 on commit drop as select * from pg_temp.mk_phase(940009, (select st_x from k), 'a');
grant select on c9 to authenticated;
-- st_x (assignee, not excluded) files + drafts + resubmits a real request FIRST.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.file_correction_request('correction', (select phase_id from c9), null, 'motivo', 'clerical', null);
reset role;
create temp table r9 on commit drop as select id as req from public.case_correction_requests where case_phase_id = (select phase_id from c9);
grant select on r9 to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.start_correction_draft((select req from r9));
select public.resubmit_correction((select req from r9));
reset role;
-- Now recuse sa_x. sa_x still holds staff_admin, so approve/reject reach the
-- exclusion gate (HC0F1) rather than dying on authority (236 precedent).
insert into public.case_recusals (case_id, user_id, source)
  select case_id, (select sa_x from k), 'coordinator' from c9;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.approve_correction(%L, null) $$, (select req from r9)),
  'HC0F1', null, 'K9: an excluded coordinator cannot approve (HC0F1)');
select throws_ok(
  format($$ select public.reject_correction(%L, 'x') $$, (select req from r9)),
  'HC0F1', null, 'K9: an excluded coordinator cannot reject (HC0F1)');
reset role;

-- ===========================================================================
-- K10 · narrative approve: body swapped, revision appended with the OLD body,
--       concluded_at/by PRESERVED. (MUTATION: null them → K10 preserve red.)
-- ===========================================================================
create temp table n10 on commit drop as select gen_random_uuid() as case_id, gen_random_uuid() as narr_id,
       (now() - interval '1 day')::timestamptz as conc_at;
grant select on n10 to authenticated;
do $$
declare v_comm uuid; v_sa uuid; v_st uuid;
begin
  select comm_x, sa_x, st_x into v_comm, v_sa, v_st from k;
  insert into public.cases (id, commission_id, case_number, status, created_by)
    values ((select case_id from n10), v_comm, 941010, 'in_review', v_sa);
  perform set_config('app.in_narrative_rpc','on',true);
  insert into public.case_narratives
    (id, case_id, display_label, display_position, is_expected, is_ad_hoc, body_md, assigned_to,
     status, concluded_at, concluded_by, created_by)
    values ((select narr_id from n10), (select case_id from n10), 'Relato', 0, true, false,
      'corpo antigo', v_st, 'completed', (select conc_at from n10), v_st, v_sa);
  perform set_config('app.in_narrative_rpc','off',true);
end $$;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('correction', null, (select narr_id from n10), 'ajustar', 'factual', null);
reset role;
create temp table rn10 on commit drop as select id as req from public.case_correction_requests where case_narrative_id = (select narr_id from n10);
grant select on rn10 to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_correction_draft_body((select req from rn10), 'corpo novo');
select public.resubmit_correction((select req from rn10));
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.approve_correction((select req from rn10), null);
reset role;
select is((select body_md from public.case_narratives where id = (select narr_id from n10)), 'corpo novo',
  'K10: narrative approve swaps the body');
select is((select body_md from public.case_narrative_revisions where case_narrative_id = (select narr_id from n10)),
  'corpo antigo', 'K10: a revision row is appended with the OLD body');
select is((select concluded_at from public.case_narratives where id = (select narr_id from n10)),
  (select conc_at from n10), 'K10: concluded_at is PRESERVED across approval');
select is((select concluded_by from public.case_narratives where id = (select narr_id from n10)),
  (select st_x from k), 'K10: concluded_by is PRESERVED across approval');

-- ===========================================================================
-- K11 · phase void: status voided, result cleared, pointer kept, impact stamped.
-- ===========================================================================
create temp table c11 on commit drop as select * from pg_temp.mk_phase(941011, (select st_x from k), 'a');
grant select on c11 to authenticated;
-- a DOWNSTREAM active phase (position 1) so the void's impact_snapshot has content.
create temp table c11d on commit drop as select gen_random_uuid() as phase_b;
grant select on c11d to authenticated;
do $$ begin
  perform set_config('app.in_case_rpc','on',true);
  -- give the void target a result first so we can prove it's cleared.
  update public.case_phases set result_id = (select baixo from vocab), result_source = 'computed'
    where id = (select phase_id from c11);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, is_ad_hoc, emits_result)
    values ((select phase_b from c11d), (select case_id from c11), 1, (select form_id from fx),
            (select ver_id from fx), 'Fase 2', 'active', true, false);
  perform set_config('app.in_case_rpc','off',true);
end $$;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('void', (select phase_id from c11), null, 'anular', 'substantive', null);
reset role;
create temp table r11 on commit drop as select id as req from public.case_correction_requests where case_phase_id = (select phase_id from c11);
grant select on r11 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.approve_correction((select req from r11), null);
reset role;
select is((select status from public.case_phases where id = (select phase_id from c11)), 'voided',
  'K11: phase void sets status = voided');
select is((select result_id from public.case_phases where id = (select phase_id from c11)), null,
  'K11: phase void clears result_id');
select is((select current_response_id from public.case_phases where id = (select phase_id from c11)),
  (select root_id from c11), 'K11: phase void KEEPS current_response_id (history)');
-- MINOR-1: a void approval stamps impact_snapshot listing the downstream phase.
-- MUTATION: remove the void-arm impact computation → this goes red.
select is(
  (select (impact_snapshot -> 0 ->> 'id')::uuid
   from public.case_correction_requests where id = (select req from r11)),
  (select phase_b from c11d),
  'K11: void approval stamps impact_snapshot listing the downstream active phase');

-- ===========================================================================
-- K12 · narrative void: snapshot + status voided.
-- ===========================================================================
create temp table n12 on commit drop as select gen_random_uuid() as case_id, gen_random_uuid() as narr_id;
grant select on n12 to authenticated;
do $$
declare v_comm uuid; v_sa uuid; v_st uuid;
begin
  select comm_x, sa_x, st_x into v_comm, v_sa, v_st from k;
  insert into public.cases (id, commission_id, case_number, status, created_by)
    values ((select case_id from n12), v_comm, 941012, 'in_review', v_sa);
  perform set_config('app.in_narrative_rpc','on',true);
  insert into public.case_narratives
    (id, case_id, display_label, display_position, is_expected, is_ad_hoc, body_md, assigned_to,
     status, concluded_at, concluded_by, created_by)
    values ((select narr_id from n12), (select case_id from n12), 'Relato', 0, true, false,
      'corpo v', v_st, 'completed', now(), v_st, v_sa);
  perform set_config('app.in_narrative_rpc','off',true);
end $$;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('void', null, (select narr_id from n12), 'anular narrativa', 'substantive', null);
reset role;
create temp table r12 on commit drop as select id as req from public.case_correction_requests where case_narrative_id = (select narr_id from n12);
grant select on r12 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.approve_correction((select req from r12), null);
reset role;
select is((select status from public.case_narratives where id = (select narr_id from n12)), 'voided',
  'K12: narrative void sets status = voided');
select is((select count(*)::int from public.case_narrative_revisions where case_narrative_id = (select narr_id from n12)),
  1, 'K12: narrative void snapshots the old body into a revision');

-- ===========================================================================
-- K13 · read arm: a NON-creator, NON-admin corrector reads the predecessor via
--       the arm; the same member on a case with NO request cannot. The root is
--       created by st_x, but the designated corrector is st_x2 — so st_x2's read
--       can ONLY come from the correction read arm.
-- ===========================================================================
create temp table c13 on commit drop as select * from pg_temp.mk_phase(941013, (select st_x from k), 'a');
grant select on c13 to authenticated;
create temp table c13b on commit drop as select * from pg_temp.mk_phase(941014, (select st_x from k), 'a');
grant select on c13b to authenticated;
-- st_x2 is granted case READ on both cases (so it can be a corrector — HC0M4 needs
-- can_read_case) but is NOT the response creator nor staff_admin, so it still cannot
-- read the predecessor RESPONSE except via the correction read arm.
insert into public.case_access_grants (case_id, principal_id, source, read_case_content)
  select case_id, (select st_x2 from k), 'manual_grant', true from c13;
insert into public.case_access_grants (case_id, principal_id, source, read_case_content)
  select case_id, (select st_x2 from k), 'manual_grant', true from c13b;
-- sa_x designates st_x2 as the corrector on c13 ONLY (explicit, staff_admin-only).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request('correction', (select phase_id from c13), null, 'motivo', 'clerical', (select st_x2 from k));
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.responses where id = (select root_id from c13)),
  1, 'K13: the designated corrector (non-creator, non-admin) reads the predecessor via the read arm');
select is(
  (select count(*)::int from public.responses where id = (select root_id from c13b)),
  0, 'K13: the same member cannot read a predecessor on a case where they hold no request');
reset role;

select * from finish();
rollback;
