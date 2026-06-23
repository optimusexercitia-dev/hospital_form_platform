-- pgTAP tests for the case_phase_results feature.
-- Migration: 20260620020000_phase_results.sql
-- Plan: i-am-just-brainstorming-whimsical-narwhal.md
--
-- Coverage:
--   Computed path (rule match; default fallback; no ruleset; offered-set guard).
--   Pre-conclusion override (ativa): columns written; override wins over ruleset;
--     audit row present w/ result_override_id and WITHOUT reason text;
--     authz matrix (non-assignee-non-sa → 42501; sa_x OK; pendente → HC057).
--   Post-conclusion override (concluida): sa corrects immediately; clearing
--     recomputes from ruleset; non-sa → 42501; terminal case → HC060;
--     nao_necessaria → HC057.
--   Publish-time validation: HC059 wrong-commission result_id; HC059 archived
--     default_result_id; HC016 missing question_key; HC017 unpublished form.
--
-- Assertion count: 45

begin;
select plan(45);

-- ===========================================================================
-- Feature flags
-- ===========================================================================
update app.feature_flags set enabled = true
  where key in ('case_phase_results', 'cases_multi_phase', 'cases_extras', 'audit_trail');
update app.feature_flags set enabled = false where key = 'case_access';

-- ===========================================================================
-- Hermetic dataset
-- ===========================================================================
create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

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
         (v->>'sec_u')::uuid   as sec_u,
         (v->>'item_mc')::uuid as item_mc,
         (v->>'form_y')::uuid  as form_y
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- SETUP: result vocabulary in commission X
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table vocab on commit drop as
  select
    (public.create_phase_result((select comm_x from k), 'Conforme',     'green', false)).id as conforme_id,
    (public.create_phase_result((select comm_x from k), 'Não-conforme', 'red',   true)).id  as nao_conforme_id;
grant select on vocab to authenticated;
reset role;

-- 1) Both vocab options created
select ok(
  (select conforme_id from vocab) is not null and (select nao_conforme_id from vocab) is not null,
  'create_phase_result: Conforme (green) and Não-conforme (red, adverse) created for comm_x'
);

-- 2) is_adverse flag persisted on Não-conforme
select ok(
  (select is_adverse from public.phase_results where id = (select nao_conforme_id from vocab)),
  'create_phase_result: is_adverse=true persisted on Não-conforme'
);

-- ===========================================================================
-- SETUP: 2-phase template with result_ruleset on phase 1
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc Resultado', null)).id as tid;
grant select on tpl to authenticated;
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- Phase 1: form_u with ruleset: u_q1='Sim' → Conforme; default → Não-conforme
select public.add_template_phase(
  (select tid from tpl),
  (select form_u from k),
  'Fase 1',
  null,             -- p_recommend_when
  null,             -- p_default_due_days
  '{}'::integer[], -- p_blocks
  jsonb_build_object(
    'rules', jsonb_build_array(
      jsonb_build_object(
        'when', jsonb_build_object('question_key','u_q1','op','equals','value','Sim'),
        'result_id', (select conforme_id from vocab)::text
      )
    ),
    'default_result_id', (select nao_conforme_id from vocab)::text
  )
);
-- Phase 2: no ruleset (so we can test null-ruleset path later with its own template)
select public.add_template_phase(
  (select tid from tpl),
  (select form_u from k),
  'Fase 2'
);
-- 3) publish succeeds
select is(
  (public.publish_process_template((select tid from tpl))).status,
  'active',
  'publish_process_template with result_ruleset on phase 1 → status = active'
);
reset role;

-- ===========================================================================
-- SECTION 1: Computed path — u_q1 = 'Sim' → rule match → Conforme
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse1 on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Sim')).id as cid;
grant select on cse1 to authenticated;
create temp table ph1 on commit drop as
  select id from public.case_phases
  where case_id = (select cid from cse1) and position = 1;
grant select on ph1 to authenticated;
-- 4) case_phase_offered_results has both conforme + nao_conforme
select is(
  (select count(*)::int from public.case_phase_offered_results
   where case_id = (select cid from cse1)),
  2,
  'create_case_from_template: offered result set frozen with 2 options (conforme + nao_conforme)'
);
select public.activate_phase((select id from ph1), (select st_x from k));
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table rsp1 on commit drop as
  select (public.start_or_resume_phase((select id from ph1))).id as rid;
grant select on rsp1 to authenticated;
select public.save_section_answers(
  (select rid from rsp1),
  (select sec_u from k),
  jsonb_build_object((select item_mc from k)::text, to_jsonb('Sim'::text))
);
select public.submit_response((select rid from rsp1));
reset role;

-- 5) rule match → result_id = conforme_id
select is(
  (select result_id from public.case_phases where id = (select id from ph1)),
  (select conforme_id from vocab),
  'computed path: u_q1=Sim matches the rule → result_id = conforme_id'
);

-- 6) result_source = 'computed'
select is(
  (select result_source from public.case_phases where id = (select id from ph1)),
  'computed',
  'computed path: result_source = ''computed'' after rule match'
);

-- 7) result_computed_at is set
select ok(
  (select result_computed_at from public.case_phases where id = (select id from ph1)) is not null,
  'computed path: result_computed_at is set on conclude'
);

-- ===========================================================================
-- SECTION 2: Computed path — u_q1 = 'Não' → falls through to default
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse2 on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Não')).id as cid;
grant select on cse2 to authenticated;
create temp table ph2 on commit drop as
  select id from public.case_phases
  where case_id = (select cid from cse2) and position = 1;
grant select on ph2 to authenticated;
select public.activate_phase((select id from ph2), (select st_x from k));
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table rsp2 on commit drop as
  select (public.start_or_resume_phase((select id from ph2))).id as rid;
grant select on rsp2 to authenticated;
select public.save_section_answers(
  (select rid from rsp2),
  (select sec_u from k),
  jsonb_build_object((select item_mc from k)::text, to_jsonb('Não'::text))
);
select public.submit_response((select rid from rsp2));
reset role;

-- 8) no rule matched → default → nao_conforme_id
select is(
  (select result_id from public.case_phases where id = (select id from ph2)),
  (select nao_conforme_id from vocab),
  'computed path: u_q1=Não matches no rule → falls through to default_result_id'
);

-- 9) result_source = 'computed'
select is(
  (select result_source from public.case_phases where id = (select id from ph2)),
  'computed',
  'computed path (default fallback): result_source = ''computed'''
);

-- ===========================================================================
-- SECTION 3: No ruleset → result_id IS NULL, result_source IS NULL
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl_noruleset on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc Sem Ruleset', null)).id as tid;
grant select on tpl_noruleset to authenticated;
select public.add_template_phase((select tid from tpl_noruleset), (select form_u from k), 'Fase 1');
select public.publish_process_template((select tid from tpl_noruleset));
create temp table cse3 on commit drop as
  select (public.create_case_from_template((select tid from tpl_noruleset), 'Caso Sem Ruleset')).id as cid;
grant select on cse3 to authenticated;
create temp table ph3 on commit drop as
  select id from public.case_phases
  where case_id = (select cid from cse3) and position = 1;
grant select on ph3 to authenticated;
select public.activate_phase((select id from ph3), (select st_x from k));
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table rsp3 on commit drop as
  select (public.start_or_resume_phase((select id from ph3))).id as rid;
grant select on rsp3 to authenticated;
select public.save_section_answers(
  (select rid from rsp3),
  (select sec_u from k),
  jsonb_build_object((select item_mc from k)::text, to_jsonb('Sim'::text))
);
select public.submit_response((select rid from rsp3));
reset role;

-- 10) no ruleset → result_id IS NULL
select is(
  (select result_id from public.case_phases where id = (select id from ph3)),
  null::uuid,
  'no ruleset on template phase → result_id IS NULL after submit'
);

-- 11) no ruleset → result_source IS NULL
select is(
  (select result_source from public.case_phases where id = (select id from ph3)),
  null::text,
  'no ruleset on template phase → result_source IS NULL after submit'
);

-- ===========================================================================
-- SECTION 4: Offered-set guard — computed choice not in offered set → NULL
-- ===========================================================================
-- Create a case from the main template, then remove conforme from the offered set.
-- Manipulate the snapshotted ruleset so default is ALSO conforme, inject a
-- submitted answer so rule matches, and directly call compute_case_phase_result.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_guard on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Guard')).id as cid;
grant select on cse_guard to authenticated;
reset role;

create temp table ph_guard on commit drop as
  select id from public.case_phases
  where case_id = (select cid from cse_guard) and position = 1;
grant select on ph_guard to authenticated;

-- Remove conforme from the offered set to simulate the guard scenario.
delete from public.case_phase_offered_results
  where case_id = (select cid from cse_guard)
    and result_id = (select conforme_id from vocab);

-- Override the snapshotted ruleset so rule AND default both point to conforme,
-- activate the phase, inject a submitted response with u_q1='Sim', then compute.
do $$
declare
  v_phase_id uuid;
  v_fv uuid;
  v_item uuid;
  v_resp_id uuid;
begin
  select id into v_phase_id from ph_guard;
  select form_version_id into v_fv from public.case_phases where id = v_phase_id;
  select item_mc into v_item from k;

  -- Point ruleset's only rule AND default to conforme (which is not in offered set).
  -- Must set app.in_case_rpc to bypass guard_case_phase_status for non-status fields.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
    set result_ruleset = jsonb_build_object(
      'rules', jsonb_build_array(
        jsonb_build_object(
          'when', jsonb_build_object('question_key','u_q1','op','equals','value','Sim'),
          'result_id', (select conforme_id from vocab)::text
        )
      ),
      'default_result_id', (select conforme_id from vocab)::text
    )
    where id = v_phase_id;

  -- Activate + assign.
  update public.case_phases
    set status = 'ativa', assigned_to = (select st_x from k), updated_at = now()
    where id = v_phase_id;
  perform set_config('app.in_case_rpc', 'off', true);

  -- Insert response as in_progress first (answers insert allowed), then flip to
  -- submitted under app.in_submit_rpc (mirrors the seed.sql approach).
  perform set_config('app.in_submit_rpc', 'on', true);
  insert into public.responses
    (form_version_id, commission_id, created_by, case_phase_id, status)
  select v_fv, comm_x, st_x, v_phase_id, 'in_progress' from k
  returning id into v_resp_id;
  perform set_config('app.in_submit_rpc', 'off', true);

  insert into public.answers (response_id, item_id, question_key, value)
    values (v_resp_id, v_item, 'u_q1', to_jsonb('Sim'::text));

  -- Flip to submitted under the RPC flag so the immutability guard is satisfied.
  perform set_config('app.in_submit_rpc', 'on', true);
  update public.responses
    set status = 'submitted', submitted_at = now()
    where id = v_resp_id;
  perform set_config('app.in_submit_rpc', 'off', true);
end;
$$;

-- Call compute directly (as superuser). Rule matches → conforme, but conforme
-- is not in the offered set → guard kicks in → result stays NULL.
select app.compute_case_phase_result((select id from ph_guard));

-- 12) offered-set guard leaves result_id NULL
select is(
  (select result_id from public.case_phases where id = (select id from ph_guard)),
  null::uuid,
  'offered-set guard: compute_case_phase_result leaves result_id NULL when chosen option not in offered set'
);

-- ===========================================================================
-- SECTION 5: Pre-conclusion override (ativa phase)
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_ov on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Override')).id as cid;
grant select on cse_ov to authenticated;
create temp table ph_ov on commit drop as
  select id from public.case_phases
  where case_id = (select cid from cse_ov) and position = 1;
grant select on ph_ov to authenticated;
select public.activate_phase((select id from ph_ov), (select st_x from k));
reset role;

-- assignee (st_x) sets the override to nao_conforme before submit
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.set_case_phase_result_override(
  (select id from ph_ov),
  (select nao_conforme_id from vocab),
  'Razão de teste'
);
reset role;

-- 13) result_override_id written on ativa phase
select is(
  (select result_override_id from public.case_phases where id = (select id from ph_ov)),
  (select nao_conforme_id from vocab),
  'pre-conclusion override: result_override_id written on ativa phase'
);

-- 14) result_override_by not null
select ok(
  (select result_override_by from public.case_phases where id = (select id from ph_ov)) is not null,
  'pre-conclusion override: result_override_by is set'
);

-- 15) result_override_at not null
select ok(
  (select result_override_at from public.case_phases where id = (select id from ph_ov)) is not null,
  'pre-conclusion override: result_override_at is set'
);

-- Submit with u_q1='Sim' (ruleset would give Conforme → override should win)
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table rsp_ov on commit drop as
  select (public.start_or_resume_phase((select id from ph_ov))).id as rid;
grant select on rsp_ov to authenticated;
select public.save_section_answers(
  (select rid from rsp_ov),
  (select sec_u from k),
  jsonb_build_object((select item_mc from k)::text, to_jsonb('Sim'::text))
);
select public.submit_response((select rid from rsp_ov));
reset role;

-- 16) override wins over computed: result_id = nao_conforme_id
select is(
  (select result_id from public.case_phases where id = (select id from ph_ov)),
  (select nao_conforme_id from vocab),
  'pre-conclusion override wins over computed: result_id = nao_conforme_id'
);

-- 17) result_source = 'manual'
select is(
  (select result_source from public.case_phases where id = (select id from ph_ov)),
  'manual',
  'pre-conclusion override: result_source = ''manual'' when override honored'
);

-- 18) audit row has result_override_id
select ok(
  exists (
    select 1 from public.audit_log
    where action = 'case_phase.result_override_set'
      and entity_id = (select id from ph_ov)
      and (metadata -> 'result_override_id') is not null
  ),
  'audit log: case_phase.result_override_set row contains result_override_id'
);

-- 19) audit row does NOT contain result_override_reason key
select ok(
  not exists (
    select 1 from public.audit_log
    where action = 'case_phase.result_override_set'
      and entity_id = (select id from ph_ov)
      and metadata ? 'result_override_reason'
  ),
  'audit log: case_phase.result_override_set row does NOT contain result_override_reason key (Rule 11)'
);

-- 20) audit row metadata does not contain the reason text anywhere
select ok(
  not exists (
    select 1 from public.audit_log
    where action = 'case_phase.result_override_set'
      and entity_id = (select id from ph_ov)
      and metadata::text like '%Razão de teste%'
  ),
  'audit log: reason text ''Razão de teste'' is NOT present in audit row metadata'
);

-- ===========================================================================
-- SECTION 6: Override authz on ativa phase
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_authz on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Authz')).id as cid;
grant select on cse_authz to authenticated;
create temp table ph_authz on commit drop as
  select id from public.case_phases
  where case_id = (select cid from cse_authz) and position = 1;
grant select on ph_authz to authenticated;
select public.activate_phase((select id from ph_authz), (select st_x from k));
reset role;

-- 21) st_x2 (not assignee, not staff_admin) → 42501
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_result_override(%L, %L, null) $$,
    (select id from ph_authz), (select nao_conforme_id from vocab)),
  '42501',
  null,
  'ativa phase: non-assignee non-staff_admin (st_x2) calling override → 42501'
);
reset role;

-- 22) sa_x (staff_admin, not assignee) → succeeds
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_phase_result_override(%L, %L, 'SA override') $$,
    (select id from ph_authz), (select nao_conforme_id from vocab)),
  'ativa phase: sa_x (staff_admin, not assignee) can set override → succeeds'
);
reset role;

-- 23) pendente phase (position 2) → HC057
create temp table ph_authz2 on commit drop as
  select id from public.case_phases
  where case_id = (select cid from cse_authz) and position = 2;
grant select on ph_authz2 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_result_override(%L, %L, null) $$,
    (select id from ph_authz2), (select nao_conforme_id from vocab)),
  'HC057',
  null,
  'pendente phase: override attempt → HC057'
);
reset role;

-- ===========================================================================
-- SECTION 7: Post-conclusion override (concluida phase)
-- ===========================================================================
-- ph1 is concluida (result=conforme, source=computed from Section 1).
-- sa_x corrects it to nao_conforme.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_phase_result_override(
  (select id from ph1),
  (select nao_conforme_id from vocab),
  'Correção pós'
);
reset role;

-- 24) post-conclusion correction applies immediately: result_id = nao_conforme_id
select is(
  (select result_id from public.case_phases where id = (select id from ph1)),
  (select nao_conforme_id from vocab),
  'post-conclusion override applies immediately: result_id = nao_conforme_id'
);

-- 25) result_source = 'manual' after post-conclusion correction
select is(
  (select result_source from public.case_phases where id = (select id from ph1)),
  'manual',
  'post-conclusion override: result_source = ''manual'''
);

-- Clear the override (p_result_id = NULL) → recomputes from ruleset
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_phase_result_override(
  (select id from ph1),
  null::uuid,
  null
);
reset role;

-- 26) clearing override recomputes from ruleset; u_q1='Sim' → conforme
select is(
  (select result_id from public.case_phases where id = (select id from ph1)),
  (select conforme_id from vocab),
  'clearing post-conclusion override recomputes from ruleset → result_id = conforme_id'
);

-- 27) result_source back to 'computed'
select is(
  (select result_source from public.case_phases where id = (select id from ph1)),
  'computed',
  'after clearing override, result_source = ''computed'' (recomputed from ruleset)'
);

-- 28) st_x (not staff_admin) attempting post-conclusion correction → 42501
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_result_override(%L, %L, null) $$,
    (select id from ph1), (select nao_conforme_id from vocab)),
  '42501',
  null,
  'post-conclusion: non-staff_admin (st_x) attempting correction → 42501'
);
reset role;

-- ===========================================================================
-- SECTION 8: HC060 — terminal case
-- ===========================================================================
-- HC060 requires phase.status = 'concluida' AND case.status in ('concluido','cancelado').
-- cse1/ph1 has a concluida phase 1 and a still-pendente phase 2. We skip
-- phase 2 then close cse1 to make it terminal, then try to override ph1.

-- 29) HC060: close cse1 (skip phase 2 first) then attempt override on ph1
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase(id)
  from public.case_phases
  where case_id = (select cid from cse1) and position = 2
    and status = 'pendente';
select public.close_case((select cid from cse1));
reset role;

-- ph1 is concluida; cse1 is now concluido → HC060
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_result_override(%L, %L, null) $$,
    (select id from ph1), (select nao_conforme_id from vocab)),
  'HC060',
  null,
  'HC060: post-conclusion correction on a terminal (concluido) case → HC060'
);
reset role;

-- 30) HC057: nao_necessaria phase on a non-terminal case
-- Use ph_skip from cse_skip — skip phase 1 of a non-terminal case.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_skip on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Skip')).id as cid;
grant select on cse_skip to authenticated;
create temp table ph_skip on commit drop as
  select id from public.case_phases
  where case_id = (select cid from cse_skip) and position = 1;
grant select on ph_skip to authenticated;
select public.skip_phase((select id from ph_skip));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_result_override(%L, %L, null) $$,
    (select id from ph_skip), (select nao_conforme_id from vocab)),
  'HC057',
  null,
  'HC057: override on a nao_necessaria phase (non-terminal case) → HC057'
);
reset role;

-- ===========================================================================
-- SECTION 9: Publish-time validation errors
-- ===========================================================================

-- --- HC059 (a): result_ruleset rule references result_id from WRONG commission ---
-- Create an Aprovado option in comm_y (cross-commission).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table vocab_y on commit drop as
  select (public.create_phase_result((select comm_y from k), 'Aprovado Y', 'green', false)).id as approved_y_id;
grant select on vocab_y to authenticated;
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl_hc059a on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc HC059a', null)).id as tid;
grant select on tpl_hc059a to authenticated;

-- 31) HC059: rule result_id belongs to wrong commission
select throws_ok(
  format($$ select public.add_template_phase(%L, %L, 'Fase 1', null, null, %L::integer[],
    jsonb_build_object(
      'rules', jsonb_build_array(
        jsonb_build_object(
          'when', jsonb_build_object('question_key','u_q1','op','equals','value','Sim'),
          'result_id', %L::text
        )
      ),
      'default_result_id', null
    )
  ) $$,
    (select tid from tpl_hc059a),
    (select form_u from k),
    '{}',
    (select approved_y_id from vocab_y)),
  'HC059',
  null,
  'HC059: add_template_phase rejects a result_ruleset whose rule result_id belongs to a different commission'
);
reset role;

-- --- HC059 (b): default_result_id references an archived option ---
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table archived_result on commit drop as
  select (public.create_phase_result((select comm_x from k), 'Archived Result', 'muted', false)).id as aid;
grant select on archived_result to authenticated;
select public.archive_phase_result((select aid from archived_result));

create temp table tpl_hc059b on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc HC059b', null)).id as tid;
grant select on tpl_hc059b to authenticated;

-- 32) HC059: default_result_id is archived
select throws_ok(
  format($$ select public.add_template_phase(%L, %L, 'Fase 1', null, null, %L::integer[],
    jsonb_build_object(
      'rules', '[]'::jsonb,
      'default_result_id', %L::text
    )
  ) $$,
    (select tid from tpl_hc059b),
    (select form_u from k),
    '{}',
    (select aid from archived_result)),
  'HC059',
  null,
  'HC059: add_template_phase rejects a result_ruleset whose default_result_id is archived'
);
reset role;

-- --- HC016: result_ruleset rule references question_key not in published form ---
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl_hc016 on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc HC016', null)).id as tid;
grant select on tpl_hc016 to authenticated;

-- 33) HC016: rule question_key does not exist in the published form
select throws_ok(
  format($$ select public.add_template_phase(%L, %L, 'Fase 1', null, null, %L::integer[],
    jsonb_build_object(
      'rules', jsonb_build_array(
        jsonb_build_object(
          'when', jsonb_build_object('question_key','nonexistent_key','op','equals','value','Sim'),
          'result_id', %L::text
        )
      ),
      'default_result_id', null
    )
  ) $$,
    (select tid from tpl_hc016),
    (select form_u from k),
    '{}',
    (select conforme_id from vocab)),
  'HC016',
  null,
  'HC016: add_template_phase rejects a result_ruleset whose rule question_key does not exist in the published form'
);
reset role;

-- --- HC017: result_ruleset on a phase whose form has NO published version ---
-- Create a brand-new form with NO published version (draft only).
do $$
declare
  v_fid uuid;
  v_ver uuid;
begin
  -- Create a form that stays in draft (never published).
  insert into public.forms (commission_id, title, created_by)
    values ((select comm_x from k), 'Unpublished Form HC017', (select sa_x from k))
    returning id into v_fid;

  -- Create a draft version but do NOT call publish_form_version.
  v_ver := gen_random_uuid();
  insert into public.form_versions (id, form_id, version_number, status)
    values (v_ver, v_fid, 1, 'draft');
  insert into public.form_sections (form_version_id, position, is_default)
    values (v_ver, 0, true);
  insert into public.form_items (section_id, position, item_type, question_key, label, options, required)
    select id, 0, 'multiple_choice', 'draft_q1', 'Draft Q', '["A","B"]'::jsonb, true
    from public.form_sections where form_version_id = v_ver limit 1;

  create temp table form_unpub (fid uuid) on commit drop;
  insert into form_unpub values (v_fid);
  grant select on form_unpub to authenticated;
end;
$$;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl_hc017 on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc HC017', null)).id as tid;
grant select on tpl_hc017 to authenticated;

-- 34) HC017: result_ruleset when the phase's form has no published version
select throws_ok(
  format($$ select public.add_template_phase(%L, %L, 'Fase 1', null, null, %L::integer[],
    jsonb_build_object(
      'rules', '[]'::jsonb,
      'default_result_id', %L::text
    )
  ) $$,
    (select tid from tpl_hc017),
    (select fid from form_unpub),
    '{}',
    (select conforme_id from vocab)),
  'HC017',
  null,
  'HC017: add_template_phase rejects a result_ruleset when the phase form has no published version'
);
reset role;

-- ===========================================================================
-- SECTION 10: Additional coverage — vocabulary CRUD, RLS, flag probe
-- ===========================================================================

-- 35) plain staff cannot create a phase_result (staff_admin-gated)
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_phase_result(%L, 'Staff Result', 'blue', false) $$,
    (select comm_x from k)),
  '42501',
  null,
  'create_phase_result: plain staff is rejected (staff_admin-gated)'
);
reset role;

-- 36) member of commission X can read phase_results for their commission
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.phase_results
   where commission_id = (select comm_x from k)) >= 2,
  'RLS: a staff member can read phase_results of their own commission'
);
reset role;

-- 37) cross-commission isolation: st_y cannot see comm_x phase_results
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.phase_results
   where commission_id = (select comm_x from k)),
  0,
  'RLS: a cross-commission member cannot read another commission''s phase_results'
);
reset role;

-- 38) case_phase_results_enabled() returns true (flag is ON)
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  public.case_phase_results_enabled(),
  true,
  'case_phase_results_enabled() returns true when the flag is on'
);
reset role;

-- 39) flag OFF: create_phase_result raises check_violation (assert_phase_results_enabled)
update app.feature_flags set enabled = false where key = 'case_phase_results';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_phase_result(%L, 'Flag Off Test', 'blue', false) $$,
    (select comm_x from k)),
  '23514',
  null,
  'create_phase_result raises when case_phase_results flag is OFF'
);
reset role;
update app.feature_flags set enabled = true where key = 'case_phase_results';

-- 40) flag OFF: set_case_phase_result_override raises check_violation
update app.feature_flags set enabled = false where key = 'case_phase_results';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_result_override(%L, null, null) $$,
    gen_random_uuid()),
  '23514',
  null,
  'set_case_phase_result_override raises when case_phase_results flag is OFF'
);
reset role;
update app.feature_flags set enabled = true where key = 'case_phase_results';

-- 41) phase_results row snapshot: case_phases.result_ruleset is set on create_case_from_template
select ok(
  (select result_ruleset from public.case_phases
   where id = (select id from ph1)) is not null,
  'create_case_from_template: result_ruleset is snapshotted onto case_phases'
);

-- 42) update_phase_result: staff_admin can update label/color/is_adverse
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.update_phase_result(
    (select conforme_id from vocab),
    'Conforme (atualizado)',
    'blue',
    false
  )).label,
  'Conforme (atualizado)',
  'update_phase_result: staff_admin can update label and color_token'
);
reset role;

-- 43) archive_phase_result: staff_admin can archive a result option
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table extra_result on commit drop as
  select (public.create_phase_result((select comm_x from k), 'Parcial', 'amber', false)).id as eid;
grant select on extra_result to authenticated;
select is(
  (public.archive_phase_result((select eid from extra_result))).archived,
  true,
  'archive_phase_result: staff_admin can archive a result option'
);
reset role;

-- 44) HC058: set_case_phase_result_override with an invalid result_id (wrong commission)
-- Use the concluida ph2 from cse2, which is not yet closed.
-- ph2 is concluida; sa_x tries to override with a result from comm_y.
-- First we need a non-terminal state for cse2; ph2 phase 2 is still pendente.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_phase_result_override(%L, %L, null) $$,
    (select id from ph2), (select approved_y_id from vocab_y)),
  'HC058',
  null,
  'HC058: override with a result_id from a different commission → HC058'
);
reset role;

-- 45) result_computed_at is set on post-conclusion override (immediate recompute)
-- ph2 is concluida; we set a valid override and check result_computed_at updates.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_phase_result_override(
  (select id from ph2),
  (select conforme_id from vocab),
  null
);
reset role;
select ok(
  (select result_computed_at from public.case_phases where id = (select id from ph2)) is not null,
  'post-conclusion override via recompute: result_computed_at is set after immediate recompute'
);

select * from finish();
rollback;
