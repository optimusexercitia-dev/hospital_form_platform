-- Phase 14c: Patient-Safety / NSP — RCA Workspace. ADR 0030/0033.
-- Covers (per the track-doc acceptance list):
--   * RCA state machine (draft -> in_progress -> in_review -> completed -> reopen) +
--     the complete-gate (>=1 root cause → HC047) + freeze/child-lock;
--   * app.can_write_rca participant grant: PQS/admin write; an assigned plain-`staff`
--     SME (non-observer) CAN write; an OBSERVER cannot (read-only); a non-team non-PQS
--     user gets NO read;
--   * structured causal model: factor -> key-toggle -> 5-Whys chain (lazily created,
--     ≤5 steps) -> root cause; the why-chain drops when a factor is un-keyed;
--   * evidence three-way XOR (document/link/citation) — valid shapes insert, mixed
--     shapes are rejected (check_violation);
--   * the immutable nsp-evidence bucket rejects UPDATE/DELETE (no policy);
--   * rca_root_causes PK is FK-ready for capa_action (a FK can reference it);
--   * PHI-free rca audit rows (status only — no *_md body in the diff).
--
-- The RCA is created by 14b's confirm_triage (a shell) — here we drive an event
-- through triage to mint one, then exercise the workspace.

begin;
select plan(32);

update app.feature_flags set enabled = true where key = 'patient_safety';
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
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- Drive an event through triage to a confirmed sentinel RCA (admin = NSP).
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table ev on commit drop as
  select (public.notify_safety_event((select comm_x from k), 'Evento sentinela RCA', null, 'death', null, null, null, current_date)).id as id;
reset role;
grant select on ev to authenticated;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.acknowledge_event((select id from ev));
select public.save_triage((select id from ev), true, null, 'sentinel', 'death', false, null, null, '{}');
select public.confirm_triage((select id from ev));
reset role;

create temp table r on commit drop as
  select id as rca_id from public.rca where event_id = (select id from ev);
grant select on r to authenticated;
select isnt((select rca_id from r), null, 'confirm_triage minted the RCA shell');
select is((select status from public.rca where id = (select rca_id from r)), 'draft',
  'the minted RCA starts in draft');

-- =========================================================================
-- can_write_rca: PQS/admin writes; assigned non-observer SME writes; observer + a
-- non-team user do NOT.
-- =========================================================================
-- PQS/admin can write (the bootstrap path): add two members — a plain-staff SME
-- (st_x, non-observer) and an OBSERVER (st_x2).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.add_rca_member((select rca_id from r), 'sme', (select st_x from k), null);
select public.add_rca_member((select rca_id from r), 'observer', (select st_x2 from k), null);
reset role;
select is((select status from public.rca where id = (select rca_id from r)), 'in_progress',
  'adding the first member bumps draft -> in_progress');

-- app.can_write_rca asserted per-user (uid-pure).
select is(app.can_write_rca((select rca_id from r), (select admin from k)), true,
  'can_write_rca: admin/PQS true');
select is(app.can_write_rca((select rca_id from r), (select st_x from k)), true,
  'can_write_rca: an assigned non-observer SME (plain staff) true');
select is(app.can_write_rca((select rca_id from r), (select st_x2 from k)), false,
  'can_write_rca: an OBSERVER is read-only (false)');
select is(app.can_write_rca((select rca_id from r), (select st_y from k)), false,
  'can_write_rca: a non-team user false');

-- The assigned plain-staff SME (st_x) CAN write (update the problem statement).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.update_rca((select rca_id from r), 'O que aconteceu', 'O esperado', null, null, null, null);
reset role;
select is((select what_md from public.rca where id = (select rca_id from r)), 'O que aconteceu',
  'an assigned plain-staff SME writes the RCA (participant grant)');

-- The OBSERVER (st_x2) CANNOT write (HC048).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_rca((select rca_id from r), 'hack', null, null, null, null, null) $$,
  'HC048', null, 'an observer cannot write the RCA (HC048)');
reset role;

-- A non-team, non-PQS user (st_y) gets NO read (RLS — foreign committee).
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.rca where id = (select rca_id from r)),
  0, 'a non-team non-PQS user reads NO RCA row (access-follows-custody)');
reset role;

-- =========================================================================
-- Structured causal model: factor -> key -> 5-Whys -> root cause.
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table f on commit drop as
  select (public.add_rca_factor((select rca_id from r), 'process', 'Sem dupla checagem')).id as factor_id;
reset role;
grant select on f to authenticated;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.set_rca_factor_key((select factor_id from f), true);
-- 5-Whys: set step 0 and step 2 (padding fills index 1 with '').
select public.set_rca_why_step((select factor_id from f), 0, 'Porque a contagem inicial foi assumida correta');
select public.set_rca_why_step((select factor_id from f), 2, 'Porque o protocolo não exigia dupla checagem');
select public.set_rca_why_root((select factor_id from f), 'Ausência de dupla checagem padronizada');
reset role;

select is(
  (select jsonb_array_length(steps) from public.rca_why_chains where factor_id = (select factor_id from f)),
  3, '5-Whys lazily creates the chain and pads to the set index');
select is(
  (select steps->>1 from public.rca_why_chains where factor_id = (select factor_id from f)),
  '', 'the padded (unanswered) step is an empty string');
select is(
  (select root_text from public.rca_why_chains where factor_id = (select factor_id from f)),
  'Ausência de dupla checagem padronizada', 'the 5-Whys root is captured');

-- A 6th step (index 5) is rejected.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.set_rca_why_step((select factor_id from f), 5, 'demais') $$,
  '23514', null, 'a 6th why step (index 5) is rejected');
-- Un-keying the factor drops its why-chain.
select public.set_rca_factor_key((select factor_id from f), false);
reset role;
select is(
  (select count(*)::int from public.rca_why_chains where factor_id = (select factor_id from f)),
  0, 'un-keying a factor drops its 5-Whys chain');

-- A root cause (stage 3).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table rc on commit drop as
  select (public.add_rca_root_cause((select rca_id from r), 'Falta de processo de dupla checagem', 'process', 'system', 'root')).id as root_id;
reset role;
grant select on rc to authenticated;
select isnt((select root_id from rc), null, 'a root cause is added');

-- =========================================================================
-- Evidence three-way XOR: valid link inserts; a mixed shape is rejected.
-- =========================================================================
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.add_rca_evidence((select rca_id from r), 'link', 'Protocolo', null, 'https://example.org/protocolo', null, null, null);
select throws_ok(
  $$ select public.add_rca_evidence((select rca_id from r), 'link', 'Misto', 'caminho/arquivo.pdf', 'https://x.org', null, null, null) $$,
  '23514', null, 'a mixed evidence shape (link + storage_path) is rejected (check_violation)');
select throws_ok(
  $$ select public.add_rca_evidence((select rca_id from r), 'document', 'Sem arquivo', null, null, null, null, null) $$,
  '23514', null, 'a document evidence with no storage_path is rejected (check_violation)');
reset role;
select is(
  (select count(*)::int from public.rca_evidence where rca_id = (select rca_id from r) and kind = 'link'),
  1, 'a valid link-evidence row inserts');

-- =========================================================================
-- State machine + complete-gate + freeze.
-- =========================================================================
-- in_progress -> in_review.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.submit_rca_for_review((select rca_id from r));
reset role;
select is((select status from public.rca where id = (select rca_id from r)), 'in_review',
  'submit moves in_progress -> in_review');

-- complete with a root cause present -> completed.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.complete_rca((select rca_id from r));
reset role;
select is((select status from public.rca where id = (select rca_id from r)), 'completed',
  'complete moves in_review -> completed (root cause present)');

-- Freeze: a child write on a completed RCA is rejected by the child-lock (HC047),
-- even via an RPC (the lock keys on the parent status, not the flag).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  $$ select public.add_rca_factor((select rca_id from r), 'people', 'tardio') $$,
  'HC047', null, 'a completed RCA rejects child writes (child-lock HC047)');
-- Header freeze: a direct UPDATE outside the flag is rejected (run as table owner).
reset role;
select throws_ok(
  $$ update public.rca set what_md = 'hack' where id = (select rca_id from r) $$,
  'HC047', null, 'a completed RCA header is frozen to a direct UPDATE (HC047)');

-- reopen -> in_progress (unfreezes).
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.reopen_rca((select rca_id from r));
reset role;
select is((select status from public.rca where id = (select rca_id from r)), 'in_progress',
  'reopen moves completed -> in_progress (unfreezes)');

-- Complete-gate: an RCA with NO root cause cannot complete (HC047). Build a fresh one.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table ev2 on commit drop as
  select (public.notify_safety_event((select comm_x from k), 'Sentinela 2', null, 'death', null, null, null, current_date)).id as id;
reset role;
grant select on ev2 to authenticated;
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.acknowledge_event((select id from ev2));
select public.save_triage((select id from ev2), true, null, 'sentinel', 'death', false, null, null, '{}');
select public.confirm_triage((select id from ev2));
reset role;
create temp table r2 on commit drop as select id as rca_id from public.rca where event_id = (select id from ev2);
grant select on r2 to authenticated;
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.update_rca((select rca_id from r2), 'x', null, null, null, null, null);  -- draft -> in_progress
select public.submit_rca_for_review((select rca_id from r2));
select throws_ok(
  $$ select public.complete_rca((select rca_id from r2)) $$,
  'HC047', null, 'complete is blocked without a root cause (HC047 complete-gate)');
reset role;

-- =========================================================================
-- Immutable nsp-evidence bucket: NO update/delete policy (only select + insert).
-- =========================================================================
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'nsp_evidence_obj_%' and cmd in ('UPDATE', 'DELETE')),
  0, 'the nsp-evidence bucket has NO update/delete policy (immutable, Rule 6)');
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'nsp_evidence_obj_%' and cmd in ('SELECT', 'INSERT')),
  2, 'the nsp-evidence bucket has exactly select + insert policies');

-- =========================================================================
-- rca_root_causes PK is FK-ready for Phase-14d capa_action: it has a single-column
-- PRIMARY KEY on `id`, which is exactly what makes it a valid FK target. (A temp-table
-- FK probe is disallowed — "constraints on temporary tables may reference only
-- temporary tables" — so we assert the structural property the 14d FK depends on.)
-- =========================================================================
select is(
  (select count(*)::int
   from pg_constraint
   where conrelid = 'public.rca_root_causes'::regclass and contype = 'p'),
  1, 'rca_root_causes has a primary key (Phase-14d capa_action FK target readiness)');
select is(
  (select a.attname
   from pg_constraint c
   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
   where c.conrelid = 'public.rca_root_causes'::regclass and c.contype = 'p'),
  'id', 'the rca_root_causes PK is the single `id` column (the stable 14d FK target)');

-- =========================================================================
-- PHI-free audit: the rca audit diff carries STATUS only — no *_md body.
-- =========================================================================
select ok(
  not exists (
    select 1 from public.audit_log
    where action like 'rca.%' and (metadata ? 'what_md' or metadata ? 'summary_md' or metadata ? 'expected_md')),
  'no rca audit row copies a *_md body (PHI/free-text-free, Rule 11)');
select ok(
  exists (select 1 from public.audit_log where action = 'rca.completed'),
  'complete emits an rca.completed audit row');
select ok(
  exists (select 1 from public.audit_log where action = 'rca.reopened'),
  'reopen emits an rca.reopened audit row');

select * from finish();
rollback;
