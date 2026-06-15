-- Case data-model adjustments: the FIXED, auto-computed case status (decisions
-- D6/D7 + the status precedence) — REPLACES the configurable-status model
-- (migrations 093000/093001).
--
-- The macro status is now a fixed 5-value enum derived by app.recompute_case_status
-- + an AFTER trigger on case_phases:
--   * cancelado / concluido are MANUAL terminal (close_case / cancel_case), frozen.
--   * em_revisao  : ANY phase ativa.
--   * pendente    : >=1 phase concluida, NONE ativa.
--   * nao_iniciado: no phase ativa/concluida (a SKIP-ONLY case stays here, D7).
-- Precedence: cancelado > concluido > em_revisao > pendente > nao_iniciado.
--
-- This file drives a 3-phase case through every precedence branch by directly
-- transitioning phase statuses under app.in_case_rpc (the same valid transitions
-- the RPCs use), asserting the recompute trigger lands the right macro status,
-- then exercises the manual terminal actions (conclude/cancel) + HC025 freeze +
-- the terminal DELETE block. cases_multi_phase is flipped ON for the txn.

begin;
select plan(15);

update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'form_u')::uuid  as form_u
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- Build a 3-phase template (all bound to form_u) + a case in commission X.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Status fixo', null)).id as tid;
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 1');
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 2');
select public.add_template_phase((select tid from tpl), (select form_u from k), 'Fase 3');
select public.publish_process_template((select tid from tpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Status')).id as cid;
reset role;
grant select on cse to authenticated;

create temp table cp on commit drop as
  select id, position from public.case_phases where case_id = (select cid from cse);
grant select on cp to authenticated;

-- =========================================================================
-- 1) ONLY-PENDENTE  =>  nao_iniciado (a fresh case; no phase ativa/concluida)
-- =========================================================================
select is(
  (select status from public.cases where id = (select cid from cse)),
  'nao_iniciado',
  'fresh case (all phases pendente) computes to nao_iniciado'
);

-- Helper note: the following blocks transition phase statuses DIRECTLY as
-- superuser under app.in_case_rpc, which is exactly the guarded transition path
-- the RPCs use; the recompute trigger fires on each UPDATE and re-derives the
-- macro status.

-- =========================================================================
-- 2) ONE ATIVA  =>  em_revisao
-- =========================================================================
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'ativa', activated_at = now()
  where id = (select id from cp where position = 1);
select set_config('app.in_case_rpc', 'off', true);

select is(
  (select status from public.cases where id = (select cid from cse)),
  'em_revisao',
  'a single ativa phase computes the case to em_revisao'
);

-- =========================================================================
-- 3) >=1 CONCLUIDA, NONE ATIVA  =>  pendente
-- =========================================================================
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'concluida', completed_at = now()
  where id = (select id from cp where position = 1);
select set_config('app.in_case_rpc', 'off', true);

select is(
  (select status from public.cases where id = (select cid from cse)),
  'pendente',
  '>=1 concluida and NONE ativa computes the case to pendente'
);

-- =========================================================================
-- 4) ATIVA + CONCLUIDA  =>  em_revisao (ativa takes precedence over pendente)
-- =========================================================================
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'ativa', activated_at = now()
  where id = (select id from cp where position = 2);
select set_config('app.in_case_rpc', 'off', true);

select is(
  (select status from public.cases where id = (select cid from cse)),
  'em_revisao',
  'ativa + concluida computes to em_revisao (ativa precedence over pendente)'
);

-- =========================================================================
-- 5) SKIP-ONLY  =>  nao_iniciado (D7: nao_necessaria does NOT move off nao_iniciado)
-- =========================================================================
-- Build a SEPARATE fresh case and skip its phases (no concluida, no ativa).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table skip_cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Skip')).id as cid;
reset role;
grant select on skip_cse to authenticated;

select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'nao_necessaria', skipped_at = now()
  where case_id = (select cid from skip_cse);
select set_config('app.in_case_rpc', 'off', true);

select is(
  (select status from public.cases where id = (select cid from skip_cse)),
  'nao_iniciado',
  'a SKIP-ONLY case (all nao_necessaria, none concluida) stays nao_iniciado (D7)'
);

-- =========================================================================
-- 6) CONCLUDE  =>  concluido (manual terminal), stamps closed_at, flips open phases
-- =========================================================================
-- The main case (cse) currently has phase 1 concluida, phase 2 ativa, phase 3
-- pendente. Settle the open phases so the D3 conclude gate passes (the gate is
-- asserted in 90_cases test 23; here we exercise the terminal computation).
-- NOTE: re-assert the flag before EACH phase update — the recompute trigger
-- (fired by the prior update) resets app.in_case_rpc to 'off' internally, so a
-- second update in the same block would otherwise lose it and the phase guard
-- would reject the transition.
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'concluida', completed_at = now()
  where id = (select id from cp where position = 2);
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'nao_necessaria', skipped_at = now()
  where id = (select id from cp where position = 3);
select set_config('app.in_case_rpc', 'off', true);

-- All phases settled, no offered outcomes -> close_case succeeds.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.close_case((select cid from cse))).status,
  'concluido',
  'close_case sets a settled case to concluido (manual terminal)'
);
reset role;

select isnt(
  (select closed_at from public.cases where id = (select cid from cse)),
  null,
  'close_case stamps closed_at on the case'
);

-- =========================================================================
-- 7) TERMINAL FREEZE: recompute does NOT override a concluido case (D6)
-- =========================================================================
-- A concluida phase cannot transition, but prove the recompute early-return:
-- the case stays concluido even though a phase-status write fires the trigger.
-- (Use a no-op-safe touch: re-stamp updated_at on a settled phase under the flag.)
select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set updated_at = now()
  where id = (select id from cp where position = 1);
select set_config('app.in_case_rpc', 'off', true);

select is(
  (select status from public.cases where id = (select cid from cse)),
  'concluido',
  'recompute early-returns on a terminal case: concluido is never overridden (D6)'
);

-- =========================================================================
-- 8) HC025: any status change out of a terminal case is blocked
-- =========================================================================
-- close_case on an already-terminal case raises HC025.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select cid from cse)),
  'HC025',
  null,
  'close_case rejects an already-terminal case (HC025)'
);
reset role;

-- cancel_case on a terminal case also raises HC025.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.cancel_case(%L) $$, (select cid from cse)),
  'HC025',
  null,
  'cancel_case rejects an already-terminal case (HC025)'
);
reset role;

-- =========================================================================
-- 9) TERMINAL DELETE BLOCK: a concluido case cannot be deleted (guard fires)
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ delete from public.cases where id = %L $$, (select cid from cse)),
  '23514',
  null,
  'DELETE is blocked on a terminal (concluido) case (guard fires on DELETE too)'
);
reset role;

-- =========================================================================
-- 10) CANCEL ANYTIME  =>  cancelado, even from a NON-settled case
-- =========================================================================
-- Build a fresh case, move one phase to ativa (em_revisao), then CANCEL — cancel
-- has no settle gate (only the terminal-freeze HC025), so it succeeds anytime.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cancel_cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Cancel')).id as cid;
reset role;
grant select on cancel_cse to authenticated;

select set_config('app.in_case_rpc', 'on', true);
update public.case_phases set status = 'ativa', activated_at = now()
  where case_id = (select cid from cancel_cse) and position = 1;
select set_config('app.in_case_rpc', 'off', true);

-- Sanity: it is em_revisao (open) before cancel.
select is(
  (select status from public.cases where id = (select cid from cancel_cse)),
  'em_revisao',
  'the cancel fixture is em_revisao (an open, non-settled case) before cancel'
);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.cancel_case((select cid from cancel_cse))).status,
  'cancelado',
  'cancel_case sets ANY non-terminal case to cancelado (no settle gate, anytime)'
);
reset role;

-- After cancel, the open phase was flipped to nao_necessaria (terminal-first).
select is(
  (select status from public.case_phases
   where case_id = (select cid from cancel_cse) and position = 1),
  'nao_necessaria',
  'cancel_case flips remaining open phases to nao_necessaria (terminal-first)'
);

-- =========================================================================
-- 11) RLS read boundary: a cross-commission member sees none of X's cases.
-- =========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.cases where id = (select cid from cse)),
  0,
  'RLS: a cross-commission member cannot read another commission''s case'
);
reset role;

select * from finish();
rollback;
