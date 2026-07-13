-- =============================================================================
-- Interviews v2 (IV2) · I2 — RPC surface (SECURITY DEFINER; REVOKE→GRANT per t19).
-- =============================================================================
-- Re-maps the interview RPCs to the sessions model (ADR 0070; plan §I2 + §4 state
-- machine) and adds the session commands. Every write RPC: assert_interviews_enabled
-- + the writability assert + the `app.in_interview_rpc` guard the incumbents use.
-- Mutation audit is emitted via `app.audit_write(...)` (mirrors interview.created /
-- interview.status_changed) — NOT log_audit_access, which is the audited-READ door
-- (interviews are non-PHI; S0 ratification §D).
--
-- SQLSTATE: HC0B0 = schedule precondition (interview not in a schedulable state);
-- HC0B1 = missing/invalid interview_category; HC0B2 = missing/invalid
-- relationship_to_case. All session/interview state-transition errors reuse HC038;
-- not-writable stays HC039 (via assert_interview_writable). HC0B3-HC0B9 reserved.
--
-- Signature changes force DROP+CREATE (resets grants → REVOKE ALL FROM PUBLIC +
-- GRANT authenticated, service_role is re-issued for every function below).
-- =============================================================================

-- Drop the superseded signatures (scheduling args gone; interview-level schedule/
-- start removed entirely; subject RPCs gain p_relationship_to_case).
drop function if exists public.create_interview(uuid, text, uuid, text, timestamptz, timestamptz, text, text);
drop function if exists public.update_interview(uuid, text, uuid, text, timestamptz, timestamptz, text, text);
drop function if exists public.schedule_interview(uuid, timestamptz, timestamptz);
drop function if exists public.start_interview(uuid);
drop function if exists public.add_interview_subject(uuid, uuid, text, text, text, text);
drop function if exists public.update_interview_subject(uuid, text, text, text, text);

-- =============================================================================
-- Interview-level RPCs (re-mapped)
-- =============================================================================

-- create_interview — drops all scheduling args; requires interview_category
-- (RPC-enforced, HC0B1); confidentiality_level defaults to 'standard'. Creates the
-- interview in `draft` (column default). staff_admin/commission-admin bootstrap
-- (authz reproduced verbatim from the live definition; is_commission_admin_of per
-- ADR 0051). p_title/p_case_phase_id/p_interview_category carry defaults so the
-- signature is legal (category "required" is enforced in the body).
create or replace function public.create_interview(
  p_case_id uuid,
  p_title text default null,
  p_case_phase_id uuid default null,
  p_interview_category text default null,
  p_confidentiality_level text default 'standard'
) returns public.case_interviews
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
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
  -- Bootstrap is staff_admin/commission-admin only (live authz; ADR 0051).
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if p_interview_category is null
     or p_interview_category not in ('witness', 'subject', 'clinical_team', 'expert',
        'complainant', 'respondent', 'administrative', 'other') then
    raise exception 'informe uma categoria válida para a entrevista' using errcode = 'HC0B1';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.case_interviews
        (commission_id, case_id, case_phase_id, title, interview_category,
         confidentiality_level, created_by)
      values
        (v_commission_id, p_case_id, p_case_phase_id, nullif(btrim(p_title), ''),
         p_interview_category, coalesce(nullif(btrim(p_confidentiality_level), ''), 'standard'),
         auth.uid())
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
alter function public.create_interview(uuid, text, uuid, text, text) owner to postgres;
revoke all on function public.create_interview(uuid, text, uuid, text, text) from public;
grant execute on function public.create_interview(uuid, text, uuid, text, text) to authenticated, service_role;

-- update_interview — drops scheduling args; title/phase/category/confidentiality
-- editable. Emits interview.confidentiality_changed when the level changes. HC038
-- when the interview is terminal.
create or replace function public.update_interview(
  p_interview_id uuid,
  p_title text default null,
  p_case_phase_id uuid default null,
  p_interview_category text default null,
  p_confidentiality_level text default null
) returns public.case_interviews
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_status text;
  v_old_conf text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status, confidentiality_level into v_status, v_old_conf
  from public.case_interviews where id = p_interview_id;
  if v_status in ('completed', 'cancelled') then
    raise exception 'a entrevista não pode ser editada neste estado' using errcode = 'HC038';
  end if;

  if p_interview_category is not null
     and p_interview_category not in ('witness', 'subject', 'clinical_team', 'expert',
        'complainant', 'respondent', 'administrative', 'other') then
    raise exception 'informe uma categoria válida para a entrevista' using errcode = 'HC0B1';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set title = nullif(btrim(p_title), ''),
      case_phase_id = p_case_phase_id,
      interview_category = coalesce(nullif(btrim(p_interview_category), ''), interview_category),
      confidentiality_level = coalesce(nullif(btrim(p_confidentiality_level), ''), confidentiality_level)
  where id = p_interview_id
  returning * into v_result;

  if v_result.confidentiality_level is distinct from v_old_conf then
    perform app.audit_write('interview.confidentiality_changed', 'interview', p_interview_id,
      v_result.commission_id,
      'Confidencialidade da entrevista: ' || v_old_conf || ' → ' || v_result.confidentiality_level,
      jsonb_build_object('old', v_old_conf, 'new', v_result.confidentiality_level));
  end if;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.update_interview(uuid, text, uuid, text, text) owner to postgres;
revoke all on function public.update_interview(uuid, text, uuid, text, text) from public;
grant execute on function public.update_interview(uuid, text, uuid, text, text) to authenticated, service_role;

-- conclude_interview — precondition widened to {in_progress, awaiting_follow_up}
-- (HC038 otherwise); keeps the ≥1-subject guard (HC041). Recomposes the single
-- case_events registry row from session actuals (count + earliest completed
-- actual_start). Re-conclude after a reopen UPDATEs the SAME row (registry stays
-- exactly one per interview).
create or replace function public.conclude_interview(p_interview_id uuid)
    returns public.case_interviews
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_commission_id uuid;
  v_status text;
  v_case_id uuid;
  v_number integer;
  v_summary text;
  v_existing_event uuid;
  v_subject_count integer;
  v_subjects text;
  v_session_count integer;
  v_first_start timestamptz;
  v_title text;
  v_body text;
  v_event_id uuid;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  v_commission_id := app.assert_interview_writable(p_interview_id);

  select status, case_id, interview_number, summary_md, registry_event_id
    into v_status, v_case_id, v_number, v_summary, v_existing_event
  from public.case_interviews where id = p_interview_id;

  if v_status not in ('in_progress', 'awaiting_follow_up') then
    raise exception 'apenas entrevistas em andamento ou aguardando follow-up podem ser concluídas'
      using errcode = 'HC038';
  end if;

  select count(*) into v_subject_count
  from public.case_interview_subjects where interview_id = p_interview_id;
  if v_subject_count < 1 then
    raise exception 'adicione ao menos um entrevistado antes de concluir' using errcode = 'HC041';
  end if;

  select string_agg(coalesce(p.full_name, s.external_name, 'Entrevistado'), ', ')
    into v_subjects
  from public.case_interview_subjects s
  left join public.profiles p on p.id = s.user_id
  where s.interview_id = p_interview_id;

  -- Recompose from session actuals (IV2: replaces the dropped conducted_at).
  select count(*), min(actual_start)
    into v_session_count, v_first_start
  from public.interview_sessions
  where interview_id = p_interview_id and status = 'completed';

  v_title := 'Entrevista nº ' || v_number
    || coalesce(': ' || nullif(btrim(v_subjects), ''), '');
  v_body := coalesce(nullif(btrim(v_summary), ''), 'Entrevista concluída.')
    || case when v_session_count > 0
            then E'\n\n_' || v_session_count || ' sessão(ões) realizada(s)._'
            else '' end;

  perform set_config('app.in_interview_rpc', 'on', true);

  if v_existing_event is null then
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (v_case_id, 'interview', v_title, v_body,
            coalesce(v_first_start::date, current_date), auth.uid())
    returning id into v_event_id;
  else
    update public.case_events
    set title = v_title, body = v_body,
        occurred_at = coalesce(v_first_start::date, current_date),
        updated_at = now()
    where id = v_existing_event;
    v_event_id := v_existing_event;
  end if;

  update public.case_interviews
  set status = 'completed', concluded_at = now(), concluded_by = auth.uid(),
      registry_event_id = v_event_id
  where id = p_interview_id
  returning * into v_result;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.conclude_interview(uuid) owner to postgres;
revoke all on function public.conclude_interview(uuid) from public;
grant execute on function public.conclude_interview(uuid) to authenticated, service_role;

-- cancel_interview — cascades every non-terminal session (scheduled/in_progress)
-- to `cancelled` BEFORE flipping the interview (so the session child-lock, which
-- fires on the interview's terminal state, is not self-blocked). HC038 if terminal.
create or replace function public.cancel_interview(p_interview_id uuid)
    returns public.case_interviews
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status in ('completed', 'cancelled') then
    raise exception 'esta entrevista não pode ser cancelada neste estado' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);

  -- Cascade FIRST (interview still non-terminal → child-lock passes).
  update public.interview_sessions
  set status = 'cancelled',
      cancellation_reason = coalesce(cancellation_reason, 'entrevista cancelada')
  where interview_id = p_interview_id and status in ('scheduled', 'in_progress');

  update public.case_interviews
  set status = 'cancelled', cancelled_at = now()
  where id = p_interview_id
  returning * into v_result;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.cancel_interview(uuid) owner to postgres;
revoke all on function public.cancel_interview(uuid) from public;
grant execute on function public.cancel_interview(uuid) to authenticated, service_role;

-- =============================================================================
-- Session-level RPCs (new)
-- =============================================================================

-- schedule_session — insert a `scheduled` session (sequence_number = max+1;
-- default type = initial for seq 1, else follow_up); flip interview draft →
-- scheduled. HC0B0 if the interview is not in a schedulable state.
create or replace function public.schedule_session(
  p_interview_id uuid,
  p_session_type text default null,
  p_modality text default null,
  p_scheduled_start timestamptz default null,
  p_scheduled_end timestamptz default null,
  p_location_text text default null,
  p_meeting_url text default null
) returns public.interview_sessions
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_status text;
  v_seq integer;
  v_type text;
  v_result public.interview_sessions;
  v_attempt integer := 0;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status is null then
    raise exception 'entrevista % não encontrada', p_interview_id using errcode = 'no_data_found';
  end if;
  if v_status not in ('draft', 'scheduled', 'in_progress', 'awaiting_follow_up') then
    raise exception 'não é possível agendar uma sessão neste estado da entrevista'
      using errcode = 'HC0B0';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      select coalesce(max(sequence_number), 0) + 1 into v_seq
      from public.interview_sessions where interview_id = p_interview_id;
      v_type := coalesce(nullif(btrim(p_session_type), ''),
                         case when v_seq = 1 then 'initial' else 'follow_up' end);
      insert into public.interview_sessions
        (interview_id, sequence_number, session_type, status, modality,
         scheduled_start, scheduled_end, location_text, meeting_url, created_by)
      values
        (p_interview_id, v_seq, v_type, 'scheduled', nullif(btrim(p_modality), ''),
         p_scheduled_start, p_scheduled_end, nullif(btrim(p_location_text), ''),
         nullif(btrim(p_meeting_url), ''), auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  update public.case_interviews set status = 'scheduled'
  where id = p_interview_id and status = 'draft';

  perform app.audit_write('interview.session_scheduled', 'interview', p_interview_id,
    app.commission_of_interview(p_interview_id),
    'Sessão nº ' || v_seq || ' agendada'
      || coalesce(' para ' || to_char(p_scheduled_start, 'DD/MM/YYYY HH24:MI'), ''),
    jsonb_build_object('session_id', v_result.id, 'sequence_number', v_seq, 'session_type', v_type));

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.schedule_session(uuid, text, text, timestamptz, timestamptz, text, text) owner to postgres;
revoke all on function public.schedule_session(uuid, text, text, timestamptz, timestamptz, text, text) from public;
grant execute on function public.schedule_session(uuid, text, text, timestamptz, timestamptz, text, text) to authenticated, service_role;

-- update_session — reschedule/edit a non-terminal session in place. On a schedule
-- change, emit interview.session_rescheduled with the old→new summary line (this
-- replaces a schedule-history table). HC038 if the session is terminal.
create or replace function public.update_session(
  p_session_id uuid,
  p_session_type text default null,
  p_modality text default null,
  p_scheduled_start timestamptz default null,
  p_scheduled_end timestamptz default null,
  p_location_text text default null,
  p_meeting_url text default null
) returns public.interview_sessions
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_interview_id uuid;
  v_status text;
  v_seq integer;
  v_old_start timestamptz;
  v_old_end timestamptz;
  v_result public.interview_sessions;
begin
  perform app.assert_interviews_enabled();
  select interview_id, status, sequence_number, scheduled_start, scheduled_end
    into v_interview_id, v_status, v_seq, v_old_start, v_old_end
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);
  if v_status in ('completed', 'cancelled', 'no_show') then
    raise exception 'esta sessão não pode ser editada neste estado' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.interview_sessions
  set session_type = coalesce(nullif(btrim(p_session_type), ''), session_type),
      modality = nullif(btrim(p_modality), ''),
      scheduled_start = p_scheduled_start,
      scheduled_end = p_scheduled_end,
      location_text = nullif(btrim(p_location_text), ''),
      meeting_url = nullif(btrim(p_meeting_url), '')
  where id = p_session_id
  returning * into v_result;

  if v_result.scheduled_start is distinct from v_old_start
     or v_result.scheduled_end is distinct from v_old_end then
    perform app.audit_write('interview.session_rescheduled', 'interview', v_interview_id,
      app.commission_of_interview(v_interview_id),
      'Sessão nº ' || v_seq || ' reagendada: '
        || coalesce(to_char(v_old_start, 'DD/MM/YYYY HH24:MI'), '—') || ' → '
        || coalesce(to_char(v_result.scheduled_start, 'DD/MM/YYYY HH24:MI'), '—'),
      jsonb_build_object('session_id', p_session_id,
        'old_start', v_old_start, 'new_start', v_result.scheduled_start,
        'old_end', v_old_end, 'new_end', v_result.scheduled_end));
  end if;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.update_session(uuid, text, text, timestamptz, timestamptz, text, text) owner to postgres;
revoke all on function public.update_session(uuid, text, text, timestamptz, timestamptz, text, text) from public;
grant execute on function public.update_session(uuid, text, text, timestamptz, timestamptz, text, text) to authenticated, service_role;

-- start_session — scheduled → in_progress, actual_start = now(); flip interview
-- {scheduled, awaiting_follow_up} → in_progress. HC038 if the session is not
-- scheduled. (Written/async: the caller starts on receipt, then completes.)
create or replace function public.start_session(p_session_id uuid)
    returns public.interview_sessions
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_interview_id uuid;
  v_status text;
  v_result public.interview_sessions;
begin
  perform app.assert_interviews_enabled();
  select interview_id, status into v_interview_id, v_status
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);
  if v_status <> 'scheduled' then
    raise exception 'apenas sessões agendadas podem ser iniciadas' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.interview_sessions set status = 'in_progress', actual_start = now()
  where id = p_session_id
  returning * into v_result;

  update public.case_interviews set status = 'in_progress'
  where id = v_interview_id and status in ('scheduled', 'awaiting_follow_up');

  perform app.audit_write('interview.session_started', 'interview', v_interview_id,
    app.commission_of_interview(v_interview_id),
    'Sessão nº ' || v_result.sequence_number || ' iniciada',
    jsonb_build_object('session_id', p_session_id));

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.start_session(uuid) owner to postgres;
revoke all on function public.start_session(uuid) from public;
grant execute on function public.start_session(uuid) to authenticated, service_role;

-- complete_session — in_progress → completed, actual_end. Side-effect (kept in the
-- RPC, not a trigger, so it stays auditable/testable): flip interview →
-- awaiting_follow_up IFF another `scheduled` session exists, else stay in_progress.
create or replace function public.complete_session(
  p_session_id uuid,
  p_actual_end timestamptz default now()
) returns public.interview_sessions
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_interview_id uuid;
  v_status text;
  v_has_scheduled boolean;
  v_result public.interview_sessions;
begin
  perform app.assert_interviews_enabled();
  select interview_id, status into v_interview_id, v_status
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);
  if v_status <> 'in_progress' then
    raise exception 'apenas sessões em andamento podem ser concluídas' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.interview_sessions set status = 'completed', actual_end = coalesce(p_actual_end, now())
  where id = p_session_id
  returning * into v_result;

  select exists (
    select 1 from public.interview_sessions
    where interview_id = v_interview_id and status = 'scheduled' and id <> p_session_id
  ) into v_has_scheduled;

  if v_has_scheduled then
    update public.case_interviews set status = 'awaiting_follow_up'
    where id = v_interview_id and status = 'in_progress';
  end if;

  perform app.audit_write('interview.session_completed', 'interview', v_interview_id,
    app.commission_of_interview(v_interview_id),
    'Sessão nº ' || v_result.sequence_number || ' concluída',
    jsonb_build_object('session_id', p_session_id, 'awaiting_follow_up', v_has_scheduled));

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.complete_session(uuid, timestamptz) owner to postgres;
revoke all on function public.complete_session(uuid, timestamptz) from public;
grant execute on function public.complete_session(uuid, timestamptz) to authenticated, service_role;

-- cancel_session — → cancelled (+reason). Terminal; never hard-deleted. HC038 if
-- the session is already completed.
create or replace function public.cancel_session(p_session_id uuid, p_reason text default null)
    returns public.interview_sessions
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_interview_id uuid;
  v_status text;
  v_result public.interview_sessions;
begin
  perform app.assert_interviews_enabled();
  select interview_id, status into v_interview_id, v_status
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);
  if v_status = 'completed' then
    raise exception 'uma sessão concluída não pode ser cancelada' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.interview_sessions
  set status = 'cancelled',
      cancellation_reason = coalesce(nullif(btrim(p_reason), ''), cancellation_reason)
  where id = p_session_id
  returning * into v_result;

  perform app.audit_write('interview.session_cancelled', 'interview', v_interview_id,
    app.commission_of_interview(v_interview_id),
    'Sessão nº ' || v_result.sequence_number || ' cancelada',
    jsonb_build_object('session_id', p_session_id, 'reason', nullif(btrim(p_reason), '')));

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.cancel_session(uuid, text) owner to postgres;
revoke all on function public.cancel_session(uuid, text) from public;
grant execute on function public.cancel_session(uuid, text) to authenticated, service_role;

-- no_show_session — → no_show (+reason). Terminal; never hard-deleted. HC038 if the
-- session is already completed.
create or replace function public.no_show_session(p_session_id uuid, p_reason text default null)
    returns public.interview_sessions
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_interview_id uuid;
  v_status text;
  v_result public.interview_sessions;
begin
  perform app.assert_interviews_enabled();
  select interview_id, status into v_interview_id, v_status
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);
  if v_status = 'completed' then
    raise exception 'uma sessão concluída não pode ser marcada como não comparecimento' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.interview_sessions
  set status = 'no_show',
      cancellation_reason = coalesce(nullif(btrim(p_reason), ''), cancellation_reason)
  where id = p_session_id
  returning * into v_result;

  perform app.audit_write('interview.session_no_show', 'interview', v_interview_id,
    app.commission_of_interview(v_interview_id),
    'Sessão nº ' || v_result.sequence_number || ' registrada como não comparecimento',
    jsonb_build_object('session_id', p_session_id, 'reason', nullif(btrim(p_reason), '')));

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.no_show_session(uuid, text) owner to postgres;
revoke all on function public.no_show_session(uuid, text) from public;
grant execute on function public.no_show_session(uuid, text) to authenticated, service_role;

-- =============================================================================
-- Subject RPCs (relationship_to_case required — HC0B2)
-- =============================================================================

-- add_interview_subject — platform member XOR external person; relationship_to_case
-- required (RPC-enforced, HC0B2). clinical_role (free text) kept.
create or replace function public.add_interview_subject(
  p_interview_id uuid,
  p_user_id uuid default null,
  p_external_name text default null,
  p_clinical_role text default null,
  p_external_org text default null,
  p_note text default null,
  p_relationship_to_case text default null
) returns public.case_interview_subjects
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_result public.case_interview_subjects;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  if (p_user_id is not null and nullif(btrim(p_external_name), '') is not null)
     or (p_user_id is null and nullif(btrim(p_external_name), '') is null) then
    raise exception 'informe um membro OU uma pessoa externa, não os dois'
      using errcode = 'check_violation';
  end if;

  if p_relationship_to_case is null
     or p_relationship_to_case not in ('attending_physician', 'consulting_physician', 'nurse',
        'other_professional', 'witness', 'complainant', 'respondent', 'subject', 'expert',
        'committee_member', 'other') then
    raise exception 'informe uma relação válida do entrevistado com o caso' using errcode = 'HC0B2';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  insert into public.case_interview_subjects
    (interview_id, user_id, external_name, external_org, clinical_role, note, relationship_to_case)
  values
    (p_interview_id, p_user_id, nullif(btrim(p_external_name), ''),
     nullif(btrim(p_external_org), ''), nullif(btrim(p_clinical_role), ''),
     nullif(btrim(p_note), ''), p_relationship_to_case)
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;
alter function public.add_interview_subject(uuid, uuid, text, text, text, text, text) owner to postgres;
revoke all on function public.add_interview_subject(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.add_interview_subject(uuid, uuid, text, text, text, text, text) to authenticated, service_role;

-- update_interview_subject — clinical_role/note (external also name/org) +
-- relationship_to_case (kept if not provided; HC0B2 if provided-invalid).
create or replace function public.update_interview_subject(
  p_subject_id uuid,
  p_clinical_role text default null,
  p_note text default null,
  p_external_name text default null,
  p_external_org text default null,
  p_relationship_to_case text default null
) returns public.case_interview_subjects
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
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

  if p_relationship_to_case is not null
     and p_relationship_to_case not in ('attending_physician', 'consulting_physician', 'nurse',
        'other_professional', 'witness', 'complainant', 'respondent', 'subject', 'expert',
        'committee_member', 'other') then
    raise exception 'informe uma relação válida do entrevistado com o caso' using errcode = 'HC0B2';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interview_subjects
  set clinical_role = nullif(btrim(p_clinical_role), ''),
      note = nullif(btrim(p_note), ''),
      external_name = case when v_user_id is null
                           then coalesce(nullif(btrim(p_external_name), ''), external_name)
                           else external_name end,
      external_org = case when v_user_id is null
                          then nullif(btrim(p_external_org), '')
                          else external_org end,
      relationship_to_case = coalesce(p_relationship_to_case, relationship_to_case)
  where id = p_subject_id returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;
alter function public.update_interview_subject(uuid, text, text, text, text, text) owner to postgres;
revoke all on function public.update_interview_subject(uuid, text, text, text, text, text) from public;
grant execute on function public.update_interview_subject(uuid, text, text, text, text, text) to authenticated, service_role;
