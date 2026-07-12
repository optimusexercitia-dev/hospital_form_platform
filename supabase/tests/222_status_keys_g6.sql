-- pgTAP — F-cleanup · D11 · G6 (FINAL): cases.status + case_phases.status.
-- Migration 20260719000800. NEG = old pt-BR key rejected (absent from the CHECK def);
-- POS = new English key accepted (present) + is the column default. The cases terminal
-- gate (cases_closed_at_paired) is re-anglicized, and app.recompute_case_status (which
-- derives cases.status FROM case_phases.status) is proven to speak English. Full
-- recompute-yields-right-terminal-state coverage lives in 110_case_status / 90_cases —
-- they stay green on the same reset.
-- Assertion count: 8

begin;
select plan(8);

-- #11 cases.status: not_started / pending / in_review / completed / cancelled
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cases_status_check')
    like '%in_review%',
  'G6: cases CHECK accepts ''in_review''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cases_status_check')
    not like '%nao_iniciado%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cases_status_check')
    not like '%em_revisao%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cases_status_check')
    not like '%concluido%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cases_status_check')
    not like '%cancelado%',
  'G6: cases CHECK no longer lists pt-BR keys (nao_iniciado/em_revisao/concluido/cancelado)');
select col_default_is('public', 'cases', 'status', 'not_started',
  'G6: cases.status default = ''not_started''');

-- The terminal gate (cases_closed_at_paired) references the ENGLISH terminal keys.
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cases_closed_at_paired')
    like '%completed%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cases_closed_at_paired')
    like '%cancelled%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cases_closed_at_paired')
    not like '%concluido%',
  'G6: cases_closed_at_paired terminal gate is anglicized (completed/cancelled)');

-- #12 case_phases.status: pending / active / completed / not_required
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_phases_status_check')
    like '%not_required%',
  'G6: case_phases CHECK accepts ''not_required''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_phases_status_check')
    not like '%pendente%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_phases_status_check')
    not like '%ativa%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_phases_status_check')
    not like '%concluida%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_phases_status_check')
    not like '%nao_necessaria%',
  'G6: case_phases CHECK no longer lists pt-BR keys (pendente/ativa/concluida/nao_necessaria)');
select col_default_is('public', 'case_phases', 'status', 'pending',
  'G6: case_phases.status default = ''pending''');

-- The cases.status recompute (FROM case_phases.status) speaks English: the rewritten
-- app.recompute_case_status references the new phase/case keys and none of the old ones.
select ok(
  (select pg_get_functiondef(oid) from pg_proc where proname = 'recompute_case_status') ~ 'active'
  and (select pg_get_functiondef(oid) from pg_proc where proname = 'recompute_case_status') ~ 'completed'
  and (select pg_get_functiondef(oid) from pg_proc where proname = 'recompute_case_status') !~ 'ativa'
  and (select pg_get_functiondef(oid) from pg_proc where proname = 'recompute_case_status') !~ 'concluid',
  'G6: recompute_case_status derives cases.status from case_phases.status with English keys');

select * from finish();
rollback;
