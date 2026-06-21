-- WS A: structured-identifier lockdown (PHI-remediation round 2; ADR 0030/0031).
-- Covers the new real PQS membership + the tight identifier read path:
--   * app.is_pqs_member reads public.pqs_members (NOT == admin); enrollment is the
--     ONLY route an admin gets NSP access (severance verified).
--   * app.can_read_event_patient: custodian-staff_admin = yes, PQS member = yes,
--     plain reporting-committee member = NO, admin-not-in-pqs_members = NO; and the
--     NULL-custodian (PQS-held) case is PQS-only (is_staff_admin_of_for(NULL)=false).
--   * direct SELECT on public.event_patient by authenticated is DENIED (revoked).
--   * public.get_event_patient: entitled + row => returns row + exactly ONE
--     event_patient.read audit row; out-of-scope => NULL + no row; entitled-no-PHI
--     => NULL + no row.
--   * pqs_members add/remove gates NSP access; the admin RPCs are admin-only.
begin;
select plan(46);

-- Flags: patient_safety ON (the module), audit_trail ON (we assert the .read row).
update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y
  from ctx;
grant select on k to authenticated;

-- An event reported by comm_x, currently PQS-held (current_owner_commission_id NULL),
-- with an isolated event_patient PHI row. Direct superuser inserts (mirrors seed).
create temp table ev on commit drop as select gen_random_uuid() as id;
grant select on ev to authenticated;
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status,
   current_owner_kind, current_owner_commission_id, reported_by)
values
  ((select id from ev), 'EV-TEST-A', (select comm_x from k), current_date,
   'Evento de teste WS A', 'acknowledged', 'pqs', null, (select st_x from k));
-- Its PHI (set has_patient like set_event_patient would).
insert into public.event_patient (event_id, name, mrn, sex)
values ((select id from ev), 'Paciente Teste', 'MRN-1', 'female');
update public.patient_safety_event set has_patient = true where id = (select id from ev);

-- A second event with NO PHI row (entitled-but-empty case).
create temp table ev2 on commit drop as select gen_random_uuid() as id;
grant select on ev2 to authenticated;
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status,
   current_owner_kind, current_owner_commission_id, reported_by)
values
  ((select id from ev2), 'EV-TEST-B', (select comm_x from k), current_date,
   'Evento sem PHI', 'acknowledged', 'pqs', null, (select st_x from k));

-- ============================================================================
-- (A) is_pqs_member reads the roster, NOT admin
-- ============================================================================
select ok(not app.is_pqs_member((select admin from k)),
  'admin NOT in pqs_members => is_pqs_member false (severed from blanket NSP access)');
select ok(not app.is_pqs_member((select sa_x from k)),
  'staff_admin not enrolled => is_pqs_member false');

insert into public.pqs_members (user_id, added_by)
  values ((select admin from k), (select admin from k));

select ok(app.is_pqs_member((select admin from k)),
  'after enrollment => is_pqs_member true');

-- ============================================================================
-- (B) can_read_event_patient matrix on the PQS-HELD event (NULL custodian)
-- ============================================================================
select ok(app.can_read_event_patient((select id from ev), (select admin from k)),
  'PQS member (admin enrolled) can read identifiers');
select ok(not app.can_read_event_patient((select id from ev), (select sa_x from k)),
  'reporting-commission staff_admin CANNOT read identifiers (custody is at NSP; NULL custodian => PQS-only)');
select ok(not app.can_read_event_patient((select id from ev), (select st_x from k)),
  'plain reporting-commission member CANNOT read identifiers');

-- Move custody to comm_x: NOW its staff_admin (sa_x) gains panel access; plain st_x still not.
update public.patient_safety_event
  set current_owner_kind = 'commission', current_owner_commission_id = (select comm_x from k)
  where id = (select id from ev);
select ok(app.can_read_event_patient((select id from ev), (select sa_x from k)),
  'custodian-commission staff_admin CAN read identifiers (access-follows-custody)');
select ok(not app.can_read_event_patient((select id from ev), (select st_x from k)),
  'plain member of the custodian commission still CANNOT read identifiers');
select ok(not app.can_read_event_patient((select id from ev), (select sa_y from k)),
  'staff_admin of an UNRELATED commission cannot read identifiers');
-- revert to PQS-held for the rest of the file
update public.patient_safety_event
  set current_owner_kind = 'pqs', current_owner_commission_id = null
  where id = (select id from ev);

-- NULL-safety: is_staff_admin_of_for(NULL, uid) is false (not an error).
select ok(not app.is_staff_admin_of_for(null, (select sa_x from k)),
  'is_staff_admin_of_for(NULL, uid) returns false (NULL-safe; PQS-held panel stays PQS-only)');

-- ============================================================================
-- (C) direct SELECT on event_patient is revoked from authenticated
-- ============================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select count(*) from public.event_patient $$,
  '42501',
  'permission denied for table event_patient',
  'direct SELECT on event_patient by authenticated is DENIED (RPC-only)'
);
reset role;

-- ============================================================================
-- (D) get_event_patient: the single audited door
-- ============================================================================
-- baseline read count
create temp table rc on commit drop as
  select count(*)::int as before from public.audit_log where action = 'event_patient.read';

-- D1: entitled (admin enrolled) + PHI row => returns the row
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is(
  (public.get_event_patient((select id from ev)) ->> 'name'),
  'Paciente Teste',
  'get_event_patient returns the identifier row for an entitled caller'
);
reset role;
-- D1b: exactly ONE new event_patient.read row, attributed to the reporting commission
select is(
  (select count(*)::int from public.audit_log where action = 'event_patient.read') - (select before from rc),
  1,
  'entitled read writes exactly ONE event_patient.read audit row'
);
select is(
  (select commission_id from public.audit_log
   where action = 'event_patient.read' and entity_id = (select id from ev)
   order by occurred_at desc limit 1),
  (select comm_x from k),
  'the read audit row is attributed to the reporting (provenance) commission'
);
select ok(
  (select (metadata = '{}'::jsonb) from public.audit_log
   where action = 'event_patient.read' and entity_id = (select id from ev)
   order by occurred_at desc limit 1),
  'the read audit row carries EMPTY metadata (no identifier payload; Rule 11/12)'
);

-- D2: out-of-scope caller (plain reporting member) => NULL + NO new audit row
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  public.get_event_patient((select id from ev)) is null,
  'out-of-scope caller gets NULL from get_event_patient'
);
reset role;
select is(
  (select count(*)::int from public.audit_log where action = 'event_patient.read') - (select before from rc),
  1,
  'out-of-scope read writes NO audit row (count unchanged at 1)'
);

-- D3: entitled caller, event with NO PHI => NULL + NO new audit row
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select ok(
  public.get_event_patient((select id from ev2)) is null,
  'entitled caller on a PHI-less event gets NULL'
);
reset role;
select is(
  (select count(*)::int from public.audit_log where action = 'event_patient.read') - (select before from rc),
  1,
  'entitled-but-no-PHI read writes NO audit row (count still 1)'
);

-- ============================================================================
-- (E) pqs_members management RPCs are admin-only; remove revokes access
-- ============================================================================
-- a non-admin cannot enroll
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.add_pqs_member(%L) $$, (select st_y from k)),
  '42501',
  null,
  'add_pqs_member denied to a non-admin (42501)'
);
reset role;

-- admin enrolls sa_y, who then CAN read identifiers; remove, then CANNOT
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select (public.add_pqs_member((select sa_y from k))).user_id is not null as enrolled;
reset role;
select ok(app.can_read_event_patient((select id from ev), (select sa_y from k)),
  'enrolling a user via add_pqs_member grants identifier read');

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.remove_pqs_member((select sa_y from k));
reset role;
select ok(not app.can_read_event_patient((select id from ev), (select sa_y from k)),
  'remove_pqs_member revokes identifier read (membership is the gate)');

-- ============================================================================
-- (E2) WS B — log_audit_access accepts the 6 clinical-detail `.viewed` verbs and
-- still rejects a forged mutation verb (the positive allow-list is the guard).
-- ============================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select lives_ok(
  format($$ select public.log_audit_access('safety_event.viewed','safety_event',%L,%L,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  'log_audit_access accepts safety_event.viewed');
select lives_ok(
  format($$ select public.log_audit_access('triage.viewed','event_triage',%L,%L,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  'log_audit_access accepts triage.viewed');
select lives_ok(
  format($$ select public.log_audit_access('rca.viewed','rca',%L,%L,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  'log_audit_access accepts rca.viewed');
select lives_ok(
  format($$ select public.log_audit_access('capa.viewed','capa_plan',%L,%L,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  'log_audit_access accepts capa.viewed');
select lives_ok(
  format($$ select public.log_audit_access('meeting.viewed','meeting',%L,%L,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  'log_audit_access accepts meeting.viewed');
select lives_ok(
  format($$ select public.log_audit_access('interview.viewed','interview',%L,%L,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  'log_audit_access accepts interview.viewed');
select throws_ok(
  format($$ select public.log_audit_access('rca.created','rca',%L,%L,'v','{}'::jsonb) $$,
         (select id from ev), (select comm_x from k)),
  '23514', null,
  'log_audit_access still REJECTS a forged mutation verb (rca.created)');
reset role;

-- ============================================================================
-- (F) RCA-write severance (Round 3): a non-PQS admin can no longer write/tamper
-- RCA content — writes follow the participant model (PQS member OR assigned
-- non-observer), matching can_write_interview / the now-PQS-only CAPA writes.
-- ============================================================================
create temp table rca_t on commit drop as select gen_random_uuid() as id;
grant select on rca_t to authenticated;
insert into public.rca (id, event_id, status, what_md)
values ((select id from rca_t), (select id from ev), 'in_progress', 'rascunho');

-- admin is STILL enrolled in pqs_members here (from section A) -> can write via PQS.
select ok(app.can_write_rca((select id from rca_t), (select admin from k)),
  'an enrolled-PQS admin CAN write RCA (via is_pqs_member, not a standalone admin term)');

-- Remove admin from pqs_members: now a bare admin (not PQS, not a participant)
-- must NOT be able to write the RCA — the severance.
delete from public.pqs_members where user_id = (select admin from k);
select ok(not app.can_write_rca((select id from rca_t), (select admin from k)),
  'a non-PQS admin CANNOT write RCA (standalone is_admin severed)');

-- And the RLS policy denies the bare admin a direct UPDATE: the write policy has
-- no admin term, so the row is invisible to the admin's UPDATE (USING fails →
-- 0 rows affected, no error) and the content is NOT tampered.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
update public.rca set what_md = 'tampered' where id = (select id from rca_t);
reset role;
select is(
  (select what_md from public.rca where id = (select id from rca_t)),
  'rascunho',
  'a non-PQS admin direct UPDATE on rca changes NOTHING (write policy has no admin term)'
);

-- A plain non-participant staff likewise cannot write.
select ok(not app.can_write_rca((select id from rca_t), (select st_y from k)),
  'a non-participant plain staff cannot write RCA');

-- ============================================================================
-- (G) WS C — dispose_event_phi: NULLs/redacts PHI across event + RCA, PRESERVES the
-- skeleton (codes/status/custody/audit chain), sets has_patient=false + stamps,
-- emits ONE PHI-free event_patient.disposed row, and is one-shot.
-- ev still has: its event_patient row (section A) + rca_t (an RCA, what_md='rascunho').
-- ============================================================================
-- A PHI-bearing NOT-NULL child to prove sentinel REDACTION (not NULL).
insert into public.rca_factors (rca_id, category, text, position)
values ((select id from rca_t), 'people', 'Paciente João — equipe reduzida', 1);
-- A custody row to prove the ledger is preserved.
insert into public.event_custody (event_id, owner_kind, owner_commission_id, assigned_by, note)
values ((select id from ev), 'pqs', null, (select admin from k), 'inicial');

-- audit baseline (to scope the disposal-generated rows)
create temp table dz on commit drop as
  select (count(*) filter (where action='event_patient.disposed'))::int as disposed_before from public.audit_log;

-- Dispose as a BARE admin (removed from pqs_members in section F) — the admin gate
-- on disposal still applies (disposal is a compliance action, not a PHI read).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.dispose_event_phi((select id from ev), 'subject_request');
reset role;

select is((select count(*)::int from public.event_patient where event_id = (select id from ev)),
  0, 'disposal DELETES the isolated event_patient row');
select is((select description_md from public.patient_safety_event where id = (select id from ev)),
  null, 'disposal NULLs patient_safety_event.description_md');
select is((select what_md from public.rca where id = (select id from rca_t)),
  null, 'disposal NULLs rca.what_md');
select is((select text from public.rca_factors where rca_id = (select id from rca_t) limit 1),
  '[PHI removido]', 'disposal REDACTS the NOT-NULL rca_factors.text to a sentinel');
select is((select has_patient from public.patient_safety_event where id = (select id from ev)),
  false, 'disposal sets has_patient = false');
select ok((select phi_disposed_at is not null and phi_disposed_by = (select admin from k)
             and phi_disposed_reason = 'subject_request'
           from public.patient_safety_event where id = (select id from ev)),
  'disposal stamps phi_disposed_at / _by / _reason (constrained category)');
-- skeleton preserved: code + status + the custody ledger untouched.
select is((select status from public.patient_safety_event where id = (select id from ev)),
  'acknowledged', 'disposal PRESERVES the event status (governance skeleton)');
select is((select count(*)::int from public.event_custody where event_id = (select id from ev)),
  1, 'disposal PRESERVES the custody ledger');

-- exactly one event_patient.disposed audit row, metadata = the enum reason ONLY.
select is(
  (select count(*)::int from public.audit_log where action='event_patient.disposed'
     and entity_id = (select id from ev)) - (select disposed_before from dz),
  1, 'disposal emits exactly ONE event_patient.disposed audit row');
select is(
  (select metadata from public.audit_log where action='event_patient.disposed'
     and entity_id = (select id from ev) order by occurred_at desc limit 1),
  '{"reason": "subject_request"}'::jsonb,
  'the disposed audit row metadata is the enum reason ONLY (no free text / PHI)');
-- NO disposal-generated audit row anywhere carries the PHI identifier values or the sentinel.
select is(
  (select count(*)::int from public.audit_log
     where metadata::text ilike '%Paciente João%' or metadata::text ilike '%PHI removido%'),
  0, 'NO audit row carries PHI free-text / identifiers (triggers exclude PHI columns)');

-- one-shot: a second disposal is rejected (HC056).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  format($$ select public.dispose_event_phi(%L, 'duplicate') $$, (select id from ev)),
  'HC056', null,
  'disposal is ONE-SHOT — a second call raises HC056');
-- an invalid reason category is rejected.
select throws_ok(
  format($$ select public.dispose_event_phi(%L, 'because') $$, (select id from ev2)),
  '23514', null,
  'disposal rejects an out-of-category reason (constrained, never free text)');
reset role;

select * from finish();
rollback;
