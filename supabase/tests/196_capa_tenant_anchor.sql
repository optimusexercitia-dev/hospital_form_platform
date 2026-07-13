-- WS-3c · D4/H-8 + P8 — CAPA tenant anchor.
-- Migration: 20260711000600_capa_tenant_anchor.sql · ADR 0055.
--
-- The lock: this suite fails if the CAPA tenant anchor / hospital-scoped write predicate
-- / per-hospital code sequence regresses — i.e. if a hospital-A PQS operator can write a
-- hospital-B CAPA again, or two hospitals collide on CAPA-####.
--
-- Covers:
--   §1 the anchor + per-hospital code unique + collapsed can_write_capa + derive trigger.
--   §2 CROSS-HOSPITAL WRITE DENIED: a hosp_b operator cannot UPDATE a hosp2 manual CAPA,
--      nor write its capa_action / capa_action_task, nor advance its action (42501).
--   §3 SAME-HOSPITAL WRITE ALLOWED: the hosp2 operator writes its own CAPA + action.
--   §4 EVENT-PATH UNAFFECTED: a real event-sourced CAPA write by the event's-hospital
--      operator still succeeds (confirms the can_write_capa collapse is equivalent).
--   §5 PER-HOSPITAL CODE: two CAPAs minted in different hospitals both start CAPA-0001.
--   §6 manual open_capa_plan: single-hospital operator auto-derives; a supplied hospital
--      the caller isn't an operator of raises; HC083 when it can't be resolved.

begin;
select plan(19);

update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as op_b,     -- becomes PQS operator of hosp_b ONLY
         (v->>'st_x')::uuid   as op_2,     -- becomes PQS operator of hosp2 ONLY
         (v->>'st_y')::uuid   as plain,    -- no NSP role anywhere
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- A SECOND hospital + its own commission under org_b.
create temp table t on commit drop as select gen_random_uuid() as hosp2, gen_random_uuid() as comm2;
grant select on t to authenticated;
insert into public.hospitals (id, organization_id, name, slug)
  values ((select hosp2 from t), (select org_b from k), 'Hosp Two',
          'hosp-two-' || substr((select hosp2 from t)::text,1,8));
insert into public.commissions (id, name, slug, created_by, hospital_id)
  values ((select comm2 from t), 'Comissão 2', 'comm-2-' || substr((select comm2 from t)::text,1,8),
          (select admin from k), (select hosp2 from t));

-- op_b = coordinator (operator) of hosp_b; op_2 = coordinator of hosp2. Distinct scopes.
insert into public.memberships (organization_id, principal_id, role, hospital_id) values
  ((select org_b from k), (select op_b from k), 'nsp_coordinator', (select hosp_b from k)),
  ((select org_b from k), (select op_2 from k), 'nsp_coordinator', (select hosp2 from t));

-- Manual CAPAs in each hospital (superuser inserts; derive trigger leaves manual NULL,
-- so supply hospital_id explicitly).
create temp table c on commit drop as select gen_random_uuid() as capa_b, gen_random_uuid() as capa_2;
grant select on c to authenticated;
insert into public.capa_plan (id, source, classification, status, hospital_id) values
  ((select capa_b from c), 'manual', 'corretiva', 'open', (select hosp_b from k)),
  ((select capa_2 from c), 'manual', 'corretiva', 'open', (select hosp2 from t));

-- ============================================================================
-- §1: anchor + code unique + predicate + derive trigger exist.
-- ============================================================================
select col_not_null('public', 'capa_plan', 'hospital_id', '1.1: capa_plan.hospital_id is NOT NULL');
select ok(
  exists (select 1 from pg_constraint where conname='capa_plan_hospital_code_key'
          and conrelid='public.capa_plan'::regclass and contype='u')
  and not exists (select 1 from pg_constraint where conname='capa_plan_code_key'),
  '1.2: code uniqueness is per-hospital (capa_plan_hospital_code_key; global capa_plan_code_key gone)');
select ok(
  pg_get_functiondef('app.can_write_capa(uuid,uuid)'::regprocedure) like '%is_pqs_operator_of_for%'
  and pg_get_functiondef('app.can_write_capa(uuid,uuid)'::regprocedure) not like '%is_pqs_member_of_any%',
  '1.3: can_write_capa is collapsed to the hospital-scoped predicate (no is_pqs_member_of_any)');
select ok(
  exists (select 1 from pg_trigger where tgname='derive_capa_hospital_trg'
          and tgrelid='public.capa_plan'::regclass and not tgisinternal),
  '1.4: derive_capa_hospital_trg exists');

-- ============================================================================
-- §2: CROSS-HOSPITAL WRITE DENIED — op_b cannot touch hosp2's manual CAPA tree.
-- ============================================================================
select ok(not app.can_write_capa((select capa_2 from c), (select op_b from k)),
  '2.1: can_write_capa(hosp2 CAPA, hosp_b operator) = false');

-- Direct UPDATE of the hosp2 CAPA as op_b: the capa_plan_update USING clause
-- (can_write_capa = false) makes the row INVISIBLE for update -> 0 rows affected, no
-- error (RLS denies an UPDATE by invisibility, not by raising). Assert the row is
-- UNCHANGED (the cross-hospital write did not land).
select test_helpers.claims_for((select op_b from k), false);
set local role authenticated;
update public.capa_plan set lessons_learned_md = 'FORGED' where id = (select capa_2 from c);
reset role;
select ok(
  (select lessons_learned_md from public.capa_plan where id = (select capa_2 from c)) is distinct from 'FORGED',
  '2.2: a hosp_b operator UPDATE of a hosp2 manual CAPA lands 0 rows (denied by RLS invisibility)');
-- Inserting a capa_action under the hosp2 CAPA as op_b -> RLS with-check RAISES (an
-- INSERT always evaluates WITH CHECK; no USING-invisibility escape).
select test_helpers.claims_for((select op_b from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.capa_action (capa_id, title, position, status)
            values (%L::uuid, 'x', 0, 'pending') $$,
         (select capa_2 from c)),
  '42501', null,
  '2.3: a hosp_b operator cannot insert a capa_action under a hosp2 CAPA (42501)');
reset role;

-- ============================================================================
-- §3: SAME-HOSPITAL WRITE ALLOWED — op_2 writes its own CAPA + action.
-- ============================================================================
select ok(app.can_write_capa((select capa_2 from c), (select op_2 from k)),
  '3.1: can_write_capa(hosp2 CAPA, hosp2 operator) = true');
select test_helpers.claims_for((select op_2 from k), false);
set local role authenticated;
select lives_ok(
  format($$ update public.capa_plan set lessons_learned_md = 'ok' where id = %L::uuid $$,
         (select capa_2 from c)),
  '3.2: the hosp2 operator CAN update its own CAPA (positive control)');
select lives_ok(
  format($$ insert into public.capa_action (capa_id, title, position, status)
            values (%L::uuid, 'Ação hosp2', 0, 'pending') $$,
         (select capa_2 from c)),
  '3.3: the hosp2 operator CAN insert a capa_action under its own CAPA');
reset role;

-- ============================================================================
-- §4: EVENT-PATH UNAFFECTED — a REAL event-sourced CAPA write by the event's-hospital
-- operator still succeeds (confirms the collapse is equivalent on the event path).
-- ============================================================================
-- An acknowledged event in comm_x (hosp_b); an event-sourced CAPA on it. op_b is the
-- hosp_b operator; hospital_of_event = hosp_b, so can_write_capa must be true.
create temp table ev on commit drop as select gen_random_uuid() as id, gen_random_uuid() as capa;
grant select on ev to authenticated;
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
values
  ((select id from ev), 'EV-CAPA', (select comm_x from k), current_date,
   'Evento CAPA', 'acknowledged', 'pqs', (select admin from k));
insert into public.capa_plan (id, source, source_event_id, classification, status)
  values ((select capa from ev), 'event', (select id from ev), 'corretiva', 'open');
select is(
  (select hospital_id from public.capa_plan where id = (select capa from ev)),
  (select hosp_b from k),
  '4.1: an event-sourced CAPA auto-derives hospital_id = the event''s hospital (derive trigger)');
select ok(app.can_write_capa((select capa from ev), (select op_b from k)),
  '4.2: the event''s-hospital operator CAN write the event-sourced CAPA (collapse equivalent on the event path)');
select ok(not app.can_write_capa((select capa from ev), (select op_2 from k)),
  '4.3: a DIFFERENT-hospital operator CANNOT write the event-sourced CAPA');

-- ============================================================================
-- §5: PER-HOSPITAL CODE — both CAPAs (one per hospital) start at CAPA-0001.
-- ============================================================================
select is(
  (select code from public.capa_plan where id = (select capa_b from c)),
  'CAPA-0001',
  '5.1: the hosp_b manual CAPA got CAPA-0001 (per-hospital sequence)');
select is(
  (select code from public.capa_plan where id = (select capa_2 from c)),
  'CAPA-0001',
  '5.2: the hosp2 manual CAPA ALSO got CAPA-0001 (per-hospital, no cross-hospital collision)');

-- ============================================================================
-- §6: open_capa_plan manual — single-hospital operator auto-derives.
-- ============================================================================
-- op_2 operates exactly hosp2 -> a manual open_capa_plan with no p_hospital_id
-- auto-derives hosp2.
select test_helpers.claims_for((select op_2 from k), false);
set local role authenticated;
create temp table opened on commit drop as
  select (public.open_capa_plan('manual', 'corretiva', null, null)).hospital_id as h;
reset role;
grant select on opened to authenticated;
select is(
  (select h from opened), (select hosp2 from t),
  '6.1: a single-hospital operator''s manual open_capa_plan auto-derives its hospital');

-- ============================================================================
-- §7: READ-ISOLATION LOCK (WS-3c can_read_capa change) — a MANUAL CAPA (no event)
-- resolves its scope via hospital_id, NOT event_of_capa. The own-hospital operator
-- CAN read it; a cross-hospital operator CANNOT. Locks the changed PHI read predicate
-- so a future edit can't silently broaden it (added in the WS-4 test pass).
-- ============================================================================
select ok(app.can_read_capa((select capa_2 from c), (select op_2 from k)),
  '7.1: the hosp2 operator CAN read the hosp2 manual CAPA (can_read_capa via hospital_id)');
select ok(not app.can_read_capa((select capa_2 from c), (select op_b from k)),
  '7.2: a hosp_b operator CANNOT read the hosp2 manual CAPA (read isolation across hospitals)');
select ok(not app.can_read_capa((select capa_2 from c), (select plain from k)),
  '7.3: a non-operator CANNOT read a manual CAPA at all');

select * from finish();
rollback;
