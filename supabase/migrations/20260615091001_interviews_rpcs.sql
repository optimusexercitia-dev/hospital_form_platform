-- Phase 11 / B2 (2 of 4): Interviews RPCs — lifecycle, participants, attachments.
--
-- All lifecycle / locked-content mutations go through these RPCs, which set
-- app.in_interview_rpc = 'on' for the duration so the guard triggers
-- (app.guard_interview_status / app.guard_interview_child_lock) permit the
-- legitimate writes. Each public RPC gates app.assert_interviews_enabled().
--
-- AUTHORIZATION (the NEW participant-write shape): create_interview is
-- staff_admin/admin only (bootstrap — resolved decision 14). EVERY other write
-- authorizes via app.can_write_interview(interview_id, auth.uid()) → HC039, so a
-- registered interviewer (even a plain staff member) can edit/conclude their own
-- interview, while a non-interviewer staff cannot. These RPCs are SECURITY DEFINER
-- (the participant may have no table-level write RLS), with the can_write_interview
-- gate as the authority — mirroring how the meetings DEFINER RPCs internally gate.
--
-- SQLSTATEs (Phase 11): HC038 wrong interview state, HC039 not entitled to write,
-- HC040 invalid attachment, HC041 cannot conclude without a subject. HC021
-- (registered interviewer not a member) reused. no_data_found missing,
-- check_violation invalid input.

-- ===========================================================================
-- Helpers: resolve + authorize
-- ===========================================================================
-- app.assert_interview_writable(interview_id) — assert the interview exists and
-- the caller may WRITE it (staff_admin/admin OR a registered interviewer);
-- returns the commission id. The participant-write authority for every mutation
-- except create.
create function app.assert_interview_writable(p_interview_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id
  from public.case_interviews where id = p_interview_id;
  if v_commission_id is null then
    raise exception 'entrevista % não encontrada', p_interview_id using errcode = 'no_data_found';
  end if;
  if not app.can_write_interview(p_interview_id, auth.uid()) then
    raise exception 'você não pode editar esta entrevista' using errcode = 'HC039';
  end if;
  return v_commission_id;
end;
$$;

revoke all on function app.assert_interview_writable(uuid) from public;
grant execute on function app.assert_interview_writable(uuid) to authenticated, service_role;

-- public.interview_viewer_can_write(interview_id) -> boolean — the query layer's
-- "can the CURRENT user write this interview?" signal (the detail UI gates every
-- write control on it). Thin SECURITY DEFINER wrapper over app.can_write_interview
-- for auth.uid() (the app-schema helper is not callable via PostgREST). Returns
-- false for an unseen/absent interview (the caller already RLS-reads the row).
create function public.interview_viewer_can_write(p_interview_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.can_write_interview(p_interview_id, auth.uid());
$$;

grant execute on function public.interview_viewer_can_write(uuid) to authenticated, service_role;
revoke all on function public.interview_viewer_can_write(uuid) from public, anon;

-- ===========================================================================
-- create_interview — bootstrap (staff_admin/admin only)
-- ===========================================================================
-- Derives commission_id from the case (the denormalized honesty + phase-in-case
-- checks run in the BEFORE INSERT trigger app.guard_interview_links). status =
-- 'rascunho'. Mints interview_number with a bounded unique_violation retry.
create function public.create_interview(
  p_case_id uuid,
  p_title text default null,
  p_case_phase_id uuid default null,
  p_modality text default 'presencial',
  p_scheduled_start timestamptz default null,
  p_scheduled_end timestamptz default null,
  p_location_text text default null,
  p_meeting_url text default null
)
returns public.case_interviews
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_interviews;
  v_attempt integer := 0;
begin
  perform app.assert_interviews_enabled();

  select commission_id into v_commission_id from public.cases where id = p_case_id;
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Bootstrap is staff_admin/admin only (resolved decision 14).
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.case_interviews
        (commission_id, case_id, case_phase_id, title, modality,
         scheduled_start, scheduled_end, location_text, meeting_url, created_by)
      values
        (v_commission_id, p_case_id, p_case_phase_id, nullif(btrim(p_title), ''),
         coalesce(p_modality, 'presencial'), p_scheduled_start, p_scheduled_end,
         nullif(btrim(p_location_text), ''), nullif(btrim(p_meeting_url), ''), auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;

grant execute on function public.create_interview(uuid, text, uuid, text, timestamptz, timestamptz, text, text)
  to authenticated, service_role;

-- ===========================================================================
-- update_interview — header edit (writable; rejected once locked, HC038)
-- ===========================================================================
create function public.update_interview(
  p_interview_id uuid,
  p_title text default null,
  p_case_phase_id uuid default null,
  p_modality text default 'presencial',
  p_scheduled_start timestamptz default null,
  p_scheduled_end timestamptz default null,
  p_location_text text default null,
  p_meeting_url text default null
)
returns public.case_interviews
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status in ('concluida', 'cancelada') then
    raise exception 'a entrevista não pode ser editada neste estado' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set title = nullif(btrim(p_title), ''),
      case_phase_id = p_case_phase_id,
      modality = coalesce(p_modality, modality),
      scheduled_start = p_scheduled_start,
      scheduled_end = p_scheduled_end,
      location_text = nullif(btrim(p_location_text), ''),
      meeting_url = nullif(btrim(p_meeting_url), '')
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_interview(uuid, text, uuid, text, timestamptz, timestamptz, text, text)
  to authenticated, service_role;

-- update_interview_summary — persist ONLY summary_md (the markdown editor save).
create function public.update_interview_summary(
  p_interview_id uuid,
  p_summary_md text
)
returns public.case_interviews
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status in ('concluida', 'cancelada') then
    raise exception 'o resumo não pode ser editado neste estado' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews set summary_md = p_summary_md where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_interview_summary(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- Lifecycle: schedule / start / conclude / reopen / cancel
-- ===========================================================================
-- schedule_interview — rascunho -> agendada (requires a start).
create function public.schedule_interview(
  p_interview_id uuid,
  p_scheduled_start timestamptz,
  p_scheduled_end timestamptz default null
)
returns public.case_interviews
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  if p_scheduled_start is null then
    raise exception 'informe a data e hora da entrevista' using errcode = 'check_violation';
  end if;

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status <> 'rascunho' then
    raise exception 'apenas entrevistas em rascunho podem ser agendadas' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set status = 'agendada', scheduled_start = p_scheduled_start, scheduled_end = p_scheduled_end
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.schedule_interview(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- start_interview — agendada -> em_andamento, sets conducted_at.
create function public.start_interview(p_interview_id uuid)
returns public.case_interviews
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status <> 'agendada' then
    raise exception 'apenas entrevistas agendadas podem ser iniciadas' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set status = 'em_andamento', conducted_at = coalesce(conducted_at, now())
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.start_interview(uuid) to authenticated, service_role;

-- conclude_interview — em_andamento -> concluida (+ case_events registry row).
-- Requires >= 1 interviewee (HC041). Writes (first conclude) OR updates (re-conclude
-- after reopen, via registry_event_id) a SINGLE case_events kind='interview' row
-- so the case timeline never duplicates. SECURITY DEFINER so the case_events write
-- succeeds regardless of the writer's RLS on the case timeline (the
-- can_write_interview gate is the authority), mirroring conclude_meeting.
create function public.conclude_interview(p_interview_id uuid)
returns public.case_interviews
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_case_id uuid;
  v_number integer;
  v_summary text;
  v_conducted timestamptz;
  v_existing_event uuid;
  v_subject_count integer;
  v_subjects text;
  v_title text;
  v_body text;
  v_event_id uuid;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  v_commission_id := app.assert_interview_writable(p_interview_id);

  select status, case_id, interview_number, summary_md, conducted_at, registry_event_id
    into v_status, v_case_id, v_number, v_summary, v_conducted, v_existing_event
  from public.case_interviews where id = p_interview_id;

  if v_status <> 'em_andamento' then
    raise exception 'apenas entrevistas em andamento podem ser concluídas' using errcode = 'HC038';
  end if;

  -- Require >= 1 interviewee (resolved decision; HC041).
  select count(*) into v_subject_count
  from public.case_interview_subjects where interview_id = p_interview_id;
  if v_subject_count < 1 then
    raise exception 'adicione ao menos um entrevistado antes de concluir' using errcode = 'HC041';
  end if;

  -- Compose the timeline entry. Subjects roster = resolved display names.
  select string_agg(coalesce(p.full_name, s.external_name, 'Entrevistado'), ', ')
    into v_subjects
  from public.case_interview_subjects s
  left join public.profiles p on p.id = s.user_id
  where s.interview_id = p_interview_id;

  v_title := 'Entrevista nº ' || v_number
    || coalesce(': ' || nullif(btrim(v_subjects), ''), '');
  v_body := coalesce(nullif(btrim(v_summary), ''), 'Entrevista concluída.');

  perform set_config('app.in_interview_rpc', 'on', true);

  if v_existing_event is null then
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (v_case_id, 'interview', v_title, v_body,
            coalesce(v_conducted::date, current_date), auth.uid())
    returning id into v_event_id;
  else
    -- Re-conclude after a reopen: UPDATE the same row (no duplicate timeline entry).
    update public.case_events
    set title = v_title, body = v_body,
        occurred_at = coalesce(v_conducted::date, current_date),
        updated_at = now()
    where id = v_existing_event;
    v_event_id := v_existing_event;
  end if;

  update public.case_interviews
  set status = 'concluida', concluded_at = now(), concluded_by = auth.uid(),
      registry_event_id = v_event_id
  where id = p_interview_id
  returning * into v_result;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;

grant execute on function public.conclude_interview(uuid) to authenticated, service_role;

-- reopen_interview — concluida -> em_andamento. registry_event_id is KEPT so the
-- next conclude UPDATEs the same timeline row.
create function public.reopen_interview(p_interview_id uuid)
returns public.case_interviews
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status <> 'concluida' then
    raise exception 'apenas entrevistas concluídas podem ser reabertas' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set status = 'em_andamento', concluded_at = null, concluded_by = null
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.reopen_interview(uuid) to authenticated, service_role;

-- cancel_interview — any non-terminal state -> cancelada (terminal, NOT reopenable).
create function public.cancel_interview(p_interview_id uuid)
returns public.case_interviews
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status in ('concluida', 'cancelada') then
    raise exception 'esta entrevista não pode ser cancelada neste estado' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set status = 'cancelada', cancelled_at = now()
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.cancel_interview(uuid) to authenticated, service_role;

-- ===========================================================================
-- Subjects (interviewees) CRUD
-- ===========================================================================
create function public.add_interview_subject(
  p_interview_id uuid,
  p_user_id uuid default null,
  p_external_name text default null,
  p_clinical_role text default null,
  p_external_org text default null,
  p_note text default null
)
returns public.case_interview_subjects
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_result public.case_interview_subjects;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  -- A platform user XOR an external person (the table CHECK also enforces this).
  if (p_user_id is not null and nullif(btrim(p_external_name), '') is not null)
     or (p_user_id is null and nullif(btrim(p_external_name), '') is null) then
    raise exception 'informe um membro OU uma pessoa externa, não os dois'
      using errcode = 'check_violation';
  end if;
  -- An interviewee may be ANY platform user (not restricted to commission members).

  perform set_config('app.in_interview_rpc', 'on', true);
  insert into public.case_interview_subjects
    (interview_id, user_id, external_name, external_org, clinical_role, note)
  values
    (p_interview_id, p_user_id, nullif(btrim(p_external_name), ''),
     nullif(btrim(p_external_org), ''), nullif(btrim(p_clinical_role), ''),
     nullif(btrim(p_note), ''))
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.add_interview_subject(uuid, uuid, text, text, text, text)
  to authenticated, service_role;

create function public.update_interview_subject(
  p_subject_id uuid,
  p_clinical_role text default null,
  p_note text default null,
  p_external_name text default null,
  p_external_org text default null
)
returns public.case_interview_subjects
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_interview_id uuid;
  v_user_id uuid;
  v_result public.case_interview_subjects;
begin
  perform app.assert_interviews_enabled();
  select interview_id, user_id into v_interview_id, v_user_id
  from public.case_interview_subjects where id = p_subject_id;
  if v_interview_id is null then
    raise exception 'entrevistado não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interview_subjects
  set clinical_role = nullif(btrim(p_clinical_role), ''),
      note = nullif(btrim(p_note), ''),
      external_name = case when v_user_id is null
                           then coalesce(nullif(btrim(p_external_name), ''), external_name)
                           else external_name end,
      external_org = case when v_user_id is null
                          then nullif(btrim(p_external_org), '')
                          else external_org end
  where id = p_subject_id returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_interview_subject(uuid, text, text, text, text)
  to authenticated, service_role;

create function public.remove_interview_subject(p_subject_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_interview_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id
  from public.case_interview_subjects where id = p_subject_id;
  if v_interview_id is null then
    raise exception 'entrevistado não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  perform set_config('app.in_interview_rpc', 'on', true);
  delete from public.case_interview_subjects where id = p_subject_id;
  perform set_config('app.in_interview_rpc', 'off', true);
end;
$$;

grant execute on function public.remove_interview_subject(uuid) to authenticated, service_role;

-- ===========================================================================
-- Interviewers CRUD (registered interviewer must be a member → HC021)
-- ===========================================================================
create function public.add_interview_interviewer(
  p_interview_id uuid,
  p_user_id uuid default null,
  p_external_name text default null,
  p_external_org text default null,
  p_role text default 'entrevistador',
  p_note text default null
)
returns public.case_interview_interviewers
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_interview_interviewers;
begin
  perform app.assert_interviews_enabled();
  v_commission_id := app.assert_interview_writable(p_interview_id);

  if (p_user_id is not null and nullif(btrim(p_external_name), '') is not null)
     or (p_user_id is null and nullif(btrim(p_external_name), '') is null) then
    raise exception 'informe um membro OU um entrevistador externo, não os dois'
      using errcode = 'check_violation';
  end if;
  -- A REGISTERED interviewer must be a member of the commission (resolved decision 6).
  if p_user_id is not null and not app.is_member_of_for(v_commission_id, p_user_id) then
    raise exception 'o entrevistador deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  insert into public.case_interview_interviewers
    (interview_id, user_id, external_name, external_org, role, note)
  values
    (p_interview_id, p_user_id, nullif(btrim(p_external_name), ''),
     nullif(btrim(p_external_org), ''), coalesce(p_role, 'entrevistador'),
     nullif(btrim(p_note), ''))
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.add_interview_interviewer(uuid, uuid, text, text, text, text)
  to authenticated, service_role;

create function public.update_interview_interviewer(
  p_interviewer_id uuid,
  p_role text,
  p_note text default null,
  p_external_name text default null,
  p_external_org text default null
)
returns public.case_interview_interviewers
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_interview_id uuid;
  v_user_id uuid;
  v_result public.case_interview_interviewers;
begin
  perform app.assert_interviews_enabled();
  select interview_id, user_id into v_interview_id, v_user_id
  from public.case_interview_interviewers where id = p_interviewer_id;
  if v_interview_id is null then
    raise exception 'entrevistador não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interview_interviewers
  set role = coalesce(p_role, role),
      note = nullif(btrim(p_note), ''),
      external_name = case when v_user_id is null
                           then coalesce(nullif(btrim(p_external_name), ''), external_name)
                           else external_name end,
      external_org = case when v_user_id is null
                          then nullif(btrim(p_external_org), '')
                          else external_org end
  where id = p_interviewer_id returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_interview_interviewer(uuid, text, text, text, text)
  to authenticated, service_role;

create function public.remove_interview_interviewer(p_interviewer_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_interview_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id
  from public.case_interview_interviewers where id = p_interviewer_id;
  if v_interview_id is null then
    raise exception 'entrevistador não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  perform set_config('app.in_interview_rpc', 'on', true);
  delete from public.case_interview_interviewers where id = p_interviewer_id;
  perform set_config('app.in_interview_rpc', 'off', true);
end;
$$;

grant execute on function public.remove_interview_interviewer(uuid) to authenticated, service_role;

-- ===========================================================================
-- Attachments — metadata insert (file XOR link) + soft-delete
-- ===========================================================================
-- The file upload (Storage put) happens in the server action under the bucket
-- INSERT policy (keyed on can_write_interview via path segment [2]); this RPC
-- records the metadata row after the object lands, OR records an external link.
-- NOT child-locked (attachments may be added after conclusion — the signed
-- transcript case), so no parent-status gate, just the writability check.
create function public.add_interview_attachment(
  p_interview_id uuid,
  p_kind text,
  p_title text,
  p_storage_path text default null,
  p_external_url text default null,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns public.case_interview_attachments
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_has_path boolean := nullif(btrim(p_storage_path), '') is not null;
  v_has_link boolean := nullif(btrim(p_external_url), '') is not null;
  v_result public.case_interview_attachments;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para o anexo' using errcode = 'check_violation';
  end if;
  -- Exactly one source (HC040; the table CHECK backstops this).
  if v_has_path = v_has_link then
    raise exception 'envie um arquivo OU informe um link, não os dois' using errcode = 'HC040';
  end if;
  if v_has_link and p_external_url not like 'https://%' then
    raise exception 'o link deve começar com https://' using errcode = 'HC040';
  end if;

  insert into public.case_interview_attachments
    (interview_id, kind, title, storage_path, external_url, mime_type, size_bytes, uploaded_by)
  values
    (p_interview_id, coalesce(p_kind, 'outro'), btrim(p_title),
     nullif(btrim(p_storage_path), ''), nullif(btrim(p_external_url), ''),
     case when v_has_path then p_mime_type else null end,
     case when v_has_path then p_size_bytes else null end,
     auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.add_interview_attachment(uuid, text, text, text, text, text, bigint)
  to authenticated, service_role;

create function public.delete_interview_attachment(p_attachment_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_interview_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id
  from public.case_interview_attachments where id = p_attachment_id and deleted_at is null;
  if v_interview_id is null then
    raise exception 'anexo não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  -- SOFT delete (Rule 6: the Storage object is retained).
  update public.case_interview_attachments
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_attachment_id;
end;
$$;

grant execute on function public.delete_interview_attachment(uuid) to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE on every public function created above
-- ===========================================================================
revoke execute on function public.create_interview(uuid, text, uuid, text, timestamptz, timestamptz, text, text) from anon, public;
revoke execute on function public.update_interview(uuid, text, uuid, text, timestamptz, timestamptz, text, text) from anon, public;
revoke execute on function public.update_interview_summary(uuid, text) from anon, public;
revoke execute on function public.schedule_interview(uuid, timestamptz, timestamptz) from anon, public;
revoke execute on function public.start_interview(uuid) from anon, public;
revoke execute on function public.conclude_interview(uuid) from anon, public;
revoke execute on function public.reopen_interview(uuid) from anon, public;
revoke execute on function public.cancel_interview(uuid) from anon, public;
revoke execute on function public.add_interview_subject(uuid, uuid, text, text, text, text) from anon, public;
revoke execute on function public.update_interview_subject(uuid, text, text, text, text) from anon, public;
revoke execute on function public.remove_interview_subject(uuid) from anon, public;
revoke execute on function public.add_interview_interviewer(uuid, uuid, text, text, text, text) from anon, public;
revoke execute on function public.update_interview_interviewer(uuid, text, text, text, text) from anon, public;
revoke execute on function public.remove_interview_interviewer(uuid) from anon, public;
revoke execute on function public.add_interview_attachment(uuid, text, text, text, text, text, bigint) from anon, public;
revoke execute on function public.delete_interview_attachment(uuid) from anon, public;
