-- MIN · T1 (ADR 0099; plan docs/plans/audio-minutes.md) — meeting audio → generated ata.
-- Holds migrations 20260910000100 (schema/RLS/bucket) + 20260910000200 (doors).
--
-- ⚠ EVERY refusal is asserted AT THE DOOR, under `set local role authenticated`, by
-- calling the thing the product calls — never by evaluating a predicate. A correct
-- predicate is not a correct door (authz-handoff §7, the three-shapes lesson).
--
-- ⚠ WRONG-ARM DEFENCE. Several denies here could be produced by the wrong check: a
-- 42501 from `create_minutes_job` could come from the authority gate OR from a missing
-- row. Where two arms can produce the same deny the assertion pins the SQLSTATE that
-- identifies the arm (42501 authority vs HC0S1 meeting state vs HC0S2 active job vs
-- HC0S3 job state), and §3.6 asserts the two are DELIBERATELY indistinguishable — that
-- indistinguishability IS the property (no cross-tenant existence oracle).
--
-- ⚠ FIXTURE FLAG GAP. §0 asserts every flag this suite depends on rather than assuming
-- it. A fixture missing a flag-enable silently SKIPS its own keystones and the suite
-- still reports green (pgtap-fixture-flag-gaps). Never trust the self-reported total.
--
-- Assertion count: 105

begin;
select plan(105);

-- =========================================================================
-- §0 PRECONDITIONS — asserted, not assumed.
-- =========================================================================
update app.feature_flags set enabled = true
  where key in ('audio_minutes', 'meetings', 'action_items', 'audit_trail');

select is((select enabled from app.feature_flags where key = 'audio_minutes'), true,
  '0.1 PRECONDITION: audio_minutes is ON (every RPC below is gated on it)');
select is((select enabled from app.feature_flags where key = 'meetings'), true,
  '0.2 PRECONDITION: meetings is ON (the fixture meeting cannot be built otherwise)');
select is((select enabled from app.feature_flags where key = 'action_items'), true,
  '0.3 PRECONDITION: action_items is ON (PO decision O2 — apply relies on the door)');
select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.4 PRECONDITION: audit_trail is ON (app.audit_write NO-OPS when it is off, which '
  'would make every audit-row assertion below vacuously green)');
select isnt((select app.action_item_initial_status((select gen_random_uuid()))), null,
  '0.5 PRECONDITION: a global initial action-item status exists (create_committee_action_item '
  'RAISES when it resolves to null, which would look like an apply defect)');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as platform,   -- platform_admin: the noun-rule control
         (v->>'sa_x')::uuid   as sa_x,       -- staff_admin of comm_x = the canEdit circle
         (v->>'st_x')::uuid   as st_x,       -- plain staff of comm_x: member, NOT canEdit
         (v->>'sa_y')::uuid   as sa_y,       -- staff_admin of ANOTHER commission
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y
  from ctx;
grant select on k to authenticated;

-- --- the fixture meeting: comm_x, HELD, two agenda items. ---
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table mt on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião MIN', null,
                                      now() - interval '2 hours', null, 'presencial', null, null);
reset role;
grant select on mt to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ag on commit drop as
  select public.create_meeting_agenda_item((select id from mt), 'Pauta A', null, null, null) as a1,
         public.create_meeting_agenda_item((select id from mt), 'Pauta B', null, null, null) as a2;
select public.seed_expected_meeting_attendees((select id from mt));
select public.mark_meeting_held((select id from mt), now() - interval '2 hours', now() - interval '1 hour');
reset role;
grant select on ag to authenticated;

select is((select status from public.meetings where id = (select id from mt)), 'held',
  '0.6 PRECONDITION: the fixture meeting is HELD (D1 eligibility)');

-- =========================================================================
-- §1 DOOR SHAPE. The ACL split IS a security property.
-- =========================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_minutes_job','submit_minutes_job','cancel_minutes_job',
                        'save_minutes_draft','apply_minutes_review','read_minutes_transcript',
                        'complete_minutes_job','fail_minutes_job')
      and has_function_privilege('public', p.oid, 'EXECUTE')), 0,
  '1.1 t19: PUBLIC cannot execute any of the eight new RPCs (REVOKE before GRANT) — a '
  'public.* RPC that keeps PUBLIC''s default EXECUTE leaks to anon by inheritance');

select ok(
  has_function_privilege('authenticated', 'public.create_minutes_job(uuid,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.submit_minutes_job(uuid,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.cancel_minutes_job(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.save_minutes_draft(uuid,jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.apply_minutes_review(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.read_minutes_transcript(uuid)', 'EXECUTE'),
  '1.2 the six INTERACTIVE doors ARE executable by authenticated');

select ok(
  not has_function_privilege('authenticated', 'public.complete_minutes_job(uuid,jsonb,text,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.fail_minutes_job(uuid,text,text)', 'EXECUTE'),
  '1.3 the two WEBHOOK helpers are NOT executable by authenticated — a user must not be '
  'able to forge a service callback');

select ok(
  has_function_privilege('service_role', 'public.complete_minutes_job(uuid,jsonb,text,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.fail_minutes_job(uuid,text,text)', 'EXECUTE'),
  '1.4 TWIN of 1.3: service_role CAN execute them (1.3 is a SPLIT, not a blanket revoke — '
  'without this twin 1.3 would pass just as well if the functions were unreachable by '
  'everyone, i.e. if the feature were simply broken)');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where ((n.nspname = 'public' and p.proname in
             ('create_minutes_job','submit_minutes_job','cancel_minutes_job','save_minutes_draft',
              'apply_minutes_review','read_minutes_transcript','complete_minutes_job','fail_minutes_job'))
        or (n.nspname = 'app' and p.proname = 'can_read_minutes_transcript'))
      and (not p.prosecdef or p.proconfig is null)), 0,
  '1.5 every new door is SECURITY DEFINER with a PINNED search_path (prosecdef beside '
  'pg_policies — a DEFINER''s gate REPLACES RLS, and an unpinned search_path is a '
  'privilege-escalation seam)');

-- =========================================================================
-- §2 THE COLUMN-GRANT GAP + RLS. `transcript` is unreachable by direct select; the row
-- itself is visible only to the canEdit circle.
-- =========================================================================
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'meeting_minutes_jobs'
      and grantee = 'authenticated' and privilege_type = 'SELECT'
      and column_name in ('transcript', 'result')), 0,
  '2.1 `transcript` and `result` are NOT in the authenticated SELECT grant — the audited '
  'door is the ONLY path to verbatim substance (D8)');

select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'meeting_minutes_jobs'
      and grantee = 'authenticated' and privilege_type = 'SELECT'), 16,
  '2.2 TWIN of 2.1: the other sixteen columns ARE granted (2.1 would pass equally well if '
  'the table were ungranted entirely, i.e. if the feature were dead)');

select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'meeting_minutes_jobs'
      and grantee in ('authenticated', 'anon')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')), 0,
  '2.3 authenticated/anon hold NO insert/update/delete on the job table at all — every '
  'mutation is an RPC (Rule 1: the DB is the boundary, not the UI)');

select is(
  (select count(*)::int from pg_policies where tablename = 'meeting_minutes_jobs'), 1,
  '2.4 exactly ONE policy exists on meeting_minutes_jobs (a stray permissive sibling is '
  'how an RLS deny goes quietly vacuous)');

select is(
  (select qual from pg_policies where policyname = 'meeting_minutes_jobs_select'),
  'app.is_staff_admin_of(app.commission_of_meeting(meeting_id))',
  '2.5 the read policy is the canEdit predicate and NOTHING wider (B0 §1 / PO O1: '
  'administrativo + schedule_meetings are deliberately OUT)');

-- --- mint the job under sa_x ---
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table j1 on commit drop as
  select public.create_minutes_job((select id from mt), '../../Reunião  Áudio!!.M4A') as r;
reset role;
grant select on j1 to authenticated;

create temp table jid on commit drop as select (r->>'job_id')::uuid as id, r->>'audio_path' as path from j1;
grant select on jid to authenticated;

select ok((select path from jid) like (select id::text from mt) || '/' || (select id::text from jid) || '/%',
  '3.1 the audio_path is composed SERVER-SIDE as <meeting_id>/<job_id>/<name> — the '
  'client never supplies a storage path');
select ok((select path from jid) not like '%..%',
  '3.2 the sanitizer kills ".." traversal and uppercase/spaces/accents in the filename');

-- --- §2 read visibility, persona by persona ---
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meeting_minutes_jobs), 1,
  '2.6 ALLOW: the commission staff_admin SEES the job row');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meeting_minutes_jobs), 0,
  '2.7 DENY: a plain STAFF member of the SAME commission sees nothing — reach is canEdit, '
  'not membership');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.meeting_minutes_jobs), 0,
  '2.8 DENY: a staff_admin of ANOTHER commission sees nothing');
reset role;

select test_helpers.claims_for((select platform from k), true);
set local role authenticated;
select is((select count(*)::int from public.meeting_minutes_jobs), 0,
  '2.9 DENY: platform_admin sees nothing — a meeting is COMMISSION CONTENT and the noun '
  'rule (ADR 0078 A35) puts it out of reach');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select transcript from public.meeting_minutes_jobs $$,
  '42501', null,
  '2.10 even the canEdit persona cannot direct-select `transcript` — 42501 IS the '
  'column-grant gap, and it is the point');
select throws_ok(
  $$ select result from public.meeting_minutes_jobs $$,
  '42501', null,
  '2.11 ... nor `result`, which restates the same substance');
select throws_ok(
  $$ update public.meeting_minutes_jobs set status = 'applied' $$,
  '42501', null,
  '2.12 ... nor UPDATE the row directly: there is no write policy AND no write grant');
reset role;

-- =========================================================================
-- §3 create_minutes_job — the guard matrix.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'a.m4a') $$, (select id from mt)),
  '42501', null,
  '3.3 DENY: a plain staff member of the commission cannot start a job');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'a.m4a') $$, (select id from mt)),
  '42501', null,
  '3.4 DENY: a staff_admin of another commission cannot start a job on this meeting');
reset role;

select test_helpers.claims_for((select platform from k), true);
set local role authenticated;
select throws_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'a.m4a') $$, (select id from mt)),
  '42501', null,
  '3.5 DENY: platform_admin cannot start a job (noun rule)');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_minutes_job('00000000-0000-0000-0000-0000000000ff'::uuid, 'a.m4a') $$,
  '42501', null,
  '3.6 NO EXISTENCE ORACLE: a meeting that does not exist raises the SAME 42501 as a '
  'meeting that is not yours (§3.4) — the indistinguishability IS the property');
reset role;

-- one-active-job, under EVERY active status.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'b.m4a') $$, (select id from mt)),
  'HC0S2', null,
  '3.7 ONE ACTIVE JOB (status `uploading`): the second create is refused by the partial '
  'unique index, surfaced as HC0S2');
select lives_ok(
  format($$ select public.submit_minutes_job(%L::uuid, 'svc-1') $$, (select id from jid)),
  '3.8 submit_minutes_job moves uploading -> processing');
select throws_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'b.m4a') $$, (select id from mt)),
  'HC0S2', null,
  '3.9 ONE ACTIVE JOB (status `processing`)');
reset role;

-- drive it to `done` through the SERVICE door (as postgres, which owns it).
select is(
  (select public.complete_minutes_job((select id from jid),
     jsonb_build_object('minutes_md', '# Ata', 'agenda', '[]'::jsonb),
     'Fala verbatim do participante.',
     jsonb_build_object(
       'minutes_md', '# Ata gerada',
       'agenda', jsonb_build_array(
         jsonb_build_object('ref', (select a1 from ag)::text, 'discussion_notes', 'discutido', 'resolution', 'aprovado'),
         jsonb_build_object('ref', '00000000-0000-0000-0000-0000000000aa', 'title', 'Pauta órfã', 'discussion_notes', 'surgiu no dia'),
         jsonb_build_object('ref', null, 'title', 'Pauta nova', 'resolution', 'encaminhado'),
         jsonb_build_object('ref', (select a2 from ag)::text, 'include', false, 'discussion_notes', 'NÃO DEVE ENTRAR')),
       'action_items', jsonb_build_array(
         jsonb_build_object('title', 'Ação com dono', 'assigned_to', (select st_x from k)::text,
                            'due_date', '2026-12-01', 'agenda_ref', (select a1 from ag)::text),
         jsonb_build_object('title', 'Ação sem dono válido', 'assigned_to', (select sa_y from k)::text),
         jsonb_build_object('title', 'Ação excluída', 'include', false)),
       'next_meeting', jsonb_build_object('suggested', '2026-12-15')))
   ->>'updated')::boolean, true,
  '5.1 complete_minutes_job latches on `processing` and returns updated=true');

select is((select status::text from public.meeting_minutes_jobs where id = (select id from jid)), 'done',
  '5.2 ... the job is now `done`');
select isnt((select transcript from public.meeting_minutes_jobs where id = (select id from jid)), null,
  '5.3 ... and the transcript is stored (it is NOT reachable by direct select — §2.10)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'b.m4a') $$, (select id from mt)),
  'HC0S2', null,
  '3.10 ONE ACTIVE JOB (status `done`): an unreviewed job still blocks a new upload — '
  'otherwise the second upload would silently orphan the first review');
reset role;

-- =========================================================================
-- §4 the wrong-state matrix on the interactive RPCs.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.submit_minutes_job(%L::uuid, 'svc-2') $$, (select id from jid)),
  'HC0S3', null,
  '4.1 submit on a `done` job → HC0S3 (state), NOT 42501 — the arm is pinned');
select throws_ok(
  format($$ select public.submit_minutes_job('00000000-0000-0000-0000-0000000000ff'::uuid, 's') $$),
  '42501', null,
  '4.2 submit on a nonexistent job → 42501, the same shape as "not yours"');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.save_minutes_draft(%L::uuid, '{}'::jsonb) $$, (select id from jid)),
  '42501', null,
  '4.3 save_minutes_draft DENY: a plain staff member is refused (canEdit, not membership)');
select throws_ok(
  format($$ select public.read_minutes_transcript(%L::uuid) $$, (select id from jid)),
  '42501', null,
  '4.4 read_minutes_transcript DENY: a plain staff member is refused');
select throws_ok(
  format($$ select public.apply_minutes_review(%L::uuid) $$, (select id from jid)),
  '42501', null,
  '4.5 apply_minutes_review DENY: a plain staff member is refused');
select throws_ok(
  format($$ select public.cancel_minutes_job(%L::uuid) $$, (select id from jid)),
  '42501', null,
  '4.6 cancel_minutes_job DENY: a plain staff member is refused');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.save_minutes_draft(%L::uuid, '"nao-e-objeto"'::jsonb) $$, (select id from jid)),
  'HC0S4', null,
  '4.7 save_minutes_draft rejects a non-object draft');
select throws_ok(
  format($$ select public.save_minutes_draft(%L::uuid,
            jsonb_build_object('minutes_md', repeat('a', 2100000))) $$, (select id from jid)),
  'HC0S4', null,
  '4.8 save_minutes_draft enforces the ~2 MB sanity cap so a broken client cannot balloon the row');
select isnt(
  (select public.save_minutes_draft((select id from jid),
     (select draft from public.meeting_minutes_jobs where id = (select id from jid)))), null,
  '4.9 ALLOW: a well-formed draft saves and returns its timestamp');
reset role;

-- =========================================================================
-- §5 the webhook helpers — reachability, the latch, and the ❗5 uploading arm.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.complete_minutes_job(%L::uuid, '{}'::jsonb, 't') $$, (select id from jid)),
  '42501', null,
  '5.4 an authenticated user cannot call complete_minutes_job — a forged "the service '
  'said done" is the whole reason this is service_role-only');
select throws_ok(
  format($$ select public.fail_minutes_job(%L::uuid, 'X', 'y') $$, (select id from jid)),
  '42501', null,
  '5.5 ... nor fail_minutes_job');
reset role;

select is(
  (select public.complete_minutes_job((select id from jid), '{}'::jsonb, 'outro')->>'updated')::boolean,
  false,
  '5.6 IDEMPOTENT: a re-delivery onto a `done` row is a no-op returning updated=false, so '
  'the route answers 200 and the service stops retrying');
select is((select transcript from public.meeting_minutes_jobs where id = (select id from jid)),
  'Fala verbatim do participante.',
  '5.7 TWIN of 5.6: the re-delivery did NOT overwrite the stored transcript (5.6 alone '
  'would pass even if the no-op still wrote)');
select is(
  (select public.fail_minutes_job((select id from jid), 'X', 'y')->>'updated')::boolean, false,
  '5.8 fail_minutes_job is a no-op on a `done` row — a late failure must not destroy a '
  'review the user can already see');

-- =========================================================================
-- §6 THE AUDITED TRANSCRIPT DOOR (D8/D15).
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.read_minutes_transcript(%L::uuid) $$, (select id from jid)),
  '42501', null,
  '6.1 DENY: a plain staff member of the commission');
reset role;
select is((select count(*)::int from public.audit_log where action = 'minutes_transcript.read'), 0,
  '6.2 ... and a DENIED read logs NOTHING (a door that records before it gates writes '
  'audit rows for accesses that never happened)');

select test_helpers.claims_for((select platform from k), true);
set local role authenticated;
select throws_ok(
  format($$ select public.read_minutes_transcript(%L::uuid) $$, (select id from jid)),
  '42501', null,
  '6.3 DENY platform_admin — THE keystone of B0 §3: app._audit_access_authorized returns '
  'true EARLY for is_admin(), so a door that inferred authorization from the audit '
  'registry would hand a platform_admin verbatim committee speech (noun rule)');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.read_minutes_transcript(%L::uuid) $$, (select id from jid)),
  '42501', null,
  '6.4 DENY: a staff_admin of another commission');
select throws_ok(
  $$ select public.read_minutes_transcript('00000000-0000-0000-0000-0000000000ff'::uuid) $$,
  '42501', null,
  '6.5 NO EXISTENCE ORACLE: a nonexistent job id is indistinguishable from a foreign one');
reset role;
select is((select count(*)::int from public.audit_log where action = 'minutes_transcript.read'), 0,
  '6.6 ... still zero audit rows after four denials');

-- the allow arm + the reader-non-writer rule.
-- ctid, not a column list. An UPDATE always writes a NEW tuple, so an unchanged ctid is
-- proof that NOTHING was written — a named-column comparison would miss a write to any
-- column it does not list, and `updated_at` is worthless as an oracle here because the
-- touch trigger uses now(), which is the TRANSACTION timestamp and therefore identical
-- before and after inside a pgTAP transaction. (Found by neutralization: a door doctored
-- to write `received_at` on every read passed the column-list version of this test.)
create temp table before_read on commit drop as
  select ctid::text as tid
  from public.meeting_minutes_jobs where id = (select id from jid);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select public.read_minutes_transcript((select id from jid))),
  'Fala verbatim do participante.',
  '6.7 ALLOW: the commission staff_admin reads the transcript THROUGH THE DOOR — the only '
  'path, since §2.10 denies the column');
reset role;

select is((select count(*)::int from public.audit_log where action = 'minutes_transcript.read'), 1,
  '6.8 ... and the read logged EXACTLY ONE minutes_transcript.read row (Rule 11)');
-- COUNT form, not a scalar subquery: if the door ever logs twice, a scalar subquery
-- raises 21000 and ABORTS the transaction, and every assertion after it emits no TAP
-- line — which a summary counting only `not ok` reads as a pass (found by neutralization:
-- N4/N5 stopped the run dead at 58 of 105).
select is(
  (select count(*)::int from public.audit_log
    where action = 'minutes_transcript.read' and entity_id = (select id from jid)), 1,
  '6.9 ... keyed on the job id');
select is(
  (select count(*)::int from public.audit_log
    where action = 'minutes_transcript.read' and actor_id = (select sa_x from k)), 1,
  '6.10 ... and on the ACTOR, not the function owner (current_user inside a DEFINER is '
  'the owner; auth.uid() is the caller)');

select is(
  (select ctid::text from public.meeting_minutes_jobs where id = (select id from jid)),
  (select tid from before_read),
  '6.11 READER-NON-WRITER (ADR 0079): the ctid is unchanged, so the audited door rewrote '
  'no tuple at all. A reader that writes is a write door wearing a read door''s gate');

-- =========================================================================
-- §7 apply_minutes_review — the D5/D6/D7/D12 transaction.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.save_minutes_draft(%L::uuid,
            jsonb_build_object('minutes_md', '<script>alert(1)</script>')) $$, (select id from jid)),
  '7.1 save_minutes_draft does NOT itself reject HTML (sanitizing is the app''s job, B5) — '
  'this pins where the belt-and-braces check lives, so 7.2 cannot pass for the wrong reason');
select throws_ok(
  format($$ select public.apply_minutes_review(%L::uuid) $$, (select id from jid)),
  'HC0S5', null,
  '7.2 apply REJECTS raw HTML in minutes_md (Rule 7 belt-and-braces)');
reset role;

-- restore the good draft and apply for real.
update public.meeting_minutes_jobs set draft = (select result from public.meeting_minutes_jobs where id = (select id from jid))
  where id = (select id from jid);
update public.meeting_minutes_jobs set draft = jsonb_build_object(
  'minutes_md', E'# Ata gerada\n\nQuorum 3 < 5 confirmado.',   -- a BARE `<` must survive
  'agenda', jsonb_build_array(
    jsonb_build_object('ref', (select a1 from ag)::text, 'discussion_notes', 'discutido', 'resolution', 'aprovado'),
    jsonb_build_object('ref', '00000000-0000-0000-0000-0000000000aa', 'title', 'Pauta órfã', 'discussion_notes', 'surgiu no dia'),
    jsonb_build_object('ref', null, 'title', 'Pauta nova', 'resolution', 'encaminhado'),
    jsonb_build_object('ref', (select a2 from ag)::text, 'include', false, 'discussion_notes', 'NAO DEVE ENTRAR')),
  'action_items', jsonb_build_array(
    jsonb_build_object('title', 'Ação com dono', 'assigned_to', (select st_x from k)::text,
                       'due_date', '2026-12-01', 'agenda_ref', (select a1 from ag)::text),
    jsonb_build_object('title', 'Ação sem dono válido', 'assigned_to', (select sa_y from k)::text),
    jsonb_build_object('title', 'Ação excluída', 'include', false)))
  where id = (select id from jid);

-- The apply is run INSIDE lives_ok, not as a bare statement. A bare `create temp table …
-- as select apply(…)` that RAISES aborts the transaction, and every remaining assertion
-- then emits NO TAP line at all — which any summary counting only `not ok` reads as a
-- pass. (Found by neutralization: removing the O2 assignee downgrade below stopped the
-- run dead at TAP line 63 of 104 and the harness called it green.)
create temp table applied (r jsonb);
grant select, insert on applied to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ insert into applied select public.apply_minutes_review(%L::uuid) $$, (select id from jid)),
  '7.2b apply SURVIVES a draft naming a NON-MEMBER as an action-item owner (PO O2): the '
  'assignee is downgraded to unassigned. Without the downgrade the action-items door '
  'raises HC021 and the entire apply transaction dies');
reset role;

select is((select (r->>'agenda_updated')::int from applied), 1,
  '7.3 D6: the ref-MATCHED agenda entry UPDATED the existing row');
select is((select (r->>'agenda_created')::int from applied), 2,
  '7.4 D6: the DANGLING ref and the NULL ref each CREATED an appended row (a dangling '
  'ref degrades to creation, it does not abort the apply)');
select is((select (r->>'actions_created')::int from applied), 2,
  '7.5 D7: two action items created; the include:false one was skipped');
select is((select (r->>'actions_unassigned')::int from applied), 1,
  '7.6 PO O2: the assignee who is NOT a commission member was DOWNGRADED to unassigned '
  'rather than aborting the apply on the door''s HC021');

select is(
  (select discussion_notes from public.meeting_agenda_items where id = (select a1 from ag)),
  'discutido', '7.7 the matched item''s discussion_notes were written');
select is(
  (select resolution from public.meeting_agenda_items where id = (select a1 from ag)),
  'aprovado', '7.8 ... and its resolution');
select is(
  (select discussion_notes from public.meeting_agenda_items where id = (select a2 from ag)),
  null,
  '7.9 the STRUCK item (include:false) was left untouched — the exclude toggle is real, '
  'not cosmetic');
select is(
  (select count(*)::int from public.meeting_agenda_items where meeting_id = (select id from mt)), 4,
  '7.10 the meeting now has 4 agenda items (2 authored + 2 created)');
select is(
  (select max(position)::int from public.meeting_agenda_items where meeting_id = (select id from mt)), 4,
  '7.11 the created items were APPENDED at max(position)+1, honouring the deferrable '
  'unique (meeting_id, position)');

select is(
  (select minutes_md from public.meetings where id = (select id from mt)),
  E'# Ata gerada\n\nQuorum 3 < 5 confirmado.',
  '7.12 D5: meetings.minutes_md was REPLACED — and a bare "<" survived (7.2 rejects a tag '
  'OPENER, not every angle bracket; rejecting "3 < 5" would fail an honest ata)');

select is(
  (select count(*)::int from public.action_items
    where source_meeting_id = (select id from mt) and assigned_to = (select st_x from k)), 1,
  '7.13 the action item with a MEMBER assignee kept its owner');
select is(
  (select count(*)::int from public.action_item_assignments ai
    join public.action_items a on a.id = ai.action_item_id
   where a.source_meeting_id = (select id from mt) and ai.role = 'owner'), 1,
  '7.14 ... and the door mirrored it into action_item_assignments (proof apply CALLED '
  'create_committee_action_item instead of re-implementing an insert)');
select is(
  (select source_agenda_item_id from public.action_items
    where source_meeting_id = (select id from mt) and assigned_to = (select st_x from k)),
  (select a1 from ag),
  '7.15 ... and the agenda_ref was resolved onto the source agenda item');

select is((select status::text from public.meeting_minutes_jobs where id = (select id from jid)), 'applied',
  '7.16 the job reached `applied`');
select ok(
  (select result is null and draft is null and transcript is null and purged_at is not null
     and applied_at is not null
   from public.meeting_minutes_jobs where id = (select id from jid)),
  '7.17 D8 PURGE: result, draft AND transcript are gone, purged_at + applied_at are set — '
  'the row survives as content-free history');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.apply_minutes_review(%L::uuid) $$, (select id from jid)),
  'HC0S3', null,
  '7.18 a SECOND apply is refused (the job is no longer `done`) — re-applying a purged '
  'draft would blank the ata');
select throws_ok(
  format($$ select public.read_minutes_transcript(%L::uuid) $$, (select id from jid)),
  '42501', null,
  '7.19 and the transcript door closes on the terminal job — the predicate requires '
  '`done`, so a purged job is unreadable even by the canEdit circle');
reset role;

select is(
  (select count(*)::int from public.audit_log
    where action = 'minutes_job.applied' and entity_id = (select id from jid)), 1,
  '7.20 one minutes_job.applied audit row');
select is(
  (select metadata->>'agenda_created' from public.audit_log
    where action = 'minutes_job.applied' and entity_id = (select id from jid)), '2',
  '7.21 ... carrying the COUNTS (never the content — Rule 11)');

-- =========================================================================
-- §8 the audit vocabulary + the second registry.
-- =========================================================================
select is(
  (select count(*)::int from public.audit_log
    where action like 'minutes\_job.%' or action = 'minutes_transcript.read'), 5,
  '8.1 the lifecycle emitted five audit rows so far (created, submitted, completed, '
  'applied, transcript.read)');
select is(
  (select count(*)::int from public.audit_log
    where (action like 'minutes\_job.%' or action = 'minutes_transcript.read')
      and position('.' in action) < 2), 0,
  '8.2 every MIN action satisfies audit_log_action_shape — the plan''s undotted '
  '`meeting_minutes_job_created` names would have been REJECTED at write time (B0 §2)');
select is(
  (select count(*)::int from public.audit_log
    where (action like 'minutes\_job.%' or action = 'minutes_transcript.read')
      and commission_id is distinct from (select comm_x from k)), 0,
  '8.3 every MIN audit row is chained on the OWNING commission');

-- The two-registry trap (B0 §3): both places must carry the arm, or the door fails
-- closed with a misleading error. §6.7 already proved the happy path end to end; these
-- pin each registry independently so a future edit to ONE of them fails here.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'log_audit_access'
      and p.prosrc like '%minutes_transcript.read%'), 1,
  '8.4 registry 1 of 2: log_audit_access''s literal allowlist carries the arm');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = '_audit_access_authorized'
      and p.prosrc like '%can_read_minutes_transcript%'), 1,
  '8.5 registry 2 of 2: _audit_access_authorized dispatches the arm to the NO-ADMIN '
  'predicate (a new door must inherit every sibling arm)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_minutes_transcript'
      and p.prosrc like '%is_admin%'), 0,
  '8.6 the predicate has NO is_admin arm at all');

-- =========================================================================
-- §9 cancel + the ❗5 uploading latch, on a SECOND meeting (the first is terminal).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table mt2 on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião MIN 2', null,
                                      now() - interval '3 hours', null, 'presencial', null, null);
reset role;
grant select on mt2 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'a.m4a') $$, (select id from mt2)),
  'HC0S1', null,
  '9.1 D1: a SCHEDULED meeting is refused with HC0S1 (state), not 42501 — the arm is '
  'pinned, so this cannot pass through the authority check by accident');
select public.mark_meeting_held((select id from mt2), now() - interval '3 hours', null);
create temp table j2 on commit drop as
  select (public.create_minutes_job((select id from mt2), 'x.wav')->>'job_id')::uuid as id;
reset role;
grant select on j2 to authenticated;

select is(
  (select public.fail_minutes_job((select id from j2), 'UPLOAD_ABANDONED', 'sem envio')->>'updated')::boolean,
  true,
  '9.2 ❗5 KEYSTONE: fail_minutes_job terminates an `uploading` row. The plan said '
  '"processing only" — with that latch an abandoned upload could NEVER leave the active '
  'set and the partial unique index would block that meeting from ever running audio again');
select is((select status::text from public.meeting_minutes_jobs where id = (select id from j2)), 'failed',
  '9.3 ... the row is `failed`');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'y.wav') $$, (select id from mt2)),
  '9.4 TWIN of 9.2: a NEW job is now startable on that meeting — which is the whole point '
  'of 9.2 and is what a processing-only latch would have made impossible (D13 re-runs)');
reset role;

create temp table j3 on commit drop as
  select id from public.meeting_minutes_jobs
  where meeting_id = (select id from mt2) and status = 'uploading';
grant select on j3 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select (public.cancel_minutes_job((select id from j3))->>'cancelled')::boolean), true,
  '9.5 cancel_minutes_job cancels an `uploading` job (D9 — immediate, not waiting on the service)');
select throws_ok(
  format($$ select public.cancel_minutes_job(%L::uuid) $$, (select id from j3)),
  'HC0S3', null,
  '9.6 ... and a second cancel is refused');
reset role;

select ok(
  (select status::text = 'cancelled' and cancelled_at is not null and purged_at is not null
     and result is null and draft is null and transcript is null
   from public.meeting_minutes_jobs where id = (select id from j3)),
  '9.7 cancel PURGES content and stamps cancelled_at + purged_at (D8)');
select isnt((select audio_path from public.meeting_minutes_jobs where id = (select id from j3)), null,
  '9.8 ... but KEEPS audio_path — B5 needs it to delete the storage object; the row is '
  'the only record of where the bytes are');

-- =========================================================================
-- §10 THE FLAG IS THE FIRST GATE. Every door must be dark when audio_minutes is OFF,
-- including for the persona who would otherwise pass (Rule 1: hiding the UI is never
-- the control).
-- =========================================================================
update app.feature_flags set enabled = false where key = 'audio_minutes';
select is((select enabled from app.feature_flags where key = 'audio_minutes'), false,
  '10.0 PRECONDITION for §10: the flag is now OFF');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_minutes_job(%L::uuid, 'a.m4a') $$, (select id from mt2)),
  'HC0S0', null,
  '10.1 create_minutes_job is dark for the canEdit persona (HC0S0, not 42501 — the flag '
  'gate fires FIRST)');
select throws_ok(
  format($$ select public.submit_minutes_job(%L::uuid, 's') $$, (select id from j3)),
  'HC0S0', null, '10.2 submit_minutes_job is dark');
select throws_ok(
  format($$ select public.cancel_minutes_job(%L::uuid) $$, (select id from j3)),
  'HC0S0', null, '10.3 cancel_minutes_job is dark');
select throws_ok(
  format($$ select public.save_minutes_draft(%L::uuid, '{}'::jsonb) $$, (select id from j3)),
  'HC0S0', null, '10.4 save_minutes_draft is dark');
select throws_ok(
  format($$ select public.apply_minutes_review(%L::uuid) $$, (select id from jid)),
  'HC0S0', null, '10.5 apply_minutes_review is dark');
select throws_ok(
  format($$ select public.read_minutes_transcript(%L::uuid) $$, (select id from jid)),
  'HC0S0', null, '10.6 read_minutes_transcript is dark');
reset role;

-- The webhook helpers are DELIBERATELY not flag-gated: the callback belongs to the
-- service, not to a user, and a flag flipped OFF mid-flight must not strand a row in
-- `processing` forever with the audio undeleted.
select is(
  (select public.fail_minutes_job((select id from j2), 'X', 'y')->>'updated')::boolean, false,
  '10.7 the webhook helpers still answer with the flag OFF (no-op here because the row is '
  'already terminal) — an in-flight job must still be able to reach a terminal state and '
  'release its audio when the feature is switched off underneath it');

update app.feature_flags set enabled = true where key = 'audio_minutes';

select * from finish();
rollback;
