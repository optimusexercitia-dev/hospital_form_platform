-- pgTAP — F-cleanup · D11 · G5: case_referral.status + meetings.status.
-- Migration 20260719000700. NEG = old pt-BR key rejected (absent from the CHECK def);
-- POS = new English key accepted (present) + is the column default. Functional transition
-- coverage (referral 8-state chain draft→sent→…→completed/withdrawn; meeting 6-state
-- chain scheduled→held→in_signature→signed→distributed, cancel) lives in 150_referrals /
-- 120_meetings / 206_meeting_held_time — they stay green on the same reset. `concluida`
-- (referral) is converted while case_phases keeps its own `concluida` until G6.
-- Assertion count: 6

begin;
select plan(6);

-- #9 case_referral.status: draft / sent / received / accepted / rejected / in_review / completed / withdrawn
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_referral_status_check')
    like '%in_review%',
  'G5: case_referral CHECK accepts ''in_review''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_referral_status_check')
    not like '%rascunho%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_referral_status_check')
    not like '%enviada%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_referral_status_check')
    not like '%em_analise%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_referral_status_check')
    not like '%concluida%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_referral_status_check')
    not like '%retirada%',
  'G5: case_referral CHECK no longer lists pt-BR keys (rascunho/enviada/…/concluida/retirada)');
select col_default_is('public', 'case_referral', 'status', 'draft',
  'G5: case_referral.status default = ''draft''');

-- #10 meetings.status: scheduled / held / in_signature / signed / distributed / cancelled
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'meetings_status_check')
    like '%in_signature%',
  'G5: meetings CHECK accepts ''in_signature''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'meetings_status_check')
    not like '%agendada%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'meetings_status_check')
    not like '%realizada%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'meetings_status_check')
    not like '%assinada%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'meetings_status_check')
    not like '%cancelada%',
  'G5: meetings CHECK no longer lists pt-BR keys (agendada/realizada/assinada/cancelada/…)');
select col_default_is('public', 'meetings', 'status', 'scheduled',
  'G5: meetings.status default = ''scheduled''');

select * from finish();
rollback;
