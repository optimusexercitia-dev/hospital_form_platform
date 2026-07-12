-- WS-3b · Schema-integrity — D1 (delete-path RESTRICT), D6-flip, D9 (lifecycle CHECKs).
-- Migration: 20260711000300_schema_integrity_checks.sql.
--
-- The lock: this suite fails if a SET NULL × shape-CHECK booby-trap returns, if the
-- input-vs-display CHECK's ELSE arm goes back to NULL (silently passing unlisted types),
-- or if a lifecycle-state invariant is dropped.
--
-- Covers:
--   §1 D1 — DELETING a (deletable) event with an RCA + CAPA raises a CLEAN 23503
--           (foreign_key_violation, RESTRICT), NOT an opaque check_violation; a plain
--           event with no RCA/CAPA deletes cleanly.
--   §2 D6 — an unlisted item_type FAILS the input-vs-display CHECK (ELSE false). Tested
--           at the data level by dropping the twin item_type CHECK in-txn so the bogus
--           type reaches the input_vs_display CASE's ELSE arm.
--   §3 D9 — each impossible lifecycle state raises.

begin;
select plan(10);

update app.feature_flags set enabled = true where key = 'patient_safety';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid as admin, (v->>'st_x')::uuid as st_x,
         (v->>'sec_u')::uuid as sec_u, (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- ============================================================================
-- §1: D1 — the delete-path booby-trap is now a CLEAN RESTRICT (23503).
-- ============================================================================
-- (1a) A deletable (acknowledged) event with an RCA + a CAPA(source='rca') attached
-- (superuser inserts, bypassing the RPC gates). Deleting the event cascades to the RCA
-- (rca_event_id_fkey CASCADE); the RCA delete is then BLOCKED by capa_plan.source_rca_id
-- (now ON DELETE RESTRICT) -> the whole delete aborts with 23503, cleanly.
create temp table ev on commit drop as select gen_random_uuid() as id;
grant select on ev to authenticated;
create temp table r on commit drop as select gen_random_uuid() as id;
grant select on r to authenticated;

insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
values
  ((select id from ev), 'EV-D1-A', (select comm_x from k), current_date,
   'Evento D1', 'acknowledged', 'pqs', (select st_x from k));
insert into public.rca (id, event_id, status) values ((select id from r), (select id from ev), 'draft');
insert into public.capa_plan (code, source, source_rca_id, classification, status)
  values ('CAPA-D1-A', 'rca', (select id from r), 'corretiva', 'open');

select throws_ok(
  format($$ delete from public.patient_safety_event where id = %L::uuid $$, (select id from ev)),
  '23503', null,
  '1.1: deleting an event whose RCA has a CAPA raises a CLEAN 23503 (RESTRICT, not an opaque check_violation)');

-- (1b) positive control: a plain deletable event with NO RCA/CAPA deletes cleanly.
create temp table ev2 on commit drop as select gen_random_uuid() as id;
grant select on ev2 to authenticated;
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
values
  ((select id from ev2), 'EV-D1-B', (select comm_x from k), current_date,
   'Evento D1 sem RCA', 'acknowledged', 'pqs', (select st_x from k));
select lives_ok(
  format($$ delete from public.patient_safety_event where id = %L::uuid $$, (select id from ev2)),
  '1.2: a plain event with no RCA/CAPA deletes cleanly (positive control)');

-- (1c) the 6 FKs are RESTRICT (confdeltype 'r').
select is(
  (select count(*)::int from pg_constraint
   where conname in ('capa_plan_source_rca_id_fkey','capa_plan_source_event_id_fkey',
                     'capa_plan_source_meeting_id_fkey','rca_evidence_cited_interview_id_fkey',
                     'rca_evidence_cited_meeting_id_fkey','rca_evidence_cited_document_id_fkey')
     and confdeltype = 'r'),
  6,
  '1.3: all 6 shape-checked source/cited FKs are ON DELETE RESTRICT');

-- ============================================================================
-- §2: D6-flip — an unlisted item_type FAILS the input-vs-display CHECK (ELSE false).
-- The twin form_items_item_type_check would otherwise reject the bogus type first; drop
-- it INSIDE this transaction (rolled back) so the bogus type reaches the input_vs_display
-- CASE's ELSE arm. A row that would satisfy the ELSE=NULL (old) but must fail ELSE=false.
-- ============================================================================
savepoint before_drop_twin;
alter table public.form_items drop constraint form_items_item_type_check;
-- A bogus item_type with input-shaped columns: under ELSE NULL this passed (NULL =
-- satisfied); under ELSE false it must now RAISE (23514).
select throws_ok(
  format($$ insert into public.form_items (section_id, position, item_type, question_key, label, required)
            values (%L::uuid, 99, 'bogus_type', 'qk_bogus', 'L', false) $$,
         (select sec_u from k)),
  '23514', null,
  '2.1: an unlisted item_type now FAILS the input-vs-display CHECK (ELSE false, was silently passing)');
rollback to savepoint before_drop_twin;  -- restore the twin CHECK

-- Confirm the constraint text is ELSE false (belt: the data test above is the real proof).
select ok(
  pg_get_constraintdef((select oid from pg_constraint where conname='form_items_input_vs_display'))
    like '%ELSE false%',
  '2.2: form_items_input_vs_display ends ELSE false (not ELSE NULL::boolean)');

-- ============================================================================
-- §3: D9 — lifecycle-state CHECKs reject each impossible state.
-- ============================================================================
-- (3a) responses: submitted + null submitted_at.
select throws_ok(
  format($$ insert into public.responses (form_version_id, commission_id, created_by, status, submitted_at)
            select form_version_id, %L::uuid, %L::uuid, 'submitted', null
            from public.form_sections where id = %L::uuid $$,
         (select comm_x from k), (select st_x from k), (select sec_u from k)),
  '23514', null,
  '3.1: responses status=submitted with NULL submitted_at raises (23514)');

-- (3b) cases: concluido + null closed_at.
select throws_ok(
  format($$ insert into public.cases (commission_id, case_number, status, closed_at, created_by)
            values (%L::uuid, 99001, 'completed', null, %L::uuid) $$,
         (select comm_x from k), (select st_x from k)),
  '23514', null,
  '3.2: cases status=concluido with NULL closed_at raises (23514)');

-- (3c) cases: cancelado + null closed_at.
select throws_ok(
  format($$ insert into public.cases (commission_id, case_number, status, closed_at, created_by)
            values (%L::uuid, 99002, 'cancelled', null, %L::uuid) $$,
         (select comm_x from k), (select st_x from k)),
  '23514', null,
  '3.3: cases status=cancelado with NULL closed_at raises (23514)');

-- (3d) cases: a valid terminal case (concluido + closed_at set) is accepted.
select lives_ok(
  format($$ insert into public.cases (commission_id, case_number, status, closed_at, created_by)
            values (%L::uuid, 99003, 'completed', now(), %L::uuid) $$,
         (select comm_x from k), (select st_x from k)),
  '3.4: a terminal case WITH closed_at is accepted (positive control)');

-- (3e) responses: a valid submitted response (submitted_at set) is accepted.
select lives_ok(
  format($$ insert into public.responses (form_version_id, commission_id, created_by, status, submitted_at)
            select form_version_id, %L::uuid, %L::uuid, 'submitted', now()
            from public.form_sections where id = %L::uuid $$,
         (select comm_x from k), (select st_x from k), (select sec_u from k)),
  '3.5: a submitted response WITH submitted_at is accepted (positive control)');

select * from finish();
rollback;
