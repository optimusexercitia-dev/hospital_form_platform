-- Phase 14a: Patient-Safety / NSP — Event Intake & Hand-off. ADR 0030/0031.
-- Covers: per-NSP event-code minting (EV-0001, EV-0002…); the lifecycle state
-- machine + freeze guard (HC043); HC044 not-the-current-custodian; the
-- access-follows-custody RLS via app.can_read_event (custodian/reporting/PQS yes,
-- foreign no — BEFORE and AFTER a custody transfer); custody ledger append-only
-- (no DELETE, no double-close, no other-column edit — HC043); PHI isolation
-- (pqs_inbox + the event SELECT expose NO patient identifiers; event_patient is a
-- separate table); the patient_safety flag-gate; mutation-audit rows written with
-- PHI-FREE metadata (event status diff carries no description_md/title; the
-- event_patient.updated row carries NO identifier).
--
-- NOTE: the PHI `.read` audit row is emitted by the QUERY LAYER (getEventPatient,
-- B5) — RLS/triggers cannot see a read — so it is asserted by the Playwright gate
-- (T1), not here. This file asserts every DB-side guarantee.

begin;
select plan(35);

-- Enable the flag for the whole test (it ships ON in-phase, but a hermetic test
-- must not depend on migration order).
update app.feature_flags set enabled = true where key = 'patient_safety';
-- The audit trail must be ON too (we assert PHI-free mutation-audit rows).
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y
  from ctx;
grant select on k to authenticated;

-- A case in comm_x (for the case-linked notify path + the case_events assertion).
create temp table cs on commit drop as select gen_random_uuid() as case_x;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select case_x from cs), (select comm_x from k), 9101, 'Caso X', (select sa_x from k));

-- The event code is minted from a GLOBAL (per-NSP) counter, and the seed pre-loads
-- sample events — so capture the current max EV-#### suffix as a BASELINE and assert
-- the two minted codes are baseline+1 / baseline+2 (robust to the seed, not a clean
-- EV-0001 assumption).
create temp table base on commit drop as
  select coalesce(
    (select max((substring(code from 4))::integer)
     from public.patient_safety_event where code ~ '^EV-[0-9]+$'),
    0) as n;
grant select on base to authenticated;

-- =========================================================================
-- notify_safety_event: ANY member of the reporting commission (just-culture) +
-- per-NSP code minting + the initial PQS custody interval + the case_events row.
-- =========================================================================
-- A plain staff member (st_x) of comm_x CAN file (just-culture exception).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table e1 on commit drop as
  select * from public.notify_safety_event(
    (select comm_x from k), 'Queda de paciente', 'Narrativa clínica…', 'moderate',
    (select case_x from cs), null, 'UTI Adulto', current_date);
reset role;
grant select on e1 to authenticated;

select is((select code from e1),
  'EV-' || lpad(((select n from base) + 1)::text, 4, '0'),
  'first minted event code = baseline+1 (per-NSP global counter)');
select is((select status from e1), 'reported', 'new event starts reported');
select is((select current_owner_kind from e1), 'pqs',
  'new event is held by the NSP (current_owner_kind = pqs)');
select is(
  (select count(*)::int from public.event_custody
   where event_id = (select id from e1) and held_until is null and owner_kind = 'pqs'),
  1, 'notify opens exactly one open PQS custody interval');
select is(
  (select count(*)::int from public.case_events
   where case_id = (select case_x from cs) and kind = 'safety_event'),
  1, 'case-linked notify writes exactly one case_events kind=safety_event row');

-- A second event mints EV-0002 (per-NSP global counter).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table e2 on commit drop as
  select * from public.notify_safety_event(
    (select comm_x from k), 'Erro de medicação', null, 'mild', null, null, null, null);
reset role;
grant select on e2 to authenticated;
select is((select code from e2),
  'EV-' || lpad(((select n from base) + 2)::text, 4, '0'),
  'second minted event code = baseline+2 (global counter increments)');

-- A non-member (sa_y) cannot file on comm_x.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.notify_safety_event((select comm_x from k), 'cross', null, 'unknown', null, null, null, null) $$,
  '42501', null, 'a non-member cannot notify an event for that commission');
reset role;

-- =========================================================================
-- Access-follows-custody (BEFORE any transfer): a PQS-held event is readable by
-- the reporting committee (provenance) + admin/PQS; a foreign committee sees none.
-- =========================================================================
-- st_x (reporting committee member): reads e1.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.patient_safety_event where id = (select id from e1)),
  1, 'reporting-committee member reads the PQS-held event (provenance)');
reset role;

-- sa_y (foreign committee): reads nothing.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.patient_safety_event where id = (select id from e1)),
  0, 'foreign-committee member reads 0 (access-follows-custody)');
reset role;

-- admin (PQS today): reads e1.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is(
  (select count(*)::int from public.patient_safety_event where id = (select id from e1)),
  1, 'admin/PQS reads the event');
reset role;

-- =========================================================================
-- HC044: a reporting-committee plain member who is NOT the custodian cannot
-- acknowledge (custody actions require the custodian; the NSP/admin holds it).
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.acknowledge_event((select id from e1)) $$,
  'HC044', null, 'a non-custodian reporting member cannot acknowledge (HC044)');
reset role;

-- The NSP (admin) acknowledges.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.acknowledge_event((select id from e1));
reset role;
select is((select status from public.patient_safety_event where id = (select id from e1)),
  'acknowledged', 'NSP acknowledges: reported -> acknowledged');
select isnt((select acknowledged_at from public.patient_safety_event where id = (select id from e1)),
  null, 'acknowledge stamps acknowledged_at');

-- =========================================================================
-- State machine (HC043): an out-of-order transition is rejected. Acknowledging an
-- already-acknowledged event fails.
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.acknowledge_event((select id from e1)) $$,
  'HC043', null, 'acknowledging an already-acknowledged event is rejected (HC043)');
reset role;

-- A DIRECT status UPDATE outside the RPC flag is rejected by the guard (HC043).
-- Run as the TABLE OWNER (no `set role authenticated`) so RLS does not filter the
-- write to 0 rows — the guard's RAISE is what we are asserting fires (mirror the
-- audit-guard owner test in 130_audit.sql). For ordinary clients the absence of an
-- UPDATE/DELETE policy ALSO blocks the write (defense in depth, proven elsewhere).
select throws_ok(
  $$ update public.patient_safety_event set status = 'closed' where id = (select id from e1) $$,
  'HC043', null, 'a direct status UPDATE outside the RPC flag is rejected by the guard (HC043)');

-- =========================================================================
-- Custody transfer: NSP -> comm_x. The new holder (comm_x) gains custodian access,
-- the reporting committee keeps provenance, a foreign committee still sees nothing.
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.transfer_event_custody((select id from e1), 'commission', (select comm_x from k), 'Devolvido à comissão');
reset role;

select is((select current_owner_kind from public.patient_safety_event where id = (select id from e1)),
  'commission', 'transfer updates the denormalized owner kind');
select is((select current_owner_commission_id from public.patient_safety_event where id = (select id from e1)),
  (select comm_x from k), 'transfer updates the denormalized owner commission');
select is(
  (select count(*)::int from public.event_custody where event_id = (select id from e1)),
  2, 'transfer appends a second custody interval (history preserved)');
select is(
  (select count(*)::int from public.event_custody
   where event_id = (select id from e1) and held_until is null),
  1, 'exactly one open custody interval after the transfer');

-- sa_x (now the custodian commission's staff_admin) can act (custodian).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.update_event((select id from e1), 'Queda de paciente (rev.)', null, 'moderate', null, null, null) $$,
  'the new custodian-commission staff_admin can edit the event');
reset role;

-- sa_y (foreign) STILL sees nothing after the transfer.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.patient_safety_event where id = (select id from e1)),
  0, 'foreign committee still reads 0 after a transfer (no leakage)');
reset role;

-- =========================================================================
-- Custody ledger is APPEND-ONLY (HC043): no DELETE, no double-close, no other-col edit.
-- These run as the TABLE OWNER so the guard's RAISE fires (RLS would otherwise filter
-- a non-owner write to 0 rows). The guard is ABSOLUTE — even the owner cannot rewrite
-- history (the only escape is the held_until close, asserted via transfer above).
-- =========================================================================
-- A closed interval cannot be altered.
select throws_ok(
  $$ update public.event_custody set note = 'rewrite'
     where event_id = (select id from e1) and held_until is not null $$,
  'HC043', null, 'a closed custody interval cannot be altered (HC043)');
-- An open interval cannot have a non-held_until column changed directly.
select throws_ok(
  $$ update public.event_custody set note = 'rewrite'
     where event_id = (select id from e1) and held_until is null $$,
  'HC043', null, 'a custody row cannot be edited outside the close (HC043)');
-- A custody row cannot be deleted.
select throws_ok(
  $$ delete from public.event_custody where event_id = (select id from e1) $$,
  'HC043', null, 'custody rows cannot be deleted (append-only, HC043)');

-- =========================================================================
-- PHI isolation: the event SELECT + pqs_inbox expose NO patient identifiers; PHI
-- lives ONLY on event_patient (a separate table), readable in the same scope.
-- =========================================================================
-- Write PHI (custodian = sa_x of comm_x now).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_event_patient((select id from e1), 'Fulano de Tal', 'MRN-12345',
  '1980-01-01'::date, null, 'male', 'ENC-9', 'UTI', 'Dra. Beltrana');
reset role;

-- The event table has NO identifier columns (structural isolation).
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'patient_safety_event'
     and column_name in ('name', 'mrn', 'date_of_birth', 'encounter_ref', 'attending')),
  0, 'PHI isolation: patient_safety_event has NO identifier columns');

-- pqs_inbox returns governance metadata only — assert via the function's declared
-- OUT columns (pg_get_function_identity_arguments + the return-type record): no
-- identifier name appears. (A RETURNS TABLE fn is not in information_schema.columns,
-- so we inspect pg_proc.proargnames — which lists the OUT/TABLE column names.)
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select ok(
  not exists (
    select 1 from unnest(
      (select proargnames from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'pqs_inbox')
    ) as n(col)
    where n.col in ('name', 'mrn', 'date_of_birth', 'encounter_ref', 'attending', 'sex', 'age_years')
  ),
  'pqs_inbox exposes NO patient-identifier output column (PHI-free queue)');
-- The inbox actually returns the open events for the PQS caller.
select cmp_ok(
  (select count(*)::int from public.pqs_inbox(null, null, null)),
  '>=', 1, 'pqs_inbox returns the open events to a PQS member');
reset role;

-- A foreign committee can read e1's PHI? No — same access scope (0 rows).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.event_patient where event_id = (select id from e1)),
  0, 'PHI: a foreign committee reads 0 event_patient rows (tightest scope)');
reset role;

-- The reporting/custodian committee CAN read the PHI row.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.event_patient where event_id = (select id from e1)),
  1, 'PHI: the custodian/reporting committee reads its event_patient row');
reset role;

-- =========================================================================
-- Mutation-audit: PHI-FREE metadata. The event status diff carries no free text;
-- the event_patient.updated row carries NO identifier.
-- =========================================================================
-- The event chain has rows but none copy description_md / title / identifiers.
select ok(
  not exists (
    select 1 from public.audit_log
    where entity_type in ('safety_event', 'event_custody', 'event_patient')
      and (metadata ? 'description_md' or metadata ? 'title' or metadata ? 'name'
           or metadata ? 'mrn' or metadata ? 'encounter_ref'
           or metadata::text ilike '%Fulano%' or metadata::text ilike '%MRN-12345%')
  ),
  'audit metadata carries NO PHI / description_md / title (Rule 11/12)');
-- The event_patient.updated row exists and its metadata is empty (identifier-free).
select is(
  (select metadata::text from public.audit_log
   where action = 'event_patient.updated' and entity_id = (select id from e1)
   order by seq desc limit 1),
  '{}', 'event_patient.updated audit row carries empty (identifier-free) metadata');

-- =========================================================================
-- QA fix M1: public.pqs_department has an explicit SELECT policy (Architecture
-- Rule 1) — the non-PHI singleton NSP config is readable by any authenticated
-- member; anon is excluded (no base GRANT). 14b reads rca_default_due_days directly,
-- so a deny-by-default would silently break it.
-- =========================================================================
-- (a) a SELECT policy exists on pqs_department.
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'pqs_department' and cmd = 'SELECT'),
  1, 'pqs_department has exactly one SELECT policy (Rule 1: explicit policy)');
-- (b) an authenticated member CAN read the singleton row.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.pqs_department),
  1, 'an authenticated member reads the pqs_department singleton');
reset role;
-- (c) anon CANNOT read pqs_department (no base GRANT — denied before RLS; the
-- policy is `to authenticated`, so anon is excluded by construction).
select ok(
  not has_table_privilege('anon', 'public.pqs_department', 'SELECT'),
  'anon cannot SELECT pqs_department (excluded from the authenticated-only policy)');

-- =========================================================================
-- Flag-gate: with patient_safety OFF, the RPCs raise feature-unavailable (23514).
-- =========================================================================
update app.feature_flags set enabled = false where key = 'patient_safety';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.notify_safety_event((select comm_x from k), 'gated', null, 'unknown', null, null, null, null) $$,
  '23514', null, 'with patient_safety OFF, notify_safety_event is gated (23514)');
reset role;
update app.feature_flags set enabled = true where key = 'patient_safety';

select * from finish();
rollback;
