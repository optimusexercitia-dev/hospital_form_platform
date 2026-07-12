-- pgTAP — F-cleanup · D11 · G2: case_narratives.status + indicator_measurements.status.
-- Migration 20260719000400. NEG = old pt-BR key rejected (absent from the CHECK def);
-- POS = new English key accepted (present) + is the default. Functional transition
-- coverage: 116_case_narratives / 110_indicators / 144 / 183 / 197 stay green on reset.
-- Assertion count: 6

begin;
select plan(6);

-- #3 case_narratives.status: open / completed
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_narratives_status_check')
    like '%completed%',
  'G2: case_narratives CHECK accepts ''completed''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_narratives_status_check')
    not like '%aberta%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'case_narratives_status_check')
    not like '%concluida%',
  'G2: case_narratives CHECK no longer lists pt-BR keys (aberta/concluida)');
select col_default_is('public', 'case_narratives', 'status', 'open',
  'G2: case_narratives.status default = ''open''');

-- #4 indicator_measurements.status: on_target / off_target / no_data
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'indicator_measurements_status_check')
    like '%no_data%',
  'G2: indicator_measurements CHECK accepts ''no_data''');
select ok(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'indicator_measurements_status_check')
    not like '%sem_dados%'
  and (select pg_get_constraintdef(oid) from pg_constraint where conname = 'indicator_measurements_status_check')
    not like '%na_meta%',
  'G2: indicator_measurements CHECK no longer lists pt-BR keys (na_meta/sem_dados)');
select col_default_is('public', 'indicator_measurements', 'status', 'no_data',
  'G2: indicator_measurements.status default = ''no_data''');

select * from finish();
rollback;
