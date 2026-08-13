-- =============================================================================
-- MIN · QA remediation (docs/reviews/min-audio-minutes-review.md) — audio reclamation.
--
-- BLOCKER B1 — an APPLIED job's recording was never reclaimed. ADR 0099 D2 lists `apply`
-- among the deletion triggers, acceptance criterion 4 says "the bucket object is gone",
-- and the runbook repeats it — but `apply_minutes_review` returned no `audio_path`, so
-- `applyMinutesReview` could not have deleted it even if it had tried, and no later pass
-- reaches an `applied` row (reconcile no-ops on it; the read returns before reconciling a
-- non-displayable status). In the documented pilot shadow-run mode (`audio_release =
-- false`) the NORMAL user journey therefore ended with the recording retained forever.
-- Fix here: return `audio_path`, exactly as `cancel_minutes_job` already does.
--
-- MAJOR M1 — PO decision O3 committed to a 24 h sweep "extended to cover objects with no
-- live job", and two documents stated it existed. Nothing enumerated `storage.objects`.
-- `meeting_minutes_jobs.meeting_id` is ON DELETE CASCADE, so deleting a meeting destroys
-- the only pointer to its object; that object was unreachable by any code path.
--
--   ⭐ The sweep predicate is deliberately SIMPLER than "objects with no live job":
--   **every `meeting-audio` object older than 24 h is garbage, full stop.** D2's hard TTL
--   admits no exception — an `uploading`/`processing` job that old is failed by
--   reconciliation, a `done` job that old is audio-delete-only, and applied/cancelled/
--   failed jobs should already have released theirs. So the cascade-orphan case, a failed
--   delete, a crashed request and anything we have not thought of all collapse into one
--   rule with no per-status branching to get wrong. Narrowing it to "no live job" would
--   have left exactly the failed-delete case unswept, which is B1's own failure mode.
--
-- SQL can only IDENTIFY: `storage.protect_delete()` refuses direct DML on
-- `storage.objects` ("Use the Storage API instead"), so the delete itself stays in the
-- app (`src/lib/minutes-jobs/sweep.ts`).
--
-- No RLS policy and no boolean authorization gate is added or changed by this migration.
-- =============================================================================

-- --- B1: apply returns the object path so the caller can reclaim it. ---
-- Body taken from `pg_get_functiondef` on the live catalog and replaced whole; the ONLY
-- change is `v_audio_path` + its key in the returned jsonb. `audio_deleted_at` is
-- deliberately NOT stamped here: the app stamps it after the storage delete SUCCEEDS
-- (`deleteAudio`), so a stamp can never claim a deletion that did not happen.
create or replace function public.apply_minutes_review(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_meeting        uuid;
  v_commission     uuid;
  v_status         public.audio_job_status;
  v_draft          jsonb;
  v_meeting_status text;
  v_minutes        text;
  v_audio_path     text;
  v_entry          jsonb;
  v_ref            text;
  v_ref_uuid       uuid;
  v_target         uuid;
  v_title          text;
  v_notes          text;
  v_resolution     text;
  v_position       int;
  v_new_id         uuid;
  v_ref_map        jsonb := '{}'::jsonb;
  v_assignee       uuid;
  v_due            date;
  v_txt            text;
  n_updated        int := 0;
  n_created        int := 0;
  n_actions        int := 0;
  n_unassigned     int := 0;
begin
  perform app.assert_audio_minutes_enabled();

  select j.meeting_id, j.status, j.draft, j.audio_path
    into v_meeting, v_status, v_draft, v_audio_path
  from public.meeting_minutes_jobs j where j.id = p_job_id;

  v_commission := app.commission_of_meeting(v_meeting);
  if v_meeting is null or v_commission is null or not app.is_staff_admin_of(v_commission) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_status is distinct from 'done' then
    raise exception 'esta revisão não está disponível' using errcode = 'HC0S3';
  end if;

  -- Re-guard the meeting INSIDE the transaction: it may have moved to in_signature
  -- since the review page loaded, and guard_meeting_child_lock would then reject the
  -- agenda writes halfway through with a raw Postgres error.
  select m.status into v_meeting_status from public.meetings m where m.id = v_meeting;
  if v_meeting_status is distinct from 'held' then
    raise exception 'a reunião não está mais em estado de edição da ata' using errcode = 'HC0S1';
  end if;

  if v_draft is null or jsonb_typeof(v_draft) <> 'object' then
    raise exception 'rascunho da revisão inválido' using errcode = 'HC0S4';
  end if;

  v_minutes := v_draft->>'minutes_md';
  -- Rule 7 belt-and-braces. The app sanitizes before save; this rejects a tag OPENER
  -- only, so ordinary Markdown containing "a < b" still applies.
  if v_minutes is not null and v_minutes ~ '<[A-Za-z!/?]' then
    raise exception 'o texto da ata contém HTML não permitido' using errcode = 'HC0S5';
  end if;

  -- ---------------- agenda (D6) ----------------
  perform set_config('app.in_meeting_rpc', 'on', true);

  select coalesce(max(ai.position), 0) into v_position
  from public.meeting_agenda_items ai where ai.meeting_id = v_meeting;

  for v_entry in
    select value from jsonb_array_elements(
      case when jsonb_typeof(v_draft->'agenda') = 'array' then v_draft->'agenda' else '[]'::jsonb end)
  loop
    continue when coalesce((v_entry->>'include')::boolean, true) = false;

    v_notes      := nullif(btrim(coalesce(v_entry->>'discussion_notes', '')), '');
    v_resolution := nullif(btrim(coalesce(v_entry->>'resolution', '')), '');
    v_ref        := v_entry->>'ref';
    v_target     := null;

    if v_ref is not null and v_ref ~ c_uuid_re then
      v_ref_uuid := v_ref::uuid;
      select ai.id into v_target
      from public.meeting_agenda_items ai
      where ai.id = v_ref_uuid and ai.meeting_id = v_meeting;
    end if;

    if v_target is not null then
      update public.meeting_agenda_items ai
      set discussion_notes = coalesce(v_notes, ai.discussion_notes),
          resolution       = coalesce(v_resolution, ai.resolution),
          updated_at       = now()
      where ai.id = v_target;
      n_updated := n_updated + 1;
    else
      -- Null or DANGLING ref: raised on the day, or the matched row was deleted while
      -- the review was open. Both degrade to creation (D6/D12), appended at the end.
      v_title := nullif(btrim(coalesce(v_entry->>'title', '')), '');
      if v_title is null then
        raise exception 'um item de pauta novo precisa de título' using errcode = 'HC0S4';
      end if;
      v_position := v_position + 1;
      insert into public.meeting_agenda_items
        (meeting_id, position, title, discussion_notes, resolution, created_by)
      values (v_meeting, v_position, v_title, v_notes, v_resolution, auth.uid())
      returning id into v_new_id;
      n_created := n_created + 1;
      if v_ref is not null then
        v_ref_map := v_ref_map || jsonb_build_object(v_ref, v_new_id);
      end if;
    end if;
  end loop;

  perform set_config('app.in_meeting_rpc', 'off', true);

  -- ---------------- action items (D7) ----------------
  for v_entry in
    select value from jsonb_array_elements(
      case when jsonb_typeof(v_draft->'action_items') = 'array' then v_draft->'action_items' else '[]'::jsonb end)
  loop
    continue when coalesce((v_entry->>'include')::boolean, true) = false;

    v_title := nullif(btrim(coalesce(v_entry->>'title', '')), '');
    continue when v_title is null;

    v_target := null;
    v_txt := v_entry->>'agenda_ref';
    if v_txt is not null and v_txt ~ c_uuid_re then
      select ai.id into v_target
      from public.meeting_agenda_items ai
      where ai.id = v_txt::uuid and ai.meeting_id = v_meeting;
    end if;
    if v_target is null and v_txt is not null and v_ref_map ? v_txt then
      v_target := (v_ref_map->>v_txt)::uuid;
    end if;

    v_assignee := null;
    v_txt := v_entry->>'assigned_to';
    if v_txt is not null and v_txt ~ c_uuid_re
       and app.is_member_of_for(v_commission, v_txt::uuid) then
      v_assignee := v_txt::uuid;
    end if;
    if v_assignee is null then
      n_unassigned := n_unassigned + 1;
    end if;

    v_due := null;
    v_txt := v_entry->>'due_date';
    if v_txt is not null and v_txt ~ '^\d{4}-\d{2}-\d{2}$' then
      v_due := v_txt::date;
    end if;

    begin
      perform public.create_committee_action_item(
        p_commission     => v_commission,
        p_source_type    => 'meeting',
        p_meeting_id     => v_meeting,
        p_agenda_item_id => v_target,
        p_title          => v_title,
        p_description    => nullif(btrim(coalesce(v_entry->>'description', '')), ''),
        p_assigned_to    => v_assignee,
        p_due_date       => v_due);
    exception
      when sqlstate 'HC000' then
        raise exception 'o módulo de itens de ação não está disponível' using errcode = 'HC0S6';
      when sqlstate 'HC021' then
        raise exception 'o responsável indicado não é membro da comissão' using errcode = 'HC0S6';
    end;
    n_actions := n_actions + 1;
  end loop;

  -- ---------------- the ata itself (D5) ----------------
  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set minutes_md = v_minutes, updated_at = now()
  where id = v_meeting;
  perform set_config('app.in_meeting_rpc', 'off', true);

  -- ---------------- terminate + purge (D8) ----------------
  update public.meeting_minutes_jobs
  set status     = 'applied',
      applied_at = now(),
      result     = null,
      draft      = null,
      transcript = null,
      purged_at  = now()
  where id = p_job_id;

  perform app.audit_write(
    'minutes_job.applied', 'meeting_minutes_job', p_job_id, v_commission,
    'Revisão da ata gerada por áudio concluída',
    jsonb_build_object(
      'meeting_id', v_meeting,
      'agenda_updated', n_updated,
      'agenda_created', n_created,
      'actions_created', n_actions,
      'actions_unassigned', n_unassigned));

  return jsonb_build_object(
    'agenda_updated', n_updated,
    'agenda_created', n_created,
    'actions_created', n_actions,
    'actions_unassigned', n_unassigned,
    'meeting_id', v_meeting,
    -- B1: the caller deletes the object and stamps `audio_deleted_at` (D2 — `apply` is
    -- one of the deletion triggers). Null when the audio is already gone.
    'audio_path', v_audio_path);
end;
$$;

revoke execute on function public.apply_minutes_review(uuid) from public, anon;
grant execute on function public.apply_minutes_review(uuid) to authenticated;

-- =============================================================================
-- M1 / O3 — the stale-audio sweep's read half.
--
-- Returns the objects the app should delete, newest-cutoff first, BOUNDED by p_limit so
-- one call is cheap enough to run on a webhook delivery or a page load. The left join
-- yields the owning job when there is one (so the caller can stamp `audio_deleted_at`)
-- and NULL for a cascade-orphaned object, which is exactly the case O3 named and which no
-- job-row-driven path could ever reach.
--
-- service_role ONLY. It reveals object paths across every tenant, so it is not something
-- `authenticated` may call — and there is no user-facing feature that needs it.
-- =============================================================================
create or replace function public.list_stale_meeting_audio(
  p_older_than_hours int default 24, p_limit int default 200)
returns table (object_path text, job_id uuid)
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select o.name::text as object_path, j.id as job_id
  from storage.objects o
  left join public.meeting_minutes_jobs j on j.audio_path = o.name
  where o.bucket_id = 'meeting-audio'
    and o.created_at < now() - make_interval(hours => greatest(p_older_than_hours, 1))
  order by o.created_at
  limit greatest(least(p_limit, 1000), 1);
$$;

revoke execute on function public.list_stale_meeting_audio(int, int)
  from public, anon, authenticated;
grant execute on function public.list_stale_meeting_audio(int, int) to service_role;

comment on function public.list_stale_meeting_audio(int, int) is
  'MIN / PO decision O3 — meeting-audio objects past the D2 hard TTL, with their owning '
  'job when one still exists (NULL = cascade-orphaned, the case O3 named). Read-only: '
  'storage.protect_delete() forbids direct DML on storage.objects, so the caller deletes '
  'through the Storage API. service_role only — it enumerates paths across all tenants.';
