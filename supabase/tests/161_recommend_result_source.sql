-- pgTAP tests for result-based phase recommendation (ADR 0043).
-- Migration: 20260630000004_recommend_when_result_source.sql
--
-- recommend_when becomes a COMBINABLE group of answer/result conditions; a phase
-- can be auto-recommended (the `recommended` flag — a SUGGESTION) from an EARLIER
-- phase's RESULT (a specific phase_results option, or its `adverse` flag), mixed
-- freely with answer conditions under all (AND) / any (OR). Zero evaluator drift:
-- recompute_recommendations reuses the UNCHANGED app.eval_condition over a
-- synthetic map. TS mirror: evalRecommendation() (recommendation.test.ts).
--
-- Coverage:
--   Template validation: a 4-phase + footgun template publishes; HC063 (result
--     condition on a NON-emitting source slot); HC064 (result id outside the
--     source slot's allowed set).
--   Recompute (Case A, u_q1=Sim → Conforme[non-adverse]): at creation (no result)
--     nothing recommended; after phase-1 concludes, p2 {result=Conforme}=on,
--     p3 {result adverse}=off, p4 any[{result=NãoConforme},{answer Sim}]=on,
--     p5 {result not_equals Conforme}=off (footgun resolved); not_equals footgun
--     ON at creation (no result).
--   Recompute (Case B, u_q1=Não → NãoConforme[adverse]): p2=off, p3=on, p4=on.
--   Override→recompute (Case A, phase-1 concluída → NãoConforme): p2 flips off,
--     p3 flips on, p4 stays on.
--
-- Assertion count: 20

begin;
select plan(20);

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
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'form_u')::uuid  as form_u,
         (v->>'ver_u')::uuid   as ver_u,
         (v->>'sec_u')::uuid   as sec_u,
         (v->>'item_mc')::uuid as item_mc
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- SETUP: result vocabulary in commission X — Conforme (non-adverse),
-- Não-conforme (adverse), Outro (non-adverse, NOT in phase 1's allowed set).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table vocab on commit drop as
  select
    (public.create_phase_result((select comm_x from k), 'Conforme',     'green', false)).id as conforme_id,
    (public.create_phase_result((select comm_x from k), 'Não-conforme', 'red',   true)).id  as nao_conforme_id,
    (public.create_phase_result((select comm_x from k), 'Outro',        'slate', false)).id as outro_id;
grant select on vocab to authenticated;
reset role;

-- ===========================================================================
-- SETUP: 5-phase template (all form_u). Phase 1 emits a result via a ruleset
-- (u_q1='Sim' → Conforme; default → Não-conforme). Phases 2–5 carry result/
-- answer recommend_when groups over phase 1.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc Recomendação Resultado', null)).id as tid;
grant select on tpl to authenticated;

-- Phase 1: emitting (ruleset), allowed = [Conforme, Não-conforme].
select public.add_template_phase(
  (select tid from tpl), (select form_u from k), 'Fase 1',
  null, null, '{}'::integer[],
  jsonb_build_object(
    'rules', jsonb_build_array(
      jsonb_build_object(
        'when', jsonb_build_object('question_key','u_q1','op','equals','value','Sim'),
        'result_id', (select conforme_id from vocab)::text)),
    'default_result_id', (select nao_conforme_id from vocab)::text),
  true,
  jsonb_build_array((select conforme_id from vocab)::text, (select nao_conforme_id from vocab)::text));

-- Phase 2: recommend when phase-1 RESULT equals Conforme.
select public.add_template_phase(
  (select tid from tpl), (select form_u from k), 'Fase 2',
  jsonb_build_object('match','all','conditions', jsonb_build_array(
    jsonb_build_object('source','result','from_phase',1,'op','equals','value',(select conforme_id from vocab)::text))));

-- Phase 3: recommend when phase-1 RESULT is adverse.
select public.add_template_phase(
  (select tid from tpl), (select form_u from k), 'Fase 3',
  jsonb_build_object('match','all','conditions', jsonb_build_array(
    jsonb_build_object('source','result','from_phase',1,'adverse',true))));

-- Phase 4: recommend when (phase-1 RESULT = Não-conforme) OR (phase-1 answer u_q1 = Sim).
select public.add_template_phase(
  (select tid from tpl), (select form_u from k), 'Fase 4',
  jsonb_build_object('match','any','conditions', jsonb_build_array(
    jsonb_build_object('source','result','from_phase',1,'op','equals','value',(select nao_conforme_id from vocab)::text),
    jsonb_build_object('source','answer','from_phase',1,'question_key','u_q1','op','equals','value','Sim'))));

-- Phase 5: recommend when phase-1 RESULT not_equals Conforme (the no-result footgun).
select public.add_template_phase(
  (select tid from tpl), (select form_u from k), 'Fase 5',
  jsonb_build_object('match','all','conditions', jsonb_build_array(
    jsonb_build_object('source','result','from_phase',1,'op','not_equals','value',(select conforme_id from vocab)::text))));
reset role;

-- ---- 1) HC063 — a result-condition over a NON-emitting source slot (phase 2);
-- validated at add-time, so the template must still be a DRAFT here ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_template_phase(%L,%L,'Bad HC063',
            jsonb_build_object('match','all','conditions', jsonb_build_array(
              jsonb_build_object('source','result','from_phase',2,'op','equals','value',%L)))) $$,
          (select tid from tpl), (select form_u from k), (select conforme_id from vocab)::text),
  'HC063', null,
  'add_template_phase rejects a result-condition whose source phase does not emit a result (HC063)');
reset role;

-- ---- 2) HC064 — a result-condition referencing an id outside the source's allowed set ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_template_phase(%L,%L,'Bad HC064',
            jsonb_build_object('match','all','conditions', jsonb_build_array(
              jsonb_build_object('source','result','from_phase',1,'op','equals','value',%L)))) $$,
          (select tid from tpl), (select form_u from k), (select outro_id from vocab)::text),
  'HC064', null,
  'add_template_phase rejects a result-condition referencing an id outside the source allowed set (HC064)');
reset role;

-- ---- 3) publish the 5-phase template ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.publish_process_template((select tid from tpl))).status,
  'active',
  'publish: a template with result + mixed recommend_when groups goes active');
reset role;

-- ===========================================================================
-- CASE A — u_q1 = 'Sim' → phase 1 → Conforme (non-adverse)
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cseA on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso A')).id as cid;
grant select on cseA to authenticated;
create temp table cpA on commit drop as
  select position, id from public.case_phases where case_id = (select cid from cseA);
grant select on cpA to authenticated;
reset role;

-- ---- 4) at creation (phase 1 not concluded → no result): p2 NOT recommended ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 2)),
  false,
  'creation (no result): result-equals recommendation (p2) is NOT recommended');

-- ---- 5) at creation: p4 NOT recommended (result≠NãoConforme + phase 1 unanswered) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 4)),
  false,
  'creation (no result, unanswered): mixed any-group (p4) is NOT recommended');

-- ---- 6) at creation: p5 IS recommended — not_equals over a missing result (footgun) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 5)),
  true,
  'creation (no result): not_equals over a missing result is recommended (the documented footgun)');

-- conclude phase 1 with u_q1 = 'Sim'
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.activate_phase((select id from cpA where position = 1), (select st_x from k));
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table rspA on commit drop as
  select (public.start_or_resume_phase((select id from cpA where position = 1))).id as rid;
grant select on rspA to authenticated;
select public.save_section_answers((select rid from rspA), (select sec_u from k),
  jsonb_build_object((select item_mc from k)::text, to_jsonb('Sim'::text)));
select public.submit_response((select rid from rspA));
reset role;

-- ---- 7) sanity: phase 1 landed on Conforme ----
select is(
  (select result_id from public.case_phases where id = (select id from cpA where position = 1)),
  (select conforme_id from vocab),
  'Case A: phase 1 (u_q1=Sim) computed result = Conforme');

-- ---- 8) p2 {result = Conforme} → recommended ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 2)),
  true,
  'Case A: p2 {result equals Conforme} is recommended after phase 1 concludes');

-- ---- 9) p3 {result adverse} → NOT recommended (Conforme is non-adverse) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 3)),
  false,
  'Case A: p3 {result adverse:true} is NOT recommended (Conforme is non-adverse)');

-- ---- 10) p4 any[{result=NãoConforme},{answer Sim}] → recommended (answer leg) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 4)),
  true,
  'Case A: p4 any-group is recommended via the answer leg (u_q1=Sim)');

-- ---- 11) p5 {result not_equals Conforme} → NOT recommended (footgun resolved) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 5)),
  false,
  'Case A: p5 not_equals Conforme is NOT recommended once the real result is Conforme');

-- ===========================================================================
-- CASE B — u_q1 = 'Não' → phase 1 → Não-conforme (adverse)
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cseB on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso B')).id as cid;
grant select on cseB to authenticated;
create temp table cpB on commit drop as
  select position, id from public.case_phases where case_id = (select cid from cseB);
grant select on cpB to authenticated;
select public.activate_phase((select id from cpB where position = 1), (select st_x from k));
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table rspB on commit drop as
  select (public.start_or_resume_phase((select id from cpB where position = 1))).id as rid;
grant select on rspB to authenticated;
select public.save_section_answers((select rid from rspB), (select sec_u from k),
  jsonb_build_object((select item_mc from k)::text, to_jsonb('Não'::text)));
select public.submit_response((select rid from rspB));
reset role;

-- ---- 12) sanity: phase 1 landed on Não-conforme (default fallback) ----
select is(
  (select result_id from public.case_phases where id = (select id from cpB where position = 1)),
  (select nao_conforme_id from vocab),
  'Case B: phase 1 (u_q1=Não) computed result = Não-conforme (default)');

-- ---- 13) p2 {result = Conforme} → NOT recommended ----
select is(
  (select recommended from public.case_phases where id = (select id from cpB where position = 2)),
  false,
  'Case B: p2 {result equals Conforme} is NOT recommended (result is Não-conforme)');

-- ---- 14) p3 {result adverse} → recommended (Não-conforme is adverse) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpB where position = 3)),
  true,
  'Case B: p3 {result adverse:true} is recommended (Não-conforme is adverse)');

-- ---- 15) p4 any[{result=NãoConforme},…] → recommended (result leg) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpB where position = 4)),
  true,
  'Case B: p4 any-group is recommended via the result leg (Não-conforme)');

-- ===========================================================================
-- OVERRIDE → recompute (Case A, phase 1 concluída): staff_admin corrects the
-- effective result Conforme → Não-conforme; downstream recommendations re-flip.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_phase_result_override(
  (select id from cpA where position = 1), (select nao_conforme_id from vocab), 'correção');
reset role;

-- ---- 16) sanity: phase 1 effective result is now Não-conforme ----
select is(
  (select result_id from public.case_phases where id = (select id from cpA where position = 1)),
  (select nao_conforme_id from vocab),
  'Case A override: phase 1 effective result is now Não-conforme');

-- ---- 17) p2 {result = Conforme} flips OFF ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 2)),
  false,
  'Case A override: p2 {result equals Conforme} flips to NOT recommended after override');

-- ---- 18) p3 {result adverse} flips ON ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 3)),
  true,
  'Case A override: p3 {result adverse:true} flips to recommended after override');

-- ---- 19) p4 any-group stays ON (now via the result leg) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 4)),
  true,
  'Case A override: p4 any-group stays recommended (now via the Não-conforme result leg)');

-- ---- 20) p5 {result not_equals Conforme} flips ON (Não-conforme ≠ Conforme) ----
select is(
  (select recommended from public.case_phases where id = (select id from cpA where position = 5)),
  true,
  'Case A override: p5 not_equals Conforme flips to recommended after override');

select * from finish();
rollback;
