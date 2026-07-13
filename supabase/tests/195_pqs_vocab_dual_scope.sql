-- WS-3b · D7 — dual-scope PQS vocab (pqs_event_types + pqs_sentinel_criteria).
-- Migration: 20260711000500_pqs_vocab_dual_scope.sql.
--
-- The lock: this suite fails if vocab curation stops being scoped — i.e. if a
-- single-hospital PQS member can edit vocab another hospital sees, or if global vocab
-- stops being admin-only.
--
-- Covers:
--   §1 the hospital_id column + dual-scope partial uniques + the curation helper exist.
--   §2 a hospital PQS operator CAN curate its OWN hospital's vocab.
--   §3 a hospital PQS operator CANNOT curate ANOTHER hospital's vocab (42501).
--   §4 a hospital PQS operator CANNOT curate GLOBAL vocab (42501 — global is admin-only).
--   §5 platform admin CAN curate global vocab.
--   §6 dual-scope keys: the same key coexists global + per-hospital + across hospitals.
--   §7 save_triage flags only global ∪ the event's-hospital criteria.

begin;
select plan(15);

update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,     -- becomes coordinator of hosp_b (operator)
         (v->>'st_x')::uuid   as st_x,     -- plain member, NOT an operator
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- A SECOND hospital under org_b (hosp2), so we can test cross-hospital isolation.
create temp table t on commit drop as select gen_random_uuid() as hosp2;
grant select on t to authenticated;
insert into public.hospitals (id, organization_id, name, slug)
  values ((select hosp2 from t), (select org_b from k), 'Hosp Two',
          'hosp-two-' || substr((select hosp2 from t)::text,1,8));

-- Make sa_x a per-hospital nsp_coordinator of hosp_b (a PQS operator of hosp_b ONLY).
insert into public.memberships (organization_id, principal_id, role, hospital_id)
  values ((select org_b from k), (select sa_x from k), 'nsp_coordinator', (select hosp_b from k));

-- ============================================================================
-- §1: schema + helper exist
-- ============================================================================
select has_column('public', 'pqs_event_types', 'hospital_id', '1.1: pqs_event_types.hospital_id exists');
select has_column('public', 'pqs_sentinel_criteria', 'hospital_id', '1.2: pqs_sentinel_criteria.hospital_id exists');
select ok(
  exists (select 1 from pg_indexes where indexname='pqs_event_types_hospital_key_uidx')
  and exists (select 1 from pg_indexes where indexname='pqs_event_types_global_key_uidx'),
  '1.3: dual-scope partial key uniques exist (global + per-hospital)');
select has_function('app', 'can_curate_pqs_vocab', array['uuid'], '1.4: app.can_curate_pqs_vocab exists');

-- ============================================================================
-- §2: a hospital operator CAN curate its OWN hospital's vocab.
-- ============================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table made on commit drop as
  select id from public.create_event_type('own_type', 'Tipo Próprio', null, (select hosp_b from k));
reset role;
grant select on made to authenticated;
select ok((select id from made) is not null,
  '2.1: a hosp_b PQS operator CAN create a hosp_b event type');
select is(
  (select hospital_id from public.pqs_event_types where id = (select id from made)),
  (select hosp_b from k),
  '2.2: the created row is scoped to hosp_b');

-- ============================================================================
-- §3: a hospital operator CANNOT curate ANOTHER hospital's vocab.
-- ============================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_event_type('foreign_type','X',null,%L::uuid) $$, (select hosp2 from t)),
  '42501', null,
  '3.1: a hosp_b operator CANNOT create a hosp2 (other hospital) event type');
reset role;

-- ============================================================================
-- §4: a hospital operator CANNOT curate GLOBAL vocab (admin-only).
-- ============================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_event_type('global_type','X',null,null) $$,
  '42501', null,
  '4.1: a hospital operator CANNOT create GLOBAL vocab (hospital_id NULL is admin-only)');
reset role;
-- A plain member (st_x, not an operator) also cannot curate hosp_b vocab.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_event_type('x','X',null,%L::uuid) $$, (select hosp_b from k)),
  '42501', null,
  '4.2: a plain member (non-operator) CANNOT curate hosp_b vocab');
reset role;

-- ============================================================================
-- §5: platform admin CAN curate global vocab.
-- ============================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select lives_ok(
  $$ select public.create_event_type('admin_global','Global do Admin',null,null) $$,
  '5.1: platform admin CAN create GLOBAL vocab');
reset role;

-- ============================================================================
-- §6: dual-scope key coexistence — same key global + hosp_b + hosp2.
-- ============================================================================
-- Global 'dup' (admin), hosp_b 'dup' (superuser), hosp2 'dup' (superuser) all coexist.
insert into public.pqs_event_types (key, label, position, hospital_id)
  values ('dup', 'G', 1000, null),
         ('dup', 'B', 1000, (select hosp_b from k)),
         ('dup', 'T', 1000, (select hosp2 from t));
select is(
  (select count(*)::int from public.pqs_event_types where key = 'dup'),
  3,
  '6.1: the same key ''dup'' coexists global + hosp_b + hosp2 (dual-scope partial uniques)');
-- But a SECOND global 'dup' collides (global scope unique).
select throws_ok(
  $$ insert into public.pqs_event_types (key, label, position, hospital_id) values ('dup','G2',1001,null) $$,
  '23505', null,
  '6.2: a second GLOBAL ''dup'' collides (global partial unique enforced)');
-- And a second hosp_b 'dup' collides (per-hospital scope unique).
select throws_ok(
  format($$ insert into public.pqs_event_types (key, label, position, hospital_id) values ('dup','B2',1002,%L::uuid) $$,
         (select hosp_b from k)),
  '23505', null,
  '6.3: a second hosp_b ''dup'' collides (per-hospital partial unique enforced)');

-- ============================================================================
-- §7: save_triage flags ONLY global ∪ the event's-hospital criteria.
-- ============================================================================
-- An acknowledged event in comm_x (hosp_b). A global criterion + a hosp_b criterion +
-- a hosp2 criterion. save_triage with all three ids -> flags only global + hosp_b.
create temp table ev on commit drop as select gen_random_uuid() as id;
grant select on ev to authenticated;
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
values
  ((select id from ev), 'EV-D7', (select comm_x from k), current_date,
   'Evento D7', 'acknowledged', 'pqs', (select st_x from k));
create temp table crit on commit drop as
  select gen_random_uuid() as c_global, gen_random_uuid() as c_hb, gen_random_uuid() as c_h2;
grant select on crit to authenticated;
insert into public.pqs_sentinel_criteria (id, key, label, position, hospital_id) values
  ((select c_global from crit), 'sc_g', 'G', 2000, null),
  ((select c_hb from crit), 'sc_b', 'B', 2000, (select hosp_b from k)),
  ((select c_h2 from crit), 'sc_t', 'T', 2000, (select hosp2 from t));

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table _st on commit drop as select public.save_triage(
  (select id from ev), true, null, 'adverse', 'moderate', false, 'rca', 'notas',
  array[(select c_global from crit), (select c_hb from crit), (select c_h2 from crit)]) as r;
reset role;

select is(
  (select count(*)::int from public.event_triage_sentinel_flags where event_id = (select id from ev)),
  2,
  '7.1: save_triage flags exactly 2 (global + hosp_b); the hosp2 criterion is ignored');
select ok(
  not exists (select 1 from public.event_triage_sentinel_flags
             where event_id = (select id from ev) and criteria_id = (select c_h2 from crit)),
  '7.2: the cross-hospital (hosp2) criterion was NOT flagged');

select * from finish();
rollback;
