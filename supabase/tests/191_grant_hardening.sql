-- WS-2 · Grant hardening (C-1, C-2, C-4).
-- Migration: 20260711000100_grant_hardening.sql · ADR 0053 (C-4).
--
-- The lock: this suite fails if audit_log becomes client-writable again (C-1), if the
-- blanket authenticated default privilege comes back (C-2), or if the log_audit_access
-- entitlement guard is weakened / an allow-listed action loses its dispatch arm (C-4).
--
-- Covers:
--   §1 C-1: authenticated INSERT/UPDATE/DELETE/TRUNCATE on audit_log all raise; SELECT
--           works; a DEFINER door (audit_write via an instrumented mutation) still writes.
--   §2 C-2: a freshly-created public table has NO authenticated privilege until granted;
--           service_role keeps the default.
--   §3 C-4: a member of commission A calling log_audit_access with a commission-B entity
--           raises 42501; the entitled entity-scoped + export + PHI-door paths still emit;
--           allow-list ⊆ dispatch map (completeness); auth.uid() resolves in the DEFINER
--           helper (entitled passes / unentitled fails, empirically).

begin;
-- 26 → 27: S2 rewrote §4 (the verb left the registry — FINDING 1a) and added
-- the zero-mint pin 3.15.
select plan(27);

-- HARD REQUIREMENT (QA-B-1): the C-4 PHI-door + .viewed assertions need these flags
-- (audit_write early-returns without audit_trail; the PHI doors gate on patient_safety).
-- F2 §4 adds the attachment.read pair: `meetings` is needed for the create_meeting
-- fixture (the attachment owner). attachment.read itself is not flag-gated.
update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';
update app.feature_flags set enabled = true where key = 'meetings';

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
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- ============================================================================
-- §1: C-1 — audit_log is not client-writable; TRUNCATE guarded; SELECT + DEFINER
--     write intact.
-- ============================================================================
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'INSERT'),
  '1.1: authenticated has NO INSERT grant on audit_log');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE'),
  '1.2: authenticated has NO UPDATE grant on audit_log');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'DELETE'),
  '1.3: authenticated has NO DELETE grant on audit_log');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE'),
  '1.4: authenticated has NO TRUNCATE grant on audit_log');
select ok(has_table_privilege('authenticated', 'public.audit_log', 'SELECT'),
  '1.5: authenticated KEEPS SELECT on audit_log (read path intact)');

-- A direct INSERT as authenticated is rejected (no grant → 42501).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ insert into public.audit_log (action, entity_type, seq, prev_hash, row_hash)
     values ('forged', 'x', 1, null, 'deadbeef') $$,
  '42501', null,
  '1.6: authenticated direct INSERT into audit_log rejected (permission denied)');
reset role;

-- TRUNCATE is guarded even for a superuser (grant-exempt) by the statement-level
-- BEFORE TRUNCATE trigger → HC042. This proves the guard, not just the revoke.
select throws_ok(
  $$ truncate table public.audit_log $$,
  'HC042', null,
  '1.7: TRUNCATE audit_log raises HC042 (statement-level immutability guard)');

-- A DEFINER path (audit_write via an instrumented mutation) still writes: change an
-- existing comm_x member's role as superuser → the trg_audit_memberships UPDATE
-- arm emits a membership.role_changed row. (Do NOT add a persona to comm_x here
-- — st_y must stay a comm_y-only outsider for the §3.2 forgery test.)
create temp table ac1 on commit drop as
  select count(*)::int as before from public.audit_log where commission_id = (select comm_x from k);
grant select on ac1 to authenticated;
update public.memberships set role = 'staff_admin'
  where commission_id = (select comm_x from k) and principal_id = (select st_x from k);
select ok(
  (select count(*)::int from public.audit_log where commission_id = (select comm_x from k)) > (select before from ac1),
  '1.8: audit_write (DEFINER) still inserts via an instrumented mutation (role_changed)');

-- ============================================================================
-- §2: C-2 — the blanket authenticated default privilege is gone; a fresh public
--     table has no authenticated privilege until explicitly granted.
-- ============================================================================
create table public._ws2_fresh_table (id uuid primary key default gen_random_uuid());
select ok(not has_table_privilege('authenticated', 'public._ws2_fresh_table', 'SELECT'),
  '2.1: a freshly-created public table gives authenticated NO SELECT (default flipped)');
select ok(not has_table_privilege('authenticated', 'public._ws2_fresh_table', 'INSERT'),
  '2.2: a freshly-created public table gives authenticated NO INSERT');
-- service_role keeps its default (the flip only revoked authenticated).
select ok(has_table_privilege('service_role', 'public._ws2_fresh_table', 'SELECT'),
  '2.3: service_role KEEPS the default grant on a fresh table');
-- An explicit grant still works (the per-object grant path going forward).
grant select on public._ws2_fresh_table to authenticated;
select ok(has_table_privilege('authenticated', 'public._ws2_fresh_table', 'SELECT'),
  '2.4: an explicit GRANT still confers the privilege (per-object path)');
drop table public._ws2_fresh_table;

-- ============================================================================
-- §3: C-4 — the log_audit_access entitlement guard.
-- ============================================================================
-- Set up an event in comm_x, PQS-held, with a PHI row; enroll `admin` as a per-hospital
-- PQS operator (the entitled PHI reader). st_x2 is a plain comm_x member (broad reader,
-- NOT PHI). st_y is a plain comm_y member with ZERO relationship to comm_x (the forger).
create temp table ev on commit drop as select gen_random_uuid() as id;
grant select on ev to authenticated;
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status,
   current_owner_kind, current_owner_commission_id, reported_by)
values
  ((select id from ev), 'EV-WS2-A', (select comm_x from k), current_date,
   'Evento WS-2', 'acknowledged', 'pqs', null, (select st_x from k));
insert into public.event_patient (event_id, name, mrn, sex)
  values ((select id from ev), 'Paciente WS2', 'MRN-WS2', 'female');
update public.patient_safety_event set has_patient = true where id = (select id from ev);
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
  values ((select org_b from k), (select hosp_b from k), (select admin from k), 'pqs_member', (select sa_x from k));

-- (3a) ENTITLED entity-scoped: st_x2 (a comm_x member → can_read_event) may log
-- safety_event.viewed for the comm_x event.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.log_audit_access('safety_event.viewed','safety_event',%L::uuid,%L::uuid,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  '3.1: an entitled reader (can_read_event) CAN log safety_event.viewed');
reset role;

-- (3b) CROSS-TENANT FORGERY: st_y (comm_y member, no relationship to comm_x) CANNOT
-- log safety_event.viewed for the comm_x event → 42501 (the C-4 vector, closed).
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.log_audit_access('safety_event.viewed','safety_event',%L::uuid,%L::uuid,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  '42501', null,
  '3.2: an UNENTITLED cross-commission caller CANNOT forge safety_event.viewed (C-4 closed)');
-- ...and cannot forge a PHI-read row either.
select throws_ok(
  format($$ select public.log_audit_access('event_patient.read','event_patient',%L::uuid,%L::uuid,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  '42501', null,
  '3.3: an UNENTITLED caller CANNOT forge event_patient.read for a foreign event');
reset role;

-- (3c) ENTITLED PHI reader: admin (enrolled PQS operator → can_read_event_patient) may
-- log event_patient.read; the real PHI door (get_event_patient) still emits its row.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.log_audit_access('event_patient.read','event_patient',%L::uuid,%L::uuid,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  '3.4: an entitled PQS operator CAN log event_patient.read');
reset role;

-- (3d) the get_event_patient DEFINER door still emits its .read row for the entitled
-- caller (proves the guard admits the SQL-internal caller path).
create temp table rc on commit drop as
  select count(*)::int as before from public.audit_log where action = 'event_patient.read';
grant select on rc to authenticated;
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(
  (public.get_event_patient((select id from ev)) ->> 'name'), 'Paciente WS2',
  '3.5: get_event_patient (DEFINER door) returns the identifier for an entitled caller');
reset role;
select ok(
  (select count(*)::int from public.audit_log where action = 'event_patient.read') > (select before from rc),
  '3.6: the get_event_patient door emitted its event_patient.read row (guard admits the door)');

-- (3e) COARSE export: a staff_admin of comm_x (sa_x) may log audit.exported for comm_x;
-- a comm_y member (st_y) cannot pass p_commission = comm_x.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.log_audit_access('audit.exported','audit',%L::uuid,%L::uuid,'x','{}'::jsonb) $$,
         (select comm_x from k), (select comm_x from k)),
  '3.7: a staff_admin CAN log audit.exported for its own commission');
reset role;
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.log_audit_access('audit.exported','audit',%L::uuid,%L::uuid,'x','{}'::jsonb) $$,
         (select comm_x from k), (select comm_x from k)),
  '42501', null,
  '3.8: a non-staff_admin CANNOT log audit.exported with a foreign p_commission');
reset role;

-- (3f) the verb allow-list is still enforced (an unknown action → check_violation,
-- BEFORE the entitlement guard).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.log_audit_access('not.a.verb','x',%L::uuid,%L::uuid,'x','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  '23514', null,
  '3.9: an action outside the allow-list still raises check_violation (23514)');
reset role;

-- (3g) COMPLETENESS: allow-list ⊆ dispatch map. Every action in the log_audit_access
-- allow-list MUST have a `when '<action>' then` arm in _audit_access_authorized, else a
-- future .viewed action silently falls through to the fail-closed ELSE and breaks its
-- caller in prod. Parse both function bodies from the catalog and assert set inclusion.
select is(
  (
    with allow as (
      select (regexp_matches(
        pg_get_functiondef('public.log_audit_access(text,text,uuid,uuid,text,jsonb)'::regprocedure),
        '''([a-z_]+\.[a-z_]+)''', 'g'))[1] as action
    ),
    disp as (
      select (regexp_matches(
        pg_get_functiondef('app._audit_access_authorized(text,uuid,uuid)'::regprocedure),
        'when ''([a-z_]+\.[a-z_]+)'' then', 'g'))[1] as action
    )
    select count(*)::int from allow a where not exists (select 1 from disp d where d.action = a.action)
  ),
  0,
  '3.10: allow-list ⊆ dispatch map (every allow-listed action has a dispatch arm — fail-closed completeness)');

-- (3h) the guard helper exists with the right shape + is not anon-executable (t19).
select has_function('app', '_audit_access_authorized', array['text','uuid','uuid'],
  '3.11: app._audit_access_authorized(text,uuid,uuid) exists');
select ok(
  not has_function_privilege('anon', 'app._audit_access_authorized(text,uuid,uuid)', 'EXECUTE'),
  '3.12: _audit_access_authorized is NOT anon-executable (t19 grant hygiene)');

-- ============================================================================
-- §4: DM, rewritten at S2 (FINDING 1a, migration 20260924000300): the
--     document-open verb LEFT the registry — the open door mints it
--     internally AFTER its own gate, so registry forging is impossible for
--     EVERYONE, entitled or not. That is STRICTLY STRONGER than the old C-4
--     pair this block carried (entitled-logs / foreign-42501): the forge
--     surface is gone entirely. The door-side successors of the old contract
--     are 329 O9/O10 (gate-before-record, noun rule) and 228 41b (audit-row
--     exactness). Verb names still built by format() — test 3.10's parser
--     reads every quoted dotted literal in the audit bodies, and this file
--     must not become a counterexample of its own gate.
-- ============================================================================
-- A meeting in comm_x (create_meeting mints it; its BEFORE INSERT trigger
-- mints the registry row) + a document homed on it.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table mtg on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião Anexo', null, now(), null, 'presencial', null, null);
reset role;
grant select on mtg to authenticated;

create temp table att on commit drop as select gen_random_uuid() as id;
grant select on att to authenticated;
insert into public.documents (id, home_resource_id, title, created_by)
  select (select id from att), (select id from mtg), 'Documento de teste', (select sa_x from k);

-- (4a) even the ENTITLED reader (st_x2, comm_x member → can_read_document)
-- is refused AT THE ALLOWLIST — the wrong-arm-proof persona for this pin.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.log_audit_access('document.opened','document',%L::uuid,%L::uuid,'v','{}'::jsonb) $$,
         (select id from att), (select comm_x from k)),
  '23514', null,
  '3.13: the document-open verb is NOT registry-dispatchable even for an entitled reader (S2: the door is its only minter)');
reset role;

-- (4b) the old C-4 vector, now refused one gate EARLIER: the foreign caller
-- meets the allowlist refusal, never authorization.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.log_audit_access('document.opened','document',%L::uuid,%L::uuid,'v','{}'::jsonb) $$,
         (select id from att), (select comm_x from k)),
  '23514', null,
  '3.14: the cross-commission forge attempt dies at the allowlist (forge surface removed entirely)');
reset role;

-- (4c) and NOTHING was minted by either attempt.
select is(
  (select count(*)::int from public.audit_log where entity_id = (select id from att)),
  0, '3.15: zero audit rows from the refused registry attempts');

select * from finish();
rollback;
