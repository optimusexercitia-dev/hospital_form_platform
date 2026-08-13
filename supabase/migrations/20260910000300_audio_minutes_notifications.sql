-- =============================================================================
-- MIN · B7 (ADR 0099 D11) — notify the requester when a job completes or fails.
--
-- ❗9 THE PLAN'S B7 IS NOT IMPLEMENTABLE AS WRITTEN, for two independent reasons, both
--    resolved from the live catalog:
--
--  (a) `app.enqueue_notification` is UNREACHABLE FROM APP CODE. `supabase/config.toml`
--      exposes only `public` + `graphql_public`, so a function in `app` cannot be called
--      over PostgREST — the plan's "the webhook route calls app.enqueue_notification"
--      would 404. Confirmed both ways: a grep of `src/` finds ZERO callers, and all 14
--      callers in the catalog are other DATABASE functions. Notifications in this
--      platform are emitted DB-side, always.
--      → So the call moves INSIDE the two webhook RPCs, which already run as DEFINER and
--        already hold the commission and the requester. No new door, no new policy: this
--        migration only replaces two `prosecdef` functions that landed in 20260910000200.
--
--  (b) THE PLAN'S VOCABULARY WOULD BE REJECTED AT WRITE TIME. `public.notifications`
--      carries three CHECK constraints, and a "minutes"/"audio" kind is in none of them:
--        notifications_kind_check        — 8 literals, no audio/minutes kind
--        notifications_entity_type_check — 8 literals, no `meeting_minutes_job`
--        notifications_milestone_check   — 10 literals
--      This is the same class of defect B0 §2 caught in the audit action names.
--      → Rather than widen three shared CHECKs (and the `notificationHref` union, and the
--        notification-preferences surface vocabulary) for one feature, MIN reuses the
--        EXISTING meeting vocabulary: kind `meeting`, entity_type `meeting`, entity_id =
--        the MEETING id, milestone `pending`.
--
--      That choice is better than a deep link, not merely cheaper. `notificationHref`'s
--      `meeting` branch already routes to the meeting detail page — which is exactly where
--      the F1 slot renders "Revisar ata gerada" when the job is `done`. A deep link
--      straight to `revisao-ata` would hit that route's own guards and bounce back to the
--      meeting page anyway the moment the job was cancelled, applied, or re-run in the
--      meantime. Landing on the meeting is one click further and always correct.
--
--      Consequence, stated for the record: `is_reminder` is FALSE, so these are never
--      suppressed by a user's per-kind reminder preference (assignments never are —
--      ADR 0076 decision 6); and a user who muted `meeting` REMINDERS still gets these.
--
-- The notification is BEST EFFORT: `app.enqueue_notification` already returns false (and
-- writes nothing) when the `notifications` flag is off, and it is called AFTER the status
-- transition, so a notification problem can never roll back a completed job.
-- =============================================================================

create or replace function public.complete_minutes_job(
  p_job_id uuid, p_result jsonb, p_transcript text, p_draft jsonb default null)
returns jsonb
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
  select j.meeting_id, j.status, j.requested_by, j.audio_path
    into v_meeting, v_status, v_requested, v_path
  from public.meeting_minutes_jobs j where j.id = p_job_id;

  if v_meeting is null or v_status is distinct from 'processing' then
    return jsonb_build_object('updated', false, 'status', v_status);
  end if;

  v_commission := app.commission_of_meeting(v_meeting);

  update public.meeting_minutes_jobs
  set status      = 'done',
      result      = p_result,
      draft       = coalesce(p_draft, p_result),
      transcript  = p_transcript,
      received_at = now()
  where id = p_job_id;

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

revoke execute on function public.complete_minutes_job(uuid, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_minutes_job(uuid, jsonb, text, jsonb) to service_role;

create or replace function public.fail_minutes_job(
  p_job_id uuid, p_error_code text, p_error_message text)
returns jsonb
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
  select j.meeting_id, j.status, j.requested_by, j.audio_path
    into v_meeting, v_status, v_requested, v_path
  from public.meeting_minutes_jobs j where j.id = p_job_id;

  -- 'uploading' stays in the latch (❗5, 20260910000200): B5's reconciliation must be able
  -- to terminate an ABANDONED UPLOAD, or the partial unique index blocks that meeting.
  if v_meeting is null or v_status not in ('uploading', 'processing') then
    return jsonb_build_object('updated', false, 'status', v_status);
  end if;

  v_commission := app.commission_of_meeting(v_meeting);

  update public.meeting_minutes_jobs
  set status        = 'failed',
      error_code    = nullif(btrim(coalesce(p_error_code, '')), ''),
      error_message = nullif(btrim(coalesce(p_error_message, '')), ''),
      result        = null,
      draft         = null,
      transcript    = null,
      purged_at     = now()
  where id = p_job_id;

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

revoke execute on function public.fail_minutes_job(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.fail_minutes_job(uuid, text, text) to service_role;
