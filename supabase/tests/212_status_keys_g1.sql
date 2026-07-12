-- pgTAP — F-cleanup · D11 · G1: status-key anglicization (indicators.status +
-- meeting_attendees.attendance). Migration 20260719000300.
-- NEG = the old pt-BR key is rejected by the CHECK (absent from the constraint def);
-- POS = the new English key is accepted (present in the def) + is the column default.
-- Functional transition coverage: the full 110_indicators / 120_meetings / 181 / 204 /
-- 206 suites (fixtures anglicized in the same migration) must stay green on reset.
--
-- Assertion count: 6

begin;
select plan(6);

-- #1 indicators.status: active / archived
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'indicators_status_check')
    like '%active%',
  'G1: indicators_status_check accepts the new key ''active''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'indicators_status_check')
    not like '%ativo%',
  'G1: indicators_status_check no longer lists the pt-BR key ''ativo''');
select col_default_is('public', 'indicators', 'status', 'active',
  'G1: indicators.status default = ''active''');

-- #2 meeting_attendees.attendance: summoned / present / absent / excused
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'meeting_attendees_attendance_check')
    like '%present%',
  'G1: attendance CHECK accepts the new key ''present''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'meeting_attendees_attendance_check')
    not like '%convocado%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'meeting_attendees_attendance_check')
    not like '%presente%',
  'G1: attendance CHECK no longer lists the pt-BR keys (convocado/presente)');
select col_default_is('public', 'meeting_attendees', 'attendance', 'summoned',
  'G1: meeting_attendees.attendance default = ''summoned''');

select * from finish();
rollback;
