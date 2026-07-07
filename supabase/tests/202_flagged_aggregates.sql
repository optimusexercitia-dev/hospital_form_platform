-- pgTAP: Flagged + aggregate result criteria (migration
-- 20260713000700_flagged_aggregate_result_criteria.sql).
--
-- Coverage:
--   §1 app.is_valid_flagged_when — shape/op/type matrix (absent=valid; wrong type
--      rejected; op set enforced; number/date/time value-type match).
--   §2 app.case_phase_option_aggregates — Σ option.score (null→0) + flagged-option
--      count over the SUBMITTED response.
--   §3 compute_case_phase_result INJECTION — a ruleset keyed on __total_score__ /
--      __flagged_count__ fires; the flaggedWhen (number item) half adds to the
--      count and is evaluated against the NORMALIZED answer-map value.
--   §4 flagged survives clone_form_version; flaggedWhen (in config) survives clone.
--   §5 SAVE PATH (FBE-006): add_template_phase ACCEPTS a ruleset referencing the
--      reserved aggregate keys (was HC016), and STILL rejects an unknown key.
--
-- Assertion count: 18

begin;
select plan(18);

update app.feature_flags set enabled = true
  where key in ('case_phase_results', 'cases_multi_phase', 'cases_extras');
update app.feature_flags set enabled = false where key = 'case_access';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §1 · app.is_valid_flagged_when (pure validator)
-- ===========================================================================
-- Absent flaggedWhen → valid for any type.
select ok(app.is_valid_flagged_when('{}'::jsonb, 'number'),
  'is_valid_flagged_when: absent flaggedWhen is valid');
select ok(app.is_valid_flagged_when(null, 'number'),
  'is_valid_flagged_when: null config is valid');
-- Well-shaped number condition.
select ok(
  app.is_valid_flagged_when('{"flaggedWhen":{"op":"gt","value":5}}'::jsonb, 'number'),
  'is_valid_flagged_when: number gt 5 is valid');
-- Present but item type is a choice type → invalid (flaggedWhen only for num/date/time).
select ok(
  not app.is_valid_flagged_when('{"flaggedWhen":{"op":"gt","value":5}}'::jsonb, 'multiple_choice'),
  'is_valid_flagged_when: flaggedWhen on a choice item is invalid');
-- Bad op.
select ok(
  not app.is_valid_flagged_when('{"flaggedWhen":{"op":"in","value":5}}'::jsonb, 'number'),
  'is_valid_flagged_when: op "in" is invalid for flaggedWhen');
-- Number type but string value.
select ok(
  not app.is_valid_flagged_when('{"flaggedWhen":{"op":"gt","value":"5"}}'::jsonb, 'number'),
  'is_valid_flagged_when: number item with string value is invalid');
-- Date type: ISO date valid, garbage rejected.
select ok(
  app.is_valid_flagged_when('{"flaggedWhen":{"op":"gte","value":"2026-07-01"}}'::jsonb, 'date'),
  'is_valid_flagged_when: date gte ISO-date is valid');
select ok(
  not app.is_valid_flagged_when('{"flaggedWhen":{"op":"gte","value":"07/01/2026"}}'::jsonb, 'date'),
  'is_valid_flagged_when: date with non-ISO value is invalid');
-- Time type: HH:mm valid, out-of-range rejected.
select ok(
  app.is_valid_flagged_when('{"flaggedWhen":{"op":"lt","value":"09:30"}}'::jsonb, 'time'),
  'is_valid_flagged_when: time lt HH:mm is valid');
select ok(
  not app.is_valid_flagged_when('{"flaggedWhen":{"op":"lt","value":"24:00"}}'::jsonb, 'time'),
  'is_valid_flagged_when: time 24:00 is invalid (out of range)');

-- ===========================================================================
-- SETUP · a self-contained form with flagged options + a number flaggedWhen item,
-- a result vocab, a case + phase carrying an AGGREGATE ruleset, and a submitted
-- response. All as superuser (setup, not the SUT).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table vocab on commit drop as
  select
    (public.create_phase_result((select comm_x from k), 'Alto',  'red',   true)).id  as alto_id,
    (public.create_phase_result((select comm_x from k), 'Baixo', 'green', false)).id as baixo_id;
grant select on vocab to authenticated;
reset role;

create temp table fx on commit drop as select
  gen_random_uuid() as form_id,
  gen_random_uuid() as ver_id,
  gen_random_uuid() as sec_id,
  gen_random_uuid() as it_choice,   -- checkbox with scored + flagged options
  gen_random_uuid() as it_num;      -- number with flaggedWhen gt 10
grant select on fx to authenticated;

do $$
declare
  v_form uuid; v_ver uuid; v_sec uuid; v_choice uuid; v_num uuid; v_comm uuid; v_sa uuid;
begin
  select form_id, ver_id, sec_id, it_choice, it_num into v_form, v_ver, v_sec, v_choice, v_num from fx;
  select comm_x, sa_x into v_comm, v_sa from k;

  insert into public.forms (id, commission_id, title, created_by)
    values (v_form, v_comm, 'Flagged Form', v_sa);
  insert into public.form_versions (id, form_id, version_number, status)
    values (v_ver, v_form, 1, 'draft');
  insert into public.form_sections (id, form_version_id, position, is_default)
    values (v_sec, v_ver, 0, true);

  -- Checkbox: three options, scores 3/5/0, flagged on opt A + opt B.
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
    values (v_choice, v_sec, 0, 'checkbox', 'f_chk', 'Marque', false);
  insert into public.form_item_options (item_id, position, code, label, score, flagged) values
    (v_choice, 0, 'a', 'A', 3, true),
    (v_choice, 1, 'b', 'B', 5, true),
    (v_choice, 2, 'c', 'C', 0, false);

  -- Number item with flaggedWhen gt 10.
  insert into public.form_items (id, section_id, position, item_type, question_key, label, required, config)
    values (v_num, v_sec, 1, 'number', 'f_num', 'Valor', false,
            jsonb_build_object('flaggedWhen', jsonb_build_object('op','gt','value',10)));

  perform public.publish_form_version(v_ver);
end;
$$;

-- §4 · flagged + flaggedWhen survive a clone into a new draft.
create temp table clone_v on commit drop as
  select public.clone_form_version((select ver_id from fx)) as new_ver;
grant select on clone_v to authenticated;

select is(
  (select count(*)::int from public.form_item_options o
   join public.form_items i on i.id = o.item_id
   where i.form_version_id = (select new_ver from clone_v)
     and i.question_key = 'f_chk' and o.flagged),
  2, 'clone_form_version: both flagged options survive the clone');
select ok(
  (select i.config ? 'flaggedWhen'
   from public.form_items i
   where i.form_version_id = (select new_ver from clone_v) and i.question_key = 'f_num'),
  'clone_form_version: number item flaggedWhen (config) survives the clone');

-- Build a case + one ad-hoc phase bound to this form, with an AGGREGATE ruleset,
-- inject a submitted response selecting A + C (score 3+0=3, 1 flagged option) and
-- number = 12 (flaggedWhen gt 10 → +1 → flagged_count = 2), then compute.
create temp table cse on commit drop as select gen_random_uuid() as cid;
grant select on cse to authenticated;

do $$
declare
  v_cid uuid; v_comm uuid; v_sa uuid; v_st uuid; v_form uuid; v_ver uuid;
  v_choice uuid; v_num uuid; v_phase uuid; v_resp uuid; v_ans uuid;
  v_alto uuid; v_baixo uuid;
begin
  select cid into v_cid from cse;
  select comm_x, sa_x, st_x into v_comm, v_sa, v_st from k;
  select form_id, ver_id, it_choice, it_num into v_form, v_ver, v_choice, v_num from fx;
  select alto_id, baixo_id into v_alto, v_baixo from vocab;

  -- A process-less case (no template) + a manually-inserted ativa phase bound to
  -- the flagged form's published version, carrying the aggregate ruleset.
  insert into public.cases (id, commission_id, case_number, status, created_by)
    values (v_cid, v_comm, 900001, 'pendente', v_sa);

  v_phase := gen_random_uuid();
  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases
    (id, case_id, position, form_id, form_version_id, title, status, assigned_to,
     is_ad_hoc, emits_result, result_ruleset)
  values
    (v_phase, v_cid, 1, v_form, v_ver, 'Fase', 'ativa', v_st, true, true,
     jsonb_build_object(
       'rules', jsonb_build_array(
         jsonb_build_object(
           'when', jsonb_build_object('question_key','__flagged_count__','op','gte','value',2),
           'result_id', v_alto::text)
       ),
       'default_result_id', v_baixo::text));

  -- Offer both results so the offered-set guard admits them.
  insert into public.case_phase_offered_results (case_id, result_id)
    values (v_cid, v_alto), (v_cid, v_baixo);
  perform set_config('app.in_case_rpc', 'off', true);

  -- Submitted response: select A + C on the checkbox, number = 12.
  perform set_config('app.in_submit_rpc', 'on', true);
  insert into public.responses (form_version_id, commission_id, created_by, case_phase_id, status)
    values (v_ver, v_comm, v_st, v_phase, 'in_progress')
    returning id into v_resp;
  perform set_config('app.in_submit_rpc', 'off', true);

  perform test_helpers.add_selection(v_resp, v_choice, array['a','c']);

  insert into public.answers (response_id, item_id, question_key, value, group_instance_id)
    values (v_resp, v_num, 'f_num', to_jsonb(12), null);

  perform set_config('app.in_submit_rpc', 'on', true);
  update public.responses set status = 'submitted', submitted_at = now() where id = v_resp;
  perform set_config('app.in_submit_rpc', 'off', true);

  -- Stash the phase id for the assertions.
  create temp table ph on commit drop as select v_phase as pid;
  grant select on ph to authenticated;
end;
$$;

-- §2 · option aggregates: score = 3 (A) + 0 (C) = 3; flagged options = 1 (A only;
-- C not flagged, B not selected).
select is(
  (select total_score from app.case_phase_option_aggregates((select pid from ph))),
  3::numeric, 'case_phase_option_aggregates: total_score = 3 (A=3 + C=0)');
select is(
  (select flagged_options from app.case_phase_option_aggregates((select pid from ph))),
  1, 'case_phase_option_aggregates: flagged_options = 1 (A flagged; C not)');

-- §3 · compute: __flagged_count__ = 1 option + 1 flaggedWhen (num 12 > 10) = 2 →
-- rule (__flagged_count__ gte 2) fires → Alto.
select app.compute_case_phase_result((select pid from ph));
select is(
  (select result_id from public.case_phases where id = (select pid from ph)),
  (select alto_id from vocab),
  'compute: __flagged_count__ (1 option + 1 flaggedWhen) >= 2 → Alto (rule fired)');
select is(
  (select result_source from public.case_phases where id = (select pid from ph)),
  'computed', 'compute: result_source = computed');

-- ===========================================================================
-- §5 · SAVE PATH (FBE-006): add_template_phase must ACCEPT a result ruleset that
-- references the reserved aggregate keys __total_score__ / __flagged_count__
-- (validate_template_result_ruleset previously rejected them as HC016), and STILL
-- reject a genuinely-unknown question_key. This is the save/validate path the
-- compute-only §1-§4 never exercised — the gap that let FBE-006 ship.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc Agregado', null)).id as tid;
grant select on tpl to authenticated;

-- Phase referencing BOTH synthetic aggregate keys → must SAVE (no HC016).
select lives_ok(
  format($SAVE$
    select public.add_template_phase(
      %L, %L, 'Fase Agregada', null, null, '{}'::integer[],
      jsonb_build_object(
        'rules', jsonb_build_array(
          jsonb_build_object('when', jsonb_build_object(
            'question_key','__flagged_count__','op','gte','value',2),
            'result_id', %L),
          jsonb_build_object('when', jsonb_build_object(
            'question_key','__total_score__','op','gt','value',5),
            'result_id', %L)
        ),
        'default_result_id', %L),
      true,
      jsonb_build_array(%L::text, %L::text))
  $SAVE$,
    (select tid from tpl), (select form_id from fx),
    (select alto_id from vocab), (select alto_id from vocab),
    (select baixo_id from vocab),
    (select alto_id from vocab), (select baixo_id from vocab)),
  'FBE-006: add_template_phase ACCEPTS a ruleset referencing __flagged_count__ + __total_score__');

-- A genuinely-unknown question_key is STILL rejected (HC016) — the fix is a narrow
-- allowlist, not a blanket bypass.
select throws_ok(
  format($BAD$
    select public.add_template_phase(
      %L, %L, 'Fase Inválida', null, null, '{}'::integer[],
      jsonb_build_object(
        'rules', jsonb_build_array(
          jsonb_build_object('when', jsonb_build_object(
            'question_key','__nao_existe__','op','gt','value',1),
            'result_id', %L)),
        'default_result_id', %L),
      true,
      jsonb_build_array(%L::text, %L::text))
  $BAD$,
    (select tid from tpl), (select form_id from fx),
    (select alto_id from vocab), (select baixo_id from vocab),
    (select alto_id from vocab), (select baixo_id from vocab)),
  'HC016', null,
  'FBE-006: an unknown question_key is STILL rejected HC016 (narrow allowlist)');
reset role;

select finish();
rollback;
