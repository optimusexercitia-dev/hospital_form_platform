-- =============================================================================
-- MIN · B2 (ADR 0099 / docs/plans/audio-minutes.md) — meeting audio → generated ata,
-- migration 2 of 2: the flag, the lifecycle RPCs, the apply transaction, the audited
-- transcript door, and the two service-role webhook helpers.
--
-- SUBSTRATE, resolved from the live catalog (never from migration text):
--   * canEdit is `app.is_staff_admin_of(app.commission_of_meeting(meeting_id))` and
--     NOTHING wider (B0 §1; PO decision O1 excludes `administrativo`).
--   * audit actions must be DOTTED — `audit_log_action_shape CHECK (position('.' in
--     action) > 1)`. There is no enum (B0 §2).
--   * the audited-read path is an allowlist in TWO places, and its authorizer
--     short-circuits `true` for platform_admin, so "the audit log accepted it" is NOT
--     authorization (B0 §3). The door gates itself FIRST.
--   * `app.in_meeting_rpc` must wrap meeting/agenda writes (B0 §7).
--   * `public.create_committee_action_item` is the action-items door — call it (B0 §4).
--
-- ❗DEVIATIONS FROM THE PLAN (all reported to the lead):
--   ❗4 EVERY callable RPC lives in `public`, not `app`. The plan named them
--      `app.create_minutes_job` etc. `supabase/config.toml` exposes
--      schemas = ["public", "graphql_public"] — a function in `app` is NOT reachable
--      through PostgREST, so `supabase.rpc('create_minutes_job')` would 404 and the
--      whole feature would be dead on arrival. Every app-callable RPC in this database
--      is `public.*`; `app` holds predicates, asserts and trigger bodies. Only the
--      boolean predicate `app.can_read_minutes_transcript` stays in `app`, correctly.
--   ❗5 `fail_minutes_job` latches on status IN ('uploading','processing'), not
--      'processing' alone. B5's own spec requires failing an ABANDONED UPLOAD and the
--      24h TTL row; with a processing-only latch an `uploading` row could never reach a
--      terminal state, and the partial unique index would then block that meeting from
--      ever starting another job. `complete_minutes_job` keeps the 'processing'-only
--      latch (a callback for a row that never left the browser is nonsense).
--   ❗6 Return shapes are richer than the plan's: `create_minutes_job` returns
--      {job_id, audio_path} (B5 needs the path to mint the signed upload URL — one round
--      trip instead of two), `cancel_minutes_job` / the webhook helpers return jsonb
--      carrying {audio_path, requested_by, meeting_id, commission_id} so the caller can
--      delete the object and enqueue the B7 notification without a second query.
--      `complete_minutes_job` takes an optional 4th `p_draft` so B6 can pass the
--      NORMALIZED + SANITIZED review shape (SQL stays dumb); it falls back to `p_result`.
--   ❗7 The Rule-7 belt-and-braces check rejects `<` only when followed by
--      [A-Za-z!/?] — an HTML tag opener. A bare `<` ("a < b") is legitimate Markdown and
--      rejecting it would fail an honest ata.
--
-- ERROR CODES (next free block, verified against every HC* literal in pg_proc):
--   HC0S0 feature off · HC0S1 meeting not eligible · HC0S2 an active job already exists
--   HC0S3 job in the wrong state · HC0S4 invalid draft · HC0S5 raw HTML in the ata
--   HC0S6 the action-items module is unavailable
-- DENIAL: every "not found" and every "not yours" raises the SAME `42501 sem permissão`.
-- There is no cross-tenant existence oracle in this surface.
-- =============================================================================

-- --- the flag. Ships DISABLED (D17: enabled per tenant only after the service's DPA
-- --- gates close and a production smoke passes). `on conflict (key)` is TARGETED and
-- --- deliberately does NOT touch `enabled` — a re-run must never re-disable a flag a
-- --- later gate migration or seed.sql has flipped on.
insert into app.feature_flags (key, enabled, description) values
  ('audio_minutes', false,
   'MIN (ADR 0099) — meeting audio to generated ata. Gates create/submit/cancel/'
   'save-draft/apply and the audited transcript door; the meetings Ata card offers '
   '"Usar áudio" only when it is on. Ships OFF at the pilot deploy; flipped per tenant '
   'after the minute_generator DPA gates (AssemblyAI / RunPod) close and the manual '
   'smoke passes. Resolve the VALUE in the enabled column, never this sentence.')
  on conflict (key) do update set description = excluded.description;

create or replace function app.assert_audio_minutes_enabled()
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('audio_minutes') then
    raise exception 'o recurso de ata por áudio não está disponível' using errcode = 'HC0S0';
  end if;
end;
$$;

revoke execute on function app.assert_audio_minutes_enabled() from public, anon;
grant execute on function app.assert_audio_minutes_enabled() to authenticated, service_role;

-- =============================================================================
-- The transcript-read predicate (B0 §3). NO platform_admin arm — meetings are
-- commission content and the noun rule (ADR 0078 A35) puts them out of reach. It takes
-- the actor EXPLICITLY (`app.is_staff_admin_of_for`, not the auth.uid()-reading
-- `is_staff_admin_of`) so `p_uid` is load-bearing rather than decorative, and both
-- callers below pass a real uid.
-- =============================================================================
create or replace function app.can_read_minutes_transcript(p_job_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null
     and exists (
       select 1
       from public.meeting_minutes_jobs j
       where j.id = p_job_id
         and j.status = 'done'
         and app.is_staff_admin_of_for(app.commission_of_meeting(j.meeting_id), p_uid)
     );
$$;

revoke execute on function app.can_read_minutes_transcript(uuid, uuid) from public, anon;
grant execute on function app.can_read_minutes_transcript(uuid, uuid) to authenticated, service_role;

comment on function app.can_read_minutes_transcript(uuid, uuid) is
  'MIN D8/D15 — may this actor read this job''s verbatim transcript? staff_admin of the '
  'meeting''s commission AND the job is `done`. There is deliberately NO app.is_admin() '
  'arm: app._audit_access_authorized short-circuits true for platform_admin, so a door '
  'that inferred authorization from the audit registry would breach the noun rule.';

-- =============================================================================
-- create_minutes_job — mint the row and the immutable object path.
-- =============================================================================
create or replace function public.create_minutes_job(p_meeting_id uuid, p_filename text)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
  v_status     text;
  v_job_id     uuid := gen_random_uuid();
  v_name       text;
  v_path       text;
begin
  perform app.assert_audio_minutes_enabled();

  -- Existence and authority produce the SAME refusal: no existence oracle.
  v_commission := app.commission_of_meeting(p_meeting_id);
  if v_commission is null or not app.is_staff_admin_of(v_commission) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select m.status into v_status from public.meetings m where m.id = p_meeting_id;
  if v_status is distinct from 'held' then
    raise exception 'a reunião precisa estar marcada como realizada para gerar a ata por áudio'
      using errcode = 'HC0S1';
  end if;

  -- Sanitize the filename SERVER-SIDE; the client never composes a storage path.
  v_name := lower(coalesce(nullif(btrim(p_filename), ''), 'audio'));
  v_name := regexp_replace(v_name, '[^a-z0-9._-]+', '-', 'g');
  v_name := regexp_replace(v_name, '\.{2,}', '.', 'g');   -- no '..' traversal
  v_name := regexp_replace(v_name, '^[-.]+', '', 'g');
  v_name := left(v_name, 120);
  if nullif(v_name, '') is null then
    v_name := 'audio';
  end if;
  v_path := p_meeting_id::text || '/' || v_job_id::text || '/' || v_name;

  begin
    insert into public.meeting_minutes_jobs (id, meeting_id, requested_by, status, audio_path)
    values (v_job_id, p_meeting_id, auth.uid(), 'uploading', v_path);
  exception when unique_violation then
    -- D4/D13, enforced by meeting_minutes_jobs_active_uidx — the race is the DB's, not
    -- the UI's. Catching it here is what turns the index into a user-readable rule.
    raise exception 'já existe um processamento de áudio em andamento para esta reunião'
      using errcode = 'HC0S2';
  end;

  perform app.audit_write(
    'minutes_job.created', 'meeting_minutes_job', v_job_id, v_commission,
    'Processamento de áudio da ata iniciado',
    jsonb_build_object('meeting_id', p_meeting_id));

  return jsonb_build_object('job_id', v_job_id, 'audio_path', v_path);
end;
$$;

revoke execute on function public.create_minutes_job(uuid, text) from public, anon;
grant execute on function public.create_minutes_job(uuid, text) to authenticated;

-- =============================================================================
-- submit_minutes_job — the upload finished and minute_generator accepted the job.
--
-- ❗8 Returns jsonb, not the boolean the plan implied. A `prosecdef` function returning
-- boolean is what ADR 0079's census heuristic classifies as an AUTHORIZATION PREDICATE,
-- and `ARM=census` duly reported this one as an unswept gate. It is not a predicate —
-- it is a mutation returning a did-it-happen flag, exactly like its five jsonb-returning
-- siblings here. Matching them removes the misclassification at the source instead of
-- parking a permanent "trust my prose" line in authz-unswept-backlog.txt.
-- =============================================================================
drop function if exists public.submit_minutes_job(uuid, text);
create or replace function public.submit_minutes_job(p_job_id uuid, p_service_job_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_meeting    uuid;
  v_commission uuid;
  v_status     public.audio_job_status;
begin
  perform app.assert_audio_minutes_enabled();

  select j.meeting_id, j.status into v_meeting, v_status
  from public.meeting_minutes_jobs j where j.id = p_job_id;

  v_commission := app.commission_of_meeting(v_meeting);
  if v_meeting is null or v_commission is null or not app.is_staff_admin_of(v_commission) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_status is distinct from 'uploading' then
    raise exception 'este processamento não está aguardando envio' using errcode = 'HC0S3';
  end if;
  if nullif(btrim(p_service_job_id), '') is null then
    raise exception 'identificador do serviço ausente' using errcode = 'check_violation';
  end if;

  update public.meeting_minutes_jobs
  set status = 'processing', service_job_id = btrim(p_service_job_id)
  where id = p_job_id;

  perform app.audit_write(
    'minutes_job.submitted', 'meeting_minutes_job', p_job_id, v_commission,
    'Áudio da ata enviado para processamento',
    jsonb_build_object('meeting_id', v_meeting));

  return jsonb_build_object(
    'submitted', true, 'status', 'processing',
    'meeting_id', v_meeting, 'commission_id', v_commission);
end;
$$;

revoke execute on function public.submit_minutes_job(uuid, text) from public, anon;
grant execute on function public.submit_minutes_job(uuid, text) to authenticated;

-- =============================================================================
-- cancel_minutes_job — D9. The platform marks its own row cancelled IMMEDIATELY; the
-- service call and the object delete are best-effort and app-side (B5), so cancel works
-- with the service down. Cancelling an unreviewed `done` job is legal.
-- =============================================================================
create or replace function public.cancel_minutes_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_meeting    uuid;
  v_commission uuid;
  v_status     public.audio_job_status;
  v_path       text;
  v_service    text;
begin
  perform app.assert_audio_minutes_enabled();

  select j.meeting_id, j.status, j.audio_path, j.service_job_id
    into v_meeting, v_status, v_path, v_service
  from public.meeting_minutes_jobs j where j.id = p_job_id;

  v_commission := app.commission_of_meeting(v_meeting);
  if v_meeting is null or v_commission is null or not app.is_staff_admin_of(v_commission) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_status not in ('uploading', 'processing', 'done') then
    raise exception 'este processamento já foi encerrado' using errcode = 'HC0S3';
  end if;

  update public.meeting_minutes_jobs
  set status       = 'cancelled',
      cancelled_at = now(),
      result       = null,
      draft        = null,
      transcript   = null,
      purged_at    = now()
  where id = p_job_id;

  perform app.audit_write(
    'minutes_job.cancelled', 'meeting_minutes_job', p_job_id, v_commission,
    'Processamento de áudio da ata cancelado',
    jsonb_build_object('meeting_id', v_meeting, 'from_status', v_status::text));

  return jsonb_build_object(
    'cancelled', true, 'audio_path', v_path, 'service_job_id', v_service,
    'meeting_id', v_meeting, 'commission_id', v_commission);
end;
$$;

revoke execute on function public.cancel_minutes_job(uuid) from public, anon;
grant execute on function public.cancel_minutes_job(uuid) to authenticated;

-- =============================================================================
-- save_minutes_draft — the review page's debounced autosave. No audit row: an autosave
-- is not a lifecycle event and would flood the hash chain (D15 lists seven kinds; a
-- `.saved` kind is deliberately not among them).
-- =============================================================================
create or replace function public.save_minutes_draft(p_job_id uuid, p_draft jsonb)
returns timestamptz
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_meeting    uuid;
  v_commission uuid;
  v_status     public.audio_job_status;
  v_saved_at   timestamptz;
begin
  perform app.assert_audio_minutes_enabled();

  select j.meeting_id, j.status into v_meeting, v_status
  from public.meeting_minutes_jobs j where j.id = p_job_id;

  v_commission := app.commission_of_meeting(v_meeting);
  if v_meeting is null or v_commission is null or not app.is_staff_admin_of(v_commission) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_status is distinct from 'done' then
    raise exception 'esta revisão não está disponível' using errcode = 'HC0S3';
  end if;
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then
    raise exception 'rascunho da revisão inválido' using errcode = 'HC0S4';
  end if;
  -- Sanity cap (~2 MB) so a broken client cannot balloon the row.
  if octet_length(p_draft::text) > 2097152 then
    raise exception 'rascunho da revisão excede o tamanho permitido' using errcode = 'HC0S4';
  end if;

  update public.meeting_minutes_jobs
  set draft = p_draft
  where id = p_job_id
  returning updated_at into v_saved_at;

  return v_saved_at;
end;
$$;

revoke execute on function public.save_minutes_draft(uuid, jsonb) from public, anon;
grant execute on function public.save_minutes_draft(uuid, jsonb) to authenticated;

-- =============================================================================
-- apply_minutes_review — the D5/D6/D7/D12 transaction. Reads `draft`, NEVER `result`.
--
-- DRAFT CONTRACT (the shape B4 normalizes into and F3 edits):
--   {
--     "minutes_md": "…",
--     "agenda": [ { "ref": "<uuid|null>", "include": true, "title": "…",
--                   "discussion_notes": "…", "resolution": "…" } ],
--     "action_items": [ { "include": true, "title": "…", "description": "…",
--                         "assigned_to": "<uuid|null>", "due_date": "YYYY-MM-DD|null",
--                         "agenda_ref": "<uuid|null>" } ],
--     "next_meeting": { … }          -- ADVISORY (D7): read by the UI, ignored here
--   }
-- `include` defaults to true when absent. A `ref` that matches a live agenda row of THIS
-- meeting UPDATES it; a null or DANGLING ref CREATES an appended row (D6). A blank
-- discussion_notes/resolution in the draft LEAVES the existing text alone — striking an
-- item is `include:false`, never an empty string, so an autosave gap cannot erase
-- authored minutes.
-- =============================================================================
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

  select j.meeting_id, j.status, j.draft into v_meeting, v_status, v_draft
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
  -- Call the DOOR (B0 §4), never insert into action_items directly. It enforces the
  -- action_items flag (HC000), staff_admin authority, the assignee membership check
  -- (HC021), the initial status and the owner assignment mirror.
  for v_entry in
    select value from jsonb_array_elements(
      case when jsonb_typeof(v_draft->'action_items') = 'array' then v_draft->'action_items' else '[]'::jsonb end)
  loop
    continue when coalesce((v_entry->>'include')::boolean, true) = false;

    v_title := nullif(btrim(coalesce(v_entry->>'title', '')), '');
    continue when v_title is null;

    -- Resolve the owning agenda item: an existing row of this meeting, or one this
    -- apply just created for the same dangling ref.
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

    -- PO decision O2: an assignee failing the member check is DOWNGRADED to unassigned
    -- rather than aborting the apply. Checking here (instead of catching HC021) keeps
    -- the count honest and the transaction clean.
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
        -- Rule 10: the door's raw code must never reach the UI.
        raise exception 'o módulo de itens de ação não está disponível' using errcode = 'HC0S6';
      when sqlstate 'HC021' then
        raise exception 'o responsável indicado não é membro da comissão' using errcode = 'HC0S6';
    end;
    n_actions := n_actions + 1;
  end loop;

  -- ---------------- the ata itself (D5) ----------------
  -- B0 §7: guard_meeting_status keys on this GUC and triggers fire inside a DEFINER too.
  -- A `held` meeting would pass without it today; setting it matches the house pattern
  -- and keeps this correct if the rank rule tightens.
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
    'meeting_id', v_meeting);
end;
$$;

revoke execute on function public.apply_minutes_review(uuid) from public, anon;
grant execute on function public.apply_minutes_review(uuid) to authenticated;

-- =============================================================================
-- read_minutes_transcript — the audited single door (D8/D15).
--
-- It GATES ITSELF FIRST and only then records the access. Inferring authorization from
-- log_audit_access would be a noun-rule breach: app._audit_access_authorized returns
-- true early for platform_admin (B0 §3). This function is a READER — it performs no
-- write to meeting_minutes_jobs, which pgTAP 305 asserts by neutralization.
-- =============================================================================
create or replace function public.read_minutes_transcript(p_job_id uuid)
returns text
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid        uuid := auth.uid();
  v_meeting    uuid;
  v_commission uuid;
  v_transcript text;
begin
  perform app.assert_audio_minutes_enabled();

  select j.meeting_id, j.transcript into v_meeting, v_transcript
  from public.meeting_minutes_jobs j where j.id = p_job_id;
  v_commission := app.commission_of_meeting(v_meeting);

  -- The INDEPENDENT gate. Not-found, not-yours and not-done are one refusal.
  if v_meeting is null or v_commission is null
     or not app.can_read_minutes_transcript(p_job_id, v_uid) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  perform public.log_audit_access(
    'minutes_transcript.read', 'meeting_minutes_job', p_job_id, v_commission,
    'Transcrição do áudio da reunião consultada',
    jsonb_build_object('meeting_id', v_meeting));

  return v_transcript;
end;
$$;

revoke execute on function public.read_minutes_transcript(uuid) from public, anon;
grant execute on function public.read_minutes_transcript(uuid) to authenticated;

-- =============================================================================
-- Webhook helpers — service_role ONLY. No auth.uid(), no flag gate: the callback is the
-- service's, not a user's, and a flag flipped OFF mid-flight must not strand a row in
-- `processing` forever. Idempotent by a status LATCH (D9/D10): a re-delivery, or a
-- callback for a job the user already cancelled, is a no-op returning updated=false so
-- the route can answer 200 and stop the retry storm.
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
      -- ❗6: B6 passes the NORMALIZED + SANITIZED review shape; `result` is the fallback
      -- so the RPC is still correct if called with the plan's 3-argument form.
      draft       = coalesce(p_draft, p_result),
      transcript  = p_transcript,
      received_at = now()
  where id = p_job_id;

  perform app.audit_write(
    'minutes_job.completed', 'meeting_minutes_job', p_job_id, v_commission,
    'Ata gerada recebida do serviço de áudio',
    jsonb_build_object('meeting_id', v_meeting));

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
begin
  select j.meeting_id, j.status, j.requested_by, j.audio_path
    into v_meeting, v_status, v_requested, v_path
  from public.meeting_minutes_jobs j where j.id = p_job_id;

  -- ❗5: 'uploading' is in the latch. B5's reconciliation must be able to terminate an
  -- ABANDONED UPLOAD; with a processing-only latch that row could never leave the active
  -- set and meeting_minutes_jobs_active_uidx would block the meeting forever.
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

  return jsonb_build_object(
    'updated', true, 'status', 'failed',
    'meeting_id', v_meeting, 'commission_id', v_commission,
    'requested_by', v_requested, 'audio_path', v_path);
end;
$$;

revoke execute on function public.fail_minutes_job(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.fail_minutes_job(uuid, text, text) to service_role;

-- =============================================================================
-- The audited-read registry — B0 §3: the allowlist lives in TWO places and BOTH need the
-- new arm, or the door fails closed with a misleading message ("a new door must inherit
-- every sibling arm"). Both bodies below were taken from `pg_get_functiondef` on the
-- live catalog, not from any migration file, and are replaced WHOLE with the arm added.
-- `create or replace` preserves the existing ACL; the grants are re-applied anyway.
-- =============================================================================
create or replace function public.log_audit_access(
  p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid,
  p_summary text, p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened',
    'safety_event.viewed', 'triage.viewed', 'rca.viewed', 'capa.viewed',
    'meeting.viewed', 'interview.viewed',
    'referral_patient.read', 'referral.viewed',
    -- RV2 R5 (Rule 11): the audited internal-note read.
    'referral.note_viewed',
    'case_patient.read',
    'professional_profile.read',
    -- ADR 0063 F2: the audited attachment PHI-blob open.
    'attachment.read',
    -- MIN (ADR 0099 D8/D15): the audited meeting-transcript read.
    'minutes_transcript.read'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  if not app._audit_access_authorized(p_action, p_entity_id, p_commission) then
    raise exception 'log_audit_access: sem permissão para registrar este acesso'
      using errcode = '42501';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;

revoke execute on function public.log_audit_access(text, text, uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.log_audit_access(text, text, uuid, uuid, text, jsonb)
  to authenticated, service_role;

create or replace function app._audit_access_authorized(
  p_action text, p_entity_id uuid, p_commission uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_resp_commission uuid;
  v_commission uuid;
  v_att_owner_type text;
  v_att_owner_id uuid;
begin
  if v_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  case p_action
    when 'case.opened' then
      return app.can_read_case(p_entity_id, v_uid);
    when 'case_patient.read' then
      return app.can_read_case_patient(p_entity_id, v_uid);
    when 'professional_profile.read' then
      return app.can_read_professional_profile(p_entity_id, v_uid);

    -- ADR 0063 F2: the entity is the attachment id; resolve its owner and gate.
    when 'attachment.read' then
      select a.owner_type, a.owner_id into v_att_owner_type, v_att_owner_id
        from public.attachments a where a.id = p_entity_id;
      return v_att_owner_type is not null
             and app.can_read_attachment(v_att_owner_type, v_att_owner_id, v_uid);

    -- MIN (ADR 0099 D8/D15): the entity is the meeting_minutes_jobs id. The predicate
    -- has NO admin arm — but note the `is_admin()` short-circuit ABOVE still returns
    -- true for a platform_admin calling log_audit_access directly. That is a
    -- pre-existing property of all 18 arms, and precisely why
    -- public.read_minutes_transcript gates itself BEFORE recording rather than
    -- inferring authorization from this registry (B0 §3, noun rule ADR 0078 A35).
    when 'minutes_transcript.read' then
      return app.can_read_minutes_transcript(p_entity_id, v_uid);

    when 'event_patient.read' then
      return app.can_read_event_patient(p_entity_id, v_uid);
    when 'safety_event.viewed' then
      return app.can_read_event(p_entity_id, v_uid);
    when 'triage.viewed' then
      return app.can_read_event(p_entity_id, v_uid);

    when 'rca.viewed' then
      select event_id into v_event from public.rca where id = p_entity_id;
      return v_event is not null and app.can_read_event(v_event, v_uid);

    when 'capa.viewed' then
      return app.can_read_capa(p_entity_id, v_uid);

    when 'meeting.viewed' then
      select commission_id into v_commission from public.meetings where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));
    when 'interview.viewed' then
      select commission_id into v_commission from public.case_interviews where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_commission_admin_of(v_commission));

    when 'referral.viewed' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    when 'referral_patient.read' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    -- RV2 R5 (Rule 11): the audited internal-note READ. Entity is the referral id.
    when 'referral.note_viewed' then
      return app.can_read_referral_internal_notes(p_entity_id, v_uid);

    when 'response.opened_foreign' then
      select commission_id into v_resp_commission from public.responses where id = p_entity_id;
      return v_resp_commission is not null
             and (app.is_staff_admin_of(v_resp_commission)
                  or app.is_commission_admin_of(v_resp_commission));

    when 'response.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));
    when 'audit.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission));

    else
      return false;
  end case;
end;
$$;

revoke execute on function app._audit_access_authorized(text, uuid, uuid) from public, anon;
grant execute on function app._audit_access_authorized(text, uuid, uuid) to authenticated, service_role;

comment on function public.read_minutes_transcript(uuid) is
  'MIN D8/D15 — the audited single door to a job''s verbatim transcript. Gates on '
  'app.can_read_minutes_transcript FIRST (no platform_admin arm), then records exactly '
  'one minutes_transcript.read audit row. Pure reader: it writes nothing to '
  'meeting_minutes_jobs.';
comment on function public.apply_minutes_review(uuid) is
  'MIN D5/D6/D7/D12 — the single apply transaction. Reads `draft` (never `result`), '
  'merges the agenda, calls public.create_committee_action_item for kept action items, '
  'replaces meetings.minutes_md under app.in_meeting_rpc, then terminates and PURGES the '
  'job. Returns the counts for the success banner and the audit row.';
