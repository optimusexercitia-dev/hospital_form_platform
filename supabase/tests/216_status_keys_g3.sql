-- pgTAP — F-cleanup · D11 · G3: capa_action.status + case_interviews.status + capa_plan.status.
-- Migration 20260719000500. NEG = old pt-BR key rejected (absent from the CHECK def);
-- POS = new English key accepted (present) + is the column default. Functional transition
-- coverage (every RPC/guard still moves state with English keys) lives in 143_capa /
-- 121_interviews / 196_capa_tenant_anchor — they stay green on the same reset.
-- Assertion count: 9

begin;
select plan(9);

-- #5 capa_action.status: pending / in_progress / completed / cancelled
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'capa_action_status_check')
    like '%in_progress%',
  'G3: capa_action CHECK accepts ''in_progress''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'capa_action_status_check')
    not like '%pendente%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'capa_action_status_check')
    not like '%em_andamento%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'capa_action_status_check')
    not like '%concluida%',
  'G3: capa_action CHECK no longer lists pt-BR keys (pendente/em_andamento/concluida/cancelada)');
select col_default_is('public', 'capa_action', 'status', 'pending',
  'G3: capa_action.status default = ''pending''');

-- #6 case_interviews.status: draft / scheduled / in_progress / completed / cancelled
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_interviews_status_check')
    like '%scheduled%',
  'G3: case_interviews CHECK accepts ''scheduled''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_interviews_status_check')
    not like '%rascunho%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_interviews_status_check')
    not like '%agendada%',
  'G3: case_interviews CHECK no longer lists pt-BR keys (rascunho/agendada/…)');
select col_default_is('public', 'case_interviews', 'status', 'draft',
  'G3: case_interviews.status default = ''draft''');

-- #7 capa_plan.status: open / in_execution / in_verification / completed / cancelled
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'capa_plan_status_check')
    like '%in_verification%',
  'G3: capa_plan CHECK accepts ''in_verification''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'capa_plan_status_check')
    not like '%aberto%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'capa_plan_status_check')
    not like '%em_execucao%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'capa_plan_status_check')
    not like '%concluido%',
  'G3: capa_plan CHECK no longer lists pt-BR keys (aberto/em_execucao/concluido/cancelado)');
select col_default_is('public', 'capa_plan', 'status', 'open',
  'G3: capa_plan.status default = ''open''');

select * from finish();
rollback;
