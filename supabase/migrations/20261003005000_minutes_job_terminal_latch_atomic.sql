-- 20261003005000_minutes_job_terminal_latch_atomic.sql
--
-- AE1.4 rulings rider — PO observation #1 at the 2026-08-27 approval
-- (docs/design/authz-ae1-rpc-rulings.md § PO observations): make the minutes-job
-- terminal latches ATOMIC.
--
-- Defect: both terminal doors read the job's status with a plain SELECT and then ran an
-- UNCONDITIONAL UPDATE. Two concurrent provider callbacks (or a callback racing the
-- page-load reconciliation, webhook.ts vs reconcile.ts) could both observe 'processing',
-- then both update, both emit the audit row and both enqueue the notification. The
-- "status latch" was a read, not a latch.
--
-- Shape (the ruling's preferred form): the latch predicate moves INTO the UPDATE's WHERE
-- (`update … where id = p_job_id and status …` + FOUND), so exactly one caller can win a
-- given transition; every loser re-reads the current status and returns {updated:false}
-- exactly as the sequential-miss path always did.
--
-- Preserved: signatures, SECURITY DEFINER, pinned search_path, owner + ACLs (create or
-- replace keeps both; service_role-only EXECUTE, pinned by pgTAP 388 §1), return shapes on
-- both win and miss paths, the ❗5 'uploading'-stays-in-the-latch rule (20260910000200),
-- audit + notification payloads and their dedupe keys, and complete's
-- coalesce(p_draft, p_result).
--
-- Pinned by supabase/tests/388_service_rpc_acls_and_minutes_latch.sql — §3 there carries
-- deliberate TEXT PINS on these two bodies (reds if the latch is reworded; that is the
-- point). Both pins were verified RED against the pre-migration bodies before this landed.

create or replace function public.fail_minutes_job(
  p_job_id uuid, p_error_code text, p_error_message text
) returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_meeting    uuid;
  v_commission uuid;
  v_status     public.audio_job_status;
  v_requested  uuid;
  v_path       text;
  v_title      text;
begin
  -- 'uploading' stays in the latch (❗5, 20260910000200): B5's reconciliation must be able
  -- to terminate an ABANDONED UPLOAD, or the partial unique index blocks that meeting.
  -- The latch predicate lives in the UPDATE itself; only one caller can win it.
  update public.meeting_minutes_jobs
     set status        = 'failed',
         error_code    = nullif(btrim(coalesce(p_error_code, '')), ''),
         error_message = nullif(btrim(coalesce(p_error_message, '')), ''),
         result        = null,
         draft         = null,
         transcript    = null,
         purged_at     = now()
   where id = p_job_id
     and status in ('uploading', 'processing')
  returning meeting_id, requested_by, audio_path
    into v_meeting, v_requested, v_path;

  if not found then
    select j.status into v_status
      from public.meeting_minutes_jobs j where j.id = p_job_id;
    return jsonb_build_object('updated', false, 'status', v_status);
  end if;

  v_commission := app.commission_of_meeting(v_meeting);

  perform app.audit_write(
    'minutes_job.failed', 'meeting_minutes_job', p_job_id, v_commission,
    'Processamento de áudio da ata falhou',
    jsonb_build_object('meeting_id', v_meeting, 'error_code', p_error_code));

  select m.title into v_title from public.meetings m where m.id = v_meeting;
  perform app.enqueue_notification(
    v_requested, v_commission, 'meeting', 'pending', false,
    'meeting', v_meeting,
    'Falha ao gerar a ata por áudio',
    coalesce(v_title, 'Reunião') || ' — não foi possível gerar a ata a partir do áudio enviado.',
    'minutes_job:' || p_job_id::text || ':failed');

  return jsonb_build_object(
    'updated', true, 'status', 'failed',
    'meeting_id', v_meeting, 'commission_id', v_commission,
    'requested_by', v_requested, 'audio_path', v_path);
end;
$$;

create or replace function public.complete_minutes_job(
  p_job_id uuid, p_result jsonb, p_transcript text, p_draft jsonb default null::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_meeting    uuid;
  v_commission uuid;
  v_status     public.audio_job_status;
  v_requested  uuid;
  v_path       text;
  v_title      text;
begin
  -- The latch predicate lives in the UPDATE itself; only one caller can win it.
  update public.meeting_minutes_jobs
     set status      = 'done',
         result      = p_result,
         draft       = coalesce(p_draft, p_result),
         transcript  = p_transcript,
         received_at = now()
   where id = p_job_id
     and status = 'processing'
  returning meeting_id, requested_by, audio_path
    into v_meeting, v_requested, v_path;

  if not found then
    select j.status into v_status
      from public.meeting_minutes_jobs j where j.id = p_job_id;
    return jsonb_build_object('updated', false, 'status', v_status);
  end if;

  v_commission := app.commission_of_meeting(v_meeting);

  perform app.audit_write(
    'minutes_job.completed', 'meeting_minutes_job', p_job_id, v_commission,
    'Ata gerada recebida do serviço de áudio',
    jsonb_build_object('meeting_id', v_meeting));

  -- D11. Best effort and deliberately last: the job is already `done` above, so a
  -- notification failure cannot cost the user their generated ata.
  select m.title into v_title from public.meetings m where m.id = v_meeting;
  perform app.enqueue_notification(
    v_requested, v_commission, 'meeting', 'pending', false,
    'meeting', v_meeting,
    'Ata gerada disponível para revisão',
    coalesce(v_title, 'Reunião') || ' — a ata gerada a partir do áudio está pronta para revisão.',
    'minutes_job:' || p_job_id::text || ':done');

  return jsonb_build_object(
    'updated', true, 'status', 'done',
    'meeting_id', v_meeting, 'commission_id', v_commission,
    'requested_by', v_requested, 'audio_path', v_path);
end;
$$;
