-- 388_service_rpc_acls_and_minutes_latch.sql
--
-- AE1.4 rulings, riders R1 + observation #1 (docs/design/authz-ae1-rpc-rulings.md;
-- PO-approved 2026-08-27).
--
-- §1 — R1: pin the PREMISE every Group-E ruling leans on. The nine service-RPC
--      functions are DEFINER, search_path-pinned, and EXECUTE-closed to anon and (except
--      get_feature_flags) to authenticated. A future migration widening any of these
--      reds here instead of silently re-opening the PostgREST front door.
--      ⚠ Signature strings are DELIBERATE pins: if a signature changes, the
--      regprocedure cast below ABORTS this suite — that is the rename-orphan tripwire
--      firing, not collateral damage. Update the strings in the same change.
-- §2 — observation #1: the minutes-job terminal latches behave as single-winner
--      transitions (migration 20261003005000). Sequential re-entry semantics are
--      IDENTICAL pre/post fix, so §2 alone cannot distinguish the shapes — §3 is what
--      asserts atomicity.
-- §3 — structural TEXT PINS: the latch predicate lives INSIDE the UPDATE's WHERE.
--      Verified RED against the pre-migration bodies (SELECT-then-UPDATE) before landing.
--      Reds if the bodies are reworded — deliberate; update pin + body together.

begin;
select plan(62);

-- ─────────────────────────────────────────────────────────────────────────────
-- §0 — fixture anchors (a broken fixture must fail loudly, not pass vacuously)
-- ─────────────────────────────────────────────────────────────────────────────

create temp table t388_fix as
select
  (select array_agg(id) from (
     select m.id
       from public.meetings m
      where not exists (select 1 from public.meeting_minutes_jobs j
                         where j.meeting_id = m.id
                           and j.status in ('uploading', 'processing', 'done'))
      order by m.id
      limit 2) s) as meetings,
  (select p.id from public.profiles p order by p.id limit 1) as requester;

select ok(
  (select cardinality(meetings) from t388_fix) = 2,
  '§0 anchor: two seeded meetings without an active/done minutes job exist (partial unique index needs distinct meetings)');
select ok(
  (select requester from t388_fix) is not null,
  '§0 anchor: a seeded profile exists for requested_by');

-- ─────────────────────────────────────────────────────────────────────────────
-- §1 — R1 ACL/posture pins for the nine Group-E functions (5 pins each)
-- ─────────────────────────────────────────────────────────────────────────────

create temp table t388_fns (sig text, auth_expected boolean);
insert into t388_fns values
  ('public.complete_evidence_upload_verification(uuid,text,boolean)', false),
  ('public.complete_document_upload_verification(uuid,text,boolean)', false),
  ('public.complete_document_reclassification(uuid,uuid,uuid,text)', false),
  ('public.complete_document_disposal(uuid,text)', false),
  ('public.fail_minutes_job(uuid,text,text)', false),
  ('public.complete_minutes_job(uuid,jsonb,text,jsonb)', false),
  ('public.list_stale_meeting_audio(integer,integer)', false),
  ('public.get_feature_flags()', true),
  ('public.lookup_printed_document(text,uuid)', false);

select is(
  (select prosecdef from pg_proc where oid = sig::regprocedure),
  true, '§1 ' || sig || ' is SECURITY DEFINER')
from t388_fns;

select ok(
  (select array_to_string(proconfig, ',') like '%search_path%'
     from pg_proc where oid = sig::regprocedure),
  '§1 ' || sig || ' pins search_path')
from t388_fns;

select is(
  has_function_privilege('anon', sig::regprocedure, 'execute'),
  false, '§1 ' || sig || ': anon has NO EXECUTE')
from t388_fns;

select is(
  has_function_privilege('authenticated', sig::regprocedure, 'execute'),
  auth_expected,
  '§1 ' || sig || ': authenticated EXECUTE is exactly ' || auth_expected::text)
from t388_fns;

select is(
  has_function_privilege('service_role', sig::regprocedure, 'execute'),
  true, '§1 ' || sig || ': service_role has EXECUTE')
from t388_fns;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2 — terminal-latch behavior (single winner; losers report, never re-fire)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.meeting_minutes_jobs (id, meeting_id, requested_by, status, audio_path, transcript)
select 'a0000000-0000-4000-8000-000000000388'::uuid, meetings[1], requester, 'processing',
       'meeting-audio/t388-a.webm', 'work in progress'
from t388_fix;

create temp table t388_r1 as
select public.complete_minutes_job(
  'a0000000-0000-4000-8000-000000000388'::uuid,
  '{"minutes": "ata"}'::jsonb, 'transcript text', null) as r;

select is((select (r ->> 'updated')::boolean from t388_r1), true,
  '§2 complete on a processing job wins the latch (updated = true)');
select is((select r ->> 'status' from t388_r1), 'done',
  '§2 winning completion reports status done');
select is(
  (select status::text from public.meeting_minutes_jobs
    where id = 'a0000000-0000-4000-8000-000000000388'),
  'done', '§2 the row is done after the winning completion');

create temp table t388_r2 as
select public.complete_minutes_job(
  'a0000000-0000-4000-8000-000000000388'::uuid, '{"again": true}'::jsonb, 'x', null) as r;

select is((select (r ->> 'updated')::boolean from t388_r2), false,
  '§2 a second completion loses the latch (updated = false)');
select is((select r ->> 'status' from t388_r2), 'done',
  '§2 the loser reports the current status, not an error');

create temp table t388_r3 as
select public.fail_minutes_job(
  'a0000000-0000-4000-8000-000000000388'::uuid, 'late', 'late failure') as r;

select is((select (r ->> 'updated')::boolean from t388_r3), false,
  '§2 fail on a done job loses the latch (done is outside uploading/processing)');
select is(
  (select status::text from public.meeting_minutes_jobs
    where id = 'a0000000-0000-4000-8000-000000000388'),
  'done', '§2 the done row is untouched by the losing fail');

insert into public.meeting_minutes_jobs (id, meeting_id, requested_by, status, audio_path, transcript)
select 'b0000000-0000-4000-8000-000000000388'::uuid, meetings[2], requester, 'uploading',
       'meeting-audio/t388-b.webm', 'abandoned upload'
from t388_fix;

create temp table t388_r4 as
select public.fail_minutes_job(
  'b0000000-0000-4000-8000-000000000388'::uuid, 'abandoned', 'upload abandoned') as r;

select is((select (r ->> 'updated')::boolean from t388_r4), true,
  '§2 fail on an uploading job wins (❗5: uploading stays in the latch)');
select is(
  (select status::text from public.meeting_minutes_jobs
    where id = 'b0000000-0000-4000-8000-000000000388'),
  'failed', '§2 the abandoned-upload row is failed');
select ok(
  (select purged_at is not null and transcript is null and result is null
     from public.meeting_minutes_jobs
    where id = 'b0000000-0000-4000-8000-000000000388'),
  '§2 the failing transition purges transcript/result and stamps purged_at');

create temp table t388_r5 as
select public.complete_minutes_job(
  'b0000000-0000-4000-8000-000000000388'::uuid, '{}'::jsonb, 't', null) as r;

select is((select (r ->> 'updated')::boolean from t388_r5), false,
  '§2 complete on a failed job loses the latch (failed is terminal)');

create temp table t388_r6 as
select public.fail_minutes_job(
  'c0000000-0000-4000-8000-000000000388'::uuid, 'x', 'y') as r;

select is((select (r ->> 'updated')::boolean from t388_r6), false,
  '§2 fail on a nonexistent job reports updated = false');
select ok((select r ->> 'status' is null from t388_r6),
  '§2 fail on a nonexistent job reports a null status');

-- ─────────────────────────────────────────────────────────────────────────────
-- §3 — structural pins: the latch is IN the UPDATE (atomicity by construction).
--      Deliberate text pins on migration 20261003005000's bodies; verified RED
--      against the pre-migration SELECT-then-UPDATE bodies.
-- ─────────────────────────────────────────────────────────────────────────────

select ok(
  (select prosrc like '%where id = p_job_id%and status in (''uploading'', ''processing'')%'
     from pg_proc where oid = 'public.fail_minutes_job(uuid,text,text)'::regprocedure),
  '§3 fail_minutes_job carries its status latch inside the UPDATE''s WHERE');

select ok(
  (select prosrc like '%where id = p_job_id%and status = ''processing''%'
     from pg_proc where oid = 'public.complete_minutes_job(uuid,jsonb,text,jsonb)'::regprocedure),
  '§3 complete_minutes_job carries its status latch inside the UPDATE''s WHERE');

select * from finish();
rollback;
