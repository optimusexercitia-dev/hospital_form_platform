-- Cases-Extras R2: configurable per-commission case status.
-- Covers: seed trigger (new commission gets 5 defs); guard allows non-terminal→any-defined;
-- HC024 (undefined key); HC025 (terminal-frozen); DELETE blocked on terminal case;
-- set_case_status terminal-entry behaviour (flip open phases + closed_at);
-- CRITICAL REGRESSION: phase submit advances while case is in a CUSTOM NON-TERMINAL
-- status (em_revisao); cross-commission status-def isolation.

begin;
select plan(18);

-- Enable both feature flags for this transaction.
update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
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

-- =========================================================================
-- 1) SEED TRIGGER: new commission (inserted by bootstrap) gets 5 status defs
-- =========================================================================
select is(
  (select count(*)::int from public.case_status_defs where commission_id = (select comm_x from k)),
  5,
  'seed trigger fires on commissions INSERT: comm_x receives 5 default status defs'
);

-- The initial status key must be em_andamento.
select is(
  (select key from public.case_status_defs
   where commission_id = (select comm_x from k) and is_initial = true),
  'em_andamento',
  'seed trigger: the initial status key is em_andamento'
);

-- Two terminal statuses (concluido, cancelado).
select is(
  (select count(*)::int from public.case_status_defs
   where commission_id = (select comm_x from k) and is_terminal = true),
  2,
  'seed trigger: exactly 2 terminal status defs (concluido, cancelado)'
);

-- =========================================================================
-- 2) CROSS-COMMISSION ISOLATION: comm_y also has 5 independent defs
-- =========================================================================
select is(
  (select count(*)::int from public.case_status_defs where commission_id = (select comm_y from k)),
  5,
  'cross-commission isolation: comm_y independently gets 5 status defs'
);

-- The position sequences of X and Y are independent; each starts at 1.
select is(
  (select min(position) from public.case_status_defs where commission_id = (select comm_x from k)),
  1,
  'comm_x positions start at 1'
);
select is(
  (select min(position) from public.case_status_defs where commission_id = (select comm_y from k)),
  1,
  'comm_y positions start at 1 (independent counter)'
);

-- =========================================================================
-- Build a 1-phase template + case (status em_andamento) in commission X.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Status E2E', null)).id as tid;
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 1');
select public.publish_process_template((select tid from tpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Status')).id as cid;
reset role;
grant select on cse to authenticated;

-- The new case starts in the initial status (em_andamento).
select is(
  (select status from public.cases where id = (select cid from cse)),
  'em_andamento',
  'create_case_from_template sets status to the commission initial key (em_andamento)'
);

-- =========================================================================
-- 3) GUARD: non-terminal → any defined status is allowed (em_andamento → em_revisao)
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_status(%L, 'em_revisao') $$, (select cid from cse)),
  'set_case_status allows non-terminal → any defined status (em_andamento → em_revisao)'
);
reset role;

select is(
  (select status from public.cases where id = (select cid from cse)),
  'em_revisao',
  'case status is now em_revisao after set_case_status'
);

-- =========================================================================
-- 4) HC024: undefined status key is rejected
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_status(%L, 'inventado') $$, (select cid from cse)),
  'HC024',
  null,
  'set_case_status rejects an undefined status key (HC024)'
);
reset role;

-- =========================================================================
-- 5) TERMINAL ENTRY: set_case_status to concluido stamps closed_at + flips phases
-- =========================================================================
-- First activate the phase and open it.
create temp table cp on commit drop as
  select id, position from public.case_phases where case_id = (select cid from cse);
grant select on cp to authenticated;

-- Activate phase 1 → assigned to st_x.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.activate_phase((select id from cp where position = 1), (select st_x from k));
reset role;

-- Now move the case into a terminal status.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_case_status(%L, 'concluido') $$, (select cid from cse)),
  'set_case_status into terminal status (concluido) succeeds'
);
reset role;

-- closed_at must now be set.
select isnt(
  (select closed_at from public.cases where id = (select cid from cse)),
  null,
  'set_case_status terminal entry stamps closed_at'
);

-- The open (ativa) phase must have been flipped to nao_necessaria.
select is(
  (select status from public.case_phases where id = (select id from cp where position = 1)),
  'nao_necessaria',
  'set_case_status terminal entry flips remaining open phases to nao_necessaria'
);

-- =========================================================================
-- 6) HC025: further status changes from a terminal status are blocked
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_status(%L, 'em_andamento') $$, (select cid from cse)),
  'HC025',
  null,
  'set_case_status rejects any change out of a terminal status (HC025)'
);
reset role;

-- =========================================================================
-- 7) DELETE BLOCKED on a terminal case
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- guard_case_status also fires on DELETE (set triggers for delete guard).
-- The guard raises 23514 on DELETE from a terminal status.
select throws_ok(
  format($$ delete from public.cases where id = %L $$, (select cid from cse)),
  '23514',
  null,
  'DELETE is blocked on a terminal case (guard fires on DELETE too)'
);
reset role;

-- =========================================================================
-- 8) CRITICAL REGRESSION: phase submit while case is in a CUSTOM NON-TERMINAL
-- status (em_revisao) still advances the phase to concluida.
-- This guards the liveness-literal sweep (no hard-coded 'aberto' literal).
-- =========================================================================
-- Build a fresh case for the regression test.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table reg_cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Regression Case')).id as cid;
reset role;
grant select on reg_cse to authenticated;

-- Move it to the custom non-terminal status 'em_revisao'.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_status((select cid from reg_cse), 'em_revisao');

-- Activate phase 1 → assign to st_x.
create temp table reg_cp on commit drop as
  select id, position from public.case_phases where case_id = (select cid from reg_cse);
grant select on reg_cp to authenticated;
reset role;
grant select on reg_cp to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.activate_phase((select id from reg_cp where position = 1), (select st_x from k));
reset role;

-- The assignee starts the phase + creates a response.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table reg_rsp on commit drop as
  select (public.start_or_resume_phase((select id from reg_cp where position = 1))).id as rid;
reset role;
grant select on reg_rsp to authenticated;

-- Answer the required item (u_q1 = 'Sim').
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  (select rid from reg_rsp),
  (select sec_u from k),
  jsonb_build_object((select item_mc from k)::text, to_jsonb('Sim'::text)));

-- SUBMIT while case is in em_revisao (a non-terminal custom status).
select public.submit_response((select rid from reg_rsp));
reset role;

-- THE CRITICAL ASSERTION: phase must now be 'concluida' (not stuck).
select is(
  (select status from public.case_phases where id = (select id from reg_cp where position = 1)),
  'concluida',
  'CRITICAL REGRESSION: submit advances phase to concluida while case is in custom non-terminal status em_revisao'
);

-- The case itself must still be in em_revisao (not auto-closed by the submit).
select is(
  (select status from public.cases where id = (select cid from reg_cse)),
  'em_revisao',
  'case remains in em_revisao after phase submit (submit does not change case status)'
);

-- =========================================================================
-- 9) RLS: comm_y member cannot read comm_x status defs
-- =========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_status_defs
   where commission_id = (select comm_x from k)),
  0,
  'RLS: cross-commission member cannot read another commission''s status defs'
);
reset role;

select * from finish();
rollback;
