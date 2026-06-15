-- Phase 10 / B3: Meetings RPCs.
--
-- All mutations that bear lifecycle / locked-content / cross-table semantics go
-- through these RPCs, which set app.in_meeting_rpc = 'on' for the duration so the
-- guard triggers (app.guard_meeting_status / app.guard_meeting_child_lock) permit
-- the legitimate writes. Plain authoring children (agenda/attendee/case CRUD on
-- an UNLOCKED meeting) could be direct table writes under the staff_admin RLS,
-- but are exposed as RPCs too for a uniform, gate-checked, pt-BR-erroring surface
-- the server actions call. Each public RPC gates app.assert_meetings_enabled().
--
-- AUTHORIZATION: SECURITY INVOKER where the staff_admin-write RLS is sufficient
-- authority (+ an explicit is_staff_admin_of gate for a clean pt-BR forbidden);
-- SECURITY DEFINER only where a non-staff_admin legitimately writes (sign_meeting,
-- advance_meeting_action_item) or where a definer read is needed
-- (my_pending_meeting_signatures), each with its own internal gate.
--
-- SQLSTATEs (Phase 10): HC032 commission mismatch, HC033 wrong meeting state,
-- HC034 cannot conclude (no present attendee), HC035 already signed, HC036 not
-- entitled to sign, HC037 not entitled to update action item. HC021 (assignee not
-- a member) reused. 42501 forbidden, no_data_found missing, check_violation
-- blank/invalid input.

-- ===========================================================================
-- Helper: assert the caller is a staff_admin/admin of a meeting's commission
-- ===========================================================================
create function app.assert_meeting_staff_admin(p_meeting_id uuid)
returns uuid          -- returns the commission id for convenience
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  v_commission_id := app.commission_of_meeting(p_meeting_id);
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return v_commission_id;
end;
$$;

revoke all on function app.assert_meeting_staff_admin(uuid) from public;
grant execute on function app.assert_meeting_staff_admin(uuid) to authenticated, service_role;

-- ===========================================================================
-- create_meeting / update_meeting
-- ===========================================================================
-- create_meeting(commission, title, type, start, end, modality, location, url)
create function public.create_meeting(
  p_commission_id uuid,
  p_title text,
  p_meeting_type_id uuid default null,
  p_scheduled_start timestamptz default now(),
  p_scheduled_end timestamptz default null,
  p_modality text default 'presencial',
  p_location_text text default null,
  p_meeting_url text default null
)
returns public.meetings
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_result public.meetings;
  v_attempt integer := 0;
begin
  perform app.assert_meetings_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para a reunião' using errcode = 'check_violation';
  end if;
  -- A given type must belong to this commission.
  if p_meeting_type_id is not null and not exists (
    select 1 from public.commission_meeting_types
    where id = p_meeting_type_id and commission_id = p_commission_id
  ) then
    raise exception 'tipo de reunião inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);

  -- Bounded unique_violation retry for the per-commission number race (mirror
  -- create_case_from_template).
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.meetings
        (commission_id, meeting_type_id, title, scheduled_start, scheduled_end,
         modality, location_text, meeting_url, created_by)
      values
        (p_commission_id, p_meeting_type_id, btrim(p_title),
         p_scheduled_start, p_scheduled_end, coalesce(p_modality, 'presencial'),
         nullif(btrim(p_location_text), ''), nullif(btrim(p_meeting_url), ''), auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

grant execute on function public.create_meeting(uuid, text, uuid, timestamptz, timestamptz, text, text, text)
  to authenticated, service_role;

-- update_meeting — header edit, allowed ONLY while agendada/realizada (HC033).
-- p_minutes_md is included so the minutes editor and the header form share one
-- RPC; pass null to leave minutes unchanged is NOT possible (null clears) — the
-- caller always sends the current minutes. (The TS layer splits updateMeeting /
-- updateMeetingMinutes but both land here.)
-- Param order: REQUIRED first (meeting_id, title, scheduled_start, modality),
-- then the OPTIONAL/nullable ones with defaults — so supabase-gen marks the
-- latter optional and the TS action can pass them as undefined.
create function public.update_meeting(
  p_meeting_id uuid,
  p_title text,
  p_scheduled_start timestamptz,
  p_modality text,
  p_meeting_type_id uuid default null,
  p_scheduled_end timestamptz default null,
  p_location_text text default null,
  p_meeting_url text default null,
  p_minutes_md text default null
)
returns public.meetings
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status not in ('agendada', 'realizada') then
    raise exception 'a reunião não pode ser editada neste estado' using errcode = 'HC033';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para a reunião' using errcode = 'check_violation';
  end if;
  if p_meeting_type_id is not null and not exists (
    select 1 from public.commission_meeting_types
    where id = p_meeting_type_id and commission_id = v_commission_id
  ) then
    raise exception 'tipo de reunião inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set title = btrim(p_title),
      meeting_type_id = p_meeting_type_id,
      scheduled_start = p_scheduled_start,
      scheduled_end = p_scheduled_end,
      modality = coalesce(p_modality, modality),
      location_text = nullif(btrim(p_location_text), ''),
      meeting_url = nullif(btrim(p_meeting_url), ''),
      minutes_md = p_minutes_md,
      updated_at = now()
  where id = p_meeting_id
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_meeting(uuid, text, timestamptz, text, uuid, timestamptz, text, text, text)
  to authenticated, service_role;

-- update_meeting_minutes — persist ONLY minutes_md (the markdown editor save).
-- Allowed while agendada/realizada (HC033). Separate from update_meeting so the
-- editor doesn't have to round-trip the whole header.
create function public.update_meeting_minutes(
  p_meeting_id uuid,
  p_minutes_md text
)
returns public.meetings
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status not in ('agendada', 'realizada') then
    raise exception 'a ata não pode ser editada neste estado' using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings set minutes_md = p_minutes_md, updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_meeting_minutes(uuid, text) to authenticated, service_role;

-- set_meeting_quorum_met — the secretary's quorum override. Allowed at/after
-- conclusion (em_assinatura) — before that there is no quorum snapshot to amend.
create function public.set_meeting_quorum_met(
  p_meeting_id uuid,
  p_quorum_met boolean
)
returns public.meetings
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status <> 'em_assinatura' then
    raise exception 'o quórum só pode ser ajustado enquanto a ata aguarda assinatura'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings set quorum_met = p_quorum_met, updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.set_meeting_quorum_met(uuid, boolean) to authenticated, service_role;

-- ===========================================================================
-- conclude_meeting — realizada -> em_assinatura (snapshot + case_events)
-- ===========================================================================
-- Validates state=realizada (HC033) + >= 1 present attendee (HC034); snapshots
-- the quorum rule + counts and computes quorum_met per the commission rule;
-- writes a case_events (kind='meeting') row per linked case; flips to
-- em_assinatura. SECURITY DEFINER so the case_events writes succeed regardless of
-- the staff_admin's RLS on another member's case timeline (the internal
-- is_staff_admin_of gate is the authority), mirroring the cases definer writes.
create function public.conclude_meeting(p_meeting_id uuid)
returns public.meetings
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_rule text;
  v_value numeric;
  v_present integer;
  v_eligible integer;
  v_quorum_met boolean;
  v_result public.meetings;
  r_link record;
begin
  perform app.assert_meetings_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.meetings where id = p_meeting_id;
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  -- DEFINER: internal staff_admin gate (the RLS bypass is intentional, so the
  -- gate is the authority).
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- Conclude is reachable from agendada OR realizada. The lifecycle is
  -- agendada -> realizada -> em_assinatura; "Concluir" is the single staff action
  -- that records the meeting as HELD and sends the ata to signature, so when the
  -- meeting is still agendada it is first advanced through realizada (a guarded
  -- step) before the conclusion flip. This keeps the frozen frontend contract
  -- (concludeMeeting(meetingId), no separate "mark held" action) intact.
  if v_status not in ('agendada', 'realizada') then
    raise exception 'apenas reuniões agendadas ou realizadas podem ser concluídas'
      using errcode = 'HC033';
  end if;

  -- Quorum math (snapshot at conclusion; resolved design decision 7).
  -- present_count counts PRESENT PLATFORM attendees only: external guests
  -- (user_id is null) never count toward quorum (ADR 0025 / plan §7), and this
  -- must match the sign_meeting auto-flip's "required signers" set, which is
  -- likewise `user_id is not null and attendance = 'presente'`.
  select count(*) into v_eligible
  from public.commission_members where commission_id = v_commission_id;
  select count(*) into v_present
  from public.meeting_attendees
  where meeting_id = p_meeting_id and attendance = 'presente' and user_id is not null;

  if v_present < 1 then
    raise exception 'registre ao menos um participante presente antes de concluir'
      using errcode = 'HC034';
  end if;

  select quorum_rule_type, quorum_value into v_rule, v_value
  from public.commission_meeting_settings where commission_id = v_commission_id;
  v_rule := coalesce(v_rule, 'maioria_simples');

  v_quorum_met := case v_rule
    when 'maioria_simples' then v_present > v_eligible / 2.0
    when 'fixed_count' then v_present >= coalesce(v_value, 0)
    when 'percentage' then v_present >= ceil(v_eligible * coalesce(v_value, 0) / 100.0)
    else false
  end;

  perform set_config('app.in_meeting_rpc', 'on', true);

  -- The guard permits agendada->realizada and realizada->em_assinatura, but NOT
  -- agendada->em_assinatura directly. If still agendada, step through realizada
  -- first (under the flag) so both legal transitions are honoured.
  if v_status = 'agendada' then
    update public.meetings set status = 'realizada', updated_at = now()
    where id = p_meeting_id;
  end if;

  update public.meetings
  set status = 'em_assinatura',
      quorum_rule_type = v_rule,
      quorum_value = v_value,
      present_count = v_present,
      eligible_member_count = v_eligible,
      quorum_met = v_quorum_met,
      concluded_at = now(),
      concluded_by = auth.uid(),
      updated_at = now()
  where id = p_meeting_id
  returning * into v_result;

  -- Write a case_events (kind='meeting') row per linked case (resolved design
  -- decision 4) so the discussion shows on the case timeline.
  for r_link in
    select mc.case_id, mc.summary, mc.decision, m.meeting_number
    from public.meeting_cases mc
    join public.meetings m on m.id = mc.meeting_id
    where mc.meeting_id = p_meeting_id
  loop
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (
      r_link.case_id,
      'meeting',
      'Discutido na Reunião nº ' || r_link.meeting_number,
      coalesce(
        nullif(btrim(concat_ws(E'\n\n',
          nullif(btrim(r_link.summary), ''),
          case when nullif(btrim(r_link.decision), '') is not null
               then 'Decisão: ' || btrim(r_link.decision) end
        )), ''),
        'Caso discutido nesta reunião.'
      ),
      current_date,
      auth.uid()
    );
  end loop;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

grant execute on function public.conclude_meeting(uuid) to authenticated, service_role;

-- ===========================================================================
-- reopen_meeting — em_assinatura/assinada -> realizada (REVOKE signatures)
-- ===========================================================================
-- staff_admin re-opens a locked meeting to amend it; all ACTIVE signatures are
-- flipped to 'revoked' (rows kept for the audit trail). SECURITY DEFINER so it
-- revokes signatures it did not author (no UPDATE policy on meeting_signatures).
create function public.reopen_meeting(p_meeting_id uuid)
returns public.meetings
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.meetings where id = p_meeting_id;
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status not in ('em_assinatura', 'assinada') then
    raise exception 'apenas reuniões em assinatura ou assinadas podem ser reabertas'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);

  update public.meeting_signatures
  set status = 'revoked'
  where meeting_id = p_meeting_id and status = 'signed';

  update public.meetings
  set status = 'realizada', concluded_at = null, concluded_by = null, updated_at = now()
  where id = p_meeting_id
  returning * into v_result;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

grant execute on function public.reopen_meeting(uuid) to authenticated, service_role;

-- ===========================================================================
-- distribute_meeting — assinada -> distribuida (terminal)
-- ===========================================================================
create function public.distribute_meeting(p_meeting_id uuid)
returns public.meetings
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status <> 'assinada' then
    raise exception 'apenas reuniões assinadas podem ser distribuídas' using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set status = 'distribuida', distributed_at = now(), updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.distribute_meeting(uuid) to authenticated, service_role;

-- ===========================================================================
-- cancel_meeting — any non-terminal state -> cancelada (terminal)
-- ===========================================================================
create function public.cancel_meeting(p_meeting_id uuid)
returns public.meetings
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status in ('distribuida', 'cancelada') then
    raise exception 'esta reunião está em um estado final e não pode ser cancelada'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set status = 'cancelada', cancelled_at = now(), updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.cancel_meeting(uuid) to authenticated, service_role;

-- ===========================================================================
-- Agenda CRUD + reorder
-- ===========================================================================
create function public.create_meeting_agenda_item(
  p_meeting_id uuid,
  p_title text,
  p_description text default null,
  p_discussion_notes text default null,
  p_resolution text default null
)
returns public.meeting_agenda_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_position integer;
  v_result public.meeting_agenda_items;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para o item de pauta' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.meeting_agenda_items where meeting_id = p_meeting_id;

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_agenda_items
    (meeting_id, position, title, description, discussion_notes, resolution, created_by)
  values
    (p_meeting_id, v_position, btrim(p_title), nullif(btrim(p_description), ''),
     nullif(btrim(p_discussion_notes), ''), nullif(btrim(p_resolution), ''), auth.uid())
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.create_meeting_agenda_item(uuid, text, text, text, text)
  to authenticated, service_role;

create function public.update_meeting_agenda_item(
  p_agenda_item_id uuid,
  p_title text,
  p_description text default null,
  p_discussion_notes text default null,
  p_resolution text default null
)
returns public.meeting_agenda_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
  v_result public.meeting_agenda_items;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id from public.meeting_agenda_items where id = p_agenda_item_id;
  if v_meeting_id is null then
    raise exception 'item de pauta não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para o item de pauta' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meeting_agenda_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      discussion_notes = nullif(btrim(p_discussion_notes), ''),
      resolution = nullif(btrim(p_resolution), ''),
      updated_at = now()
  where id = p_agenda_item_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_meeting_agenda_item(uuid, text, text, text, text)
  to authenticated, service_role;

create function public.delete_meeting_agenda_item(p_agenda_item_id uuid)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id from public.meeting_agenda_items where id = p_agenda_item_id;
  if v_meeting_id is null then
    raise exception 'item de pauta não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  delete from public.meeting_agenda_items where id = p_agenda_item_id;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

grant execute on function public.delete_meeting_agenda_item(uuid) to authenticated, service_role;

-- reorder_meeting_agenda_item(id, direction) — adjacent swap (mirror reorder_section).
create function public.reorder_meeting_agenda_item(
  p_agenda_item_id uuid,
  p_direction text
)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
  v_position integer;
  v_neighbor_id uuid;
  v_neighbor_position integer;
begin
  perform app.assert_meetings_enabled();
  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select meeting_id, position into v_meeting_id, v_position
  from public.meeting_agenda_items where id = p_agenda_item_id;
  if v_meeting_id is null then
    raise exception 'item de pauta não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.meeting_agenda_items
    where meeting_id = v_meeting_id and position < v_position
    order by position desc limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.meeting_agenda_items
    where meeting_id = v_meeting_id and position > v_position
    order by position asc limit 1;
  end if;

  if v_neighbor_id is null then
    return; -- boundary; silent no-op
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meeting_agenda_items
  set position = case id
                   when p_agenda_item_id then v_neighbor_position
                   when v_neighbor_id then v_position
                 end,
      updated_at = now()
  where id in (p_agenda_item_id, v_neighbor_id);
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

grant execute on function public.reorder_meeting_agenda_item(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- Attendee CRUD + seed_expected_meeting_attendees
-- ===========================================================================
create function public.add_meeting_attendee(
  p_meeting_id uuid,
  p_user_id uuid default null,
  p_external_name text default null,
  p_external_org text default null,
  p_role text default 'membro',
  p_attendance text default 'convocado',
  p_note text default null
)
returns public.meeting_attendees
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.meeting_attendees;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);

  -- A platform member XOR an external guest (the table CHECK also enforces this;
  -- raise a clean pt-BR here first).
  if (p_user_id is not null and nullif(btrim(p_external_name), '') is not null)
     or (p_user_id is null and nullif(btrim(p_external_name), '') is null) then
    raise exception 'informe um membro OU um convidado externo, não os dois'
      using errcode = 'check_violation';
  end if;
  -- A platform attendee must be a member of the commission.
  if p_user_id is not null and not app.is_member_of_for(v_commission_id, p_user_id) then
    raise exception 'o participante deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_attendees
    (meeting_id, user_id, external_name, external_org, role, attendance, note)
  values
    (p_meeting_id, p_user_id, nullif(btrim(p_external_name), ''), nullif(btrim(p_external_org), ''),
     coalesce(p_role, 'membro'), coalesce(p_attendance, 'convocado'), nullif(btrim(p_note), ''))
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.add_meeting_attendee(uuid, uuid, text, text, text, text, text)
  to authenticated, service_role;

create function public.update_meeting_attendee(
  p_attendee_id uuid,
  p_role text,
  p_attendance text,
  p_note text default null,
  p_external_name text default null,
  p_external_org text default null
)
returns public.meeting_attendees
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
  v_user_id uuid;
  v_result public.meeting_attendees;
begin
  perform app.assert_meetings_enabled();
  select meeting_id, user_id into v_meeting_id, v_user_id
  from public.meeting_attendees where id = p_attendee_id;
  if v_meeting_id is null then
    raise exception 'participante não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meeting_attendees
  set role = coalesce(p_role, role),
      attendance = coalesce(p_attendance, attendance),
      note = nullif(btrim(p_note), ''),
      -- Guest name/org are editable only for external attendees (user_id null).
      external_name = case when v_user_id is null
                           then coalesce(nullif(btrim(p_external_name), ''), external_name)
                           else external_name end,
      external_org = case when v_user_id is null
                          then nullif(btrim(p_external_org), '')
                          else external_org end,
      updated_at = now()
  where id = p_attendee_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.update_meeting_attendee(uuid, text, text, text, text, text)
  to authenticated, service_role;

create function public.remove_meeting_attendee(p_attendee_id uuid)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id from public.meeting_attendees where id = p_attendee_id;
  if v_meeting_id is null then
    raise exception 'participante não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  delete from public.meeting_attendees where id = p_attendee_id;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

grant execute on function public.remove_meeting_attendee(uuid) to authenticated, service_role;

-- seed_expected_meeting_attendees — insert all current commission members as
-- convocado/membro attendees, idempotent (ON CONFLICT on the partial-unique).
create function public.seed_expected_meeting_attendees(p_meeting_id uuid)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select p_meeting_id, cm.user_id, 'membro', 'convocado'
  from public.commission_members cm
  where cm.commission_id = v_commission_id
  on conflict (meeting_id, user_id) where user_id is not null do nothing;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

grant execute on function public.seed_expected_meeting_attendees(uuid) to authenticated, service_role;

-- ===========================================================================
-- link / unlink case
-- ===========================================================================
create function public.link_meeting_case(
  p_meeting_id uuid,
  p_case_id uuid,
  p_agenda_item_id uuid default null,
  p_summary text default null,
  p_decision text default null
)
returns public.meeting_cases
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_result public.meeting_cases;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);
  -- The same-commission guard (HC032) + agenda-item-belongs check run in the
  -- BEFORE INSERT trigger app.guard_meeting_cases.

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_cases (meeting_id, case_id, agenda_item_id, summary, decision)
  values (p_meeting_id, p_case_id, p_agenda_item_id,
          nullif(btrim(p_summary), ''), nullif(btrim(p_decision), ''))
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.link_meeting_case(uuid, uuid, uuid, text, text)
  to authenticated, service_role;

create function public.unlink_meeting_case(p_case_link_id uuid)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id from public.meeting_cases where id = p_case_link_id;
  if v_meeting_id is null then
    raise exception 'vínculo de caso não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  delete from public.meeting_cases where id = p_case_link_id;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

grant execute on function public.unlink_meeting_case(uuid) to authenticated, service_role;

-- ===========================================================================
-- Attachment metadata insert + soft-delete
-- ===========================================================================
-- The upload itself (Storage put) happens in the server action under the bucket
-- policy; this RPC records the metadata row after the object lands. NOT gated by
-- the child-lock (attachments may be added even after signing — e.g. the signed
-- ata PDF) so it is a plain staff_admin write, no app.in_meeting_rpc.
create function public.add_meeting_attachment(
  p_meeting_id uuid,
  p_kind text,
  p_title text,
  p_storage_path text,
  p_mime_type text default null,
  p_size_bytes bigint default null
)
returns public.meeting_attachments
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_result public.meeting_attachments;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para o anexo' using errcode = 'check_violation';
  end if;

  insert into public.meeting_attachments
    (meeting_id, kind, title, storage_path, mime_type, size_bytes, uploaded_by)
  values
    (p_meeting_id, coalesce(p_kind, 'outro'), btrim(p_title), p_storage_path,
     p_mime_type, p_size_bytes, auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.add_meeting_attachment(uuid, text, text, text, text, bigint)
  to authenticated, service_role;

create function public.delete_meeting_attachment(p_attachment_id uuid)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id
  from public.meeting_attachments where id = p_attachment_id and deleted_at is null;
  if v_meeting_id is null then
    raise exception 'anexo não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  -- SOFT delete (Rule 6: the Storage object is retained).
  update public.meeting_attachments
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_attachment_id;
end;
$$;

grant execute on function public.delete_meeting_attachment(uuid) to authenticated, service_role;

-- ===========================================================================
-- sign_meeting — the internal e-signature (DEFINER; content_hash + auto-flip)
-- ===========================================================================
-- The present platform attendee signs their OWN row. DEFINER so it can: (a) read
-- the locked minutes to hash, (b) count signatures across the meeting and flip
-- the status. The actual signature INSERT goes THROUGH the sign-own-row RLS
-- policy (the insert is re-checked against meeting_signatures_insert /
-- app.can_sign_meeting), so WHO may sign stays in RLS even though the function is
-- DEFINER — we set role to the caller is NOT needed because the WITH CHECK reads
-- auth.uid()/signer_id, which DEFINER preserves. content_hash uses the
-- extensions.digest() qualifier (pgcrypto is installed in the extensions schema,
-- which is NOT on the pinned search_path).
--
-- AUTO-FLIP: after a successful insert, if every PRESENT PLATFORM attendee now
-- has an ACTIVE signature, flip em_assinatura -> assinada inside this RPC (under
-- app.in_meeting_rpc) — NOT a row trigger (resolved design decision 2; avoids the
-- cases auto-status pitfalls).
create function public.sign_meeting(
  p_attendee_id uuid,
  p_method text default 'internal_eauth',
  p_note text default null
)
returns public.meeting_signatures
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_meeting_id uuid;
  v_status text;
  v_minutes text;
  v_hash text;
  v_uid uuid := auth.uid();
  v_required integer;
  v_signed integer;
  v_result public.meeting_signatures;
begin
  perform app.assert_meetings_enabled();

  select a.meeting_id, m.status, m.minutes_md
    into v_meeting_id, v_status, v_minutes
  from public.meeting_attendees a
  join public.meetings m on m.id = a.meeting_id
  where a.id = p_attendee_id;

  if v_meeting_id is null then
    raise exception 'participante não encontrado' using errcode = 'no_data_found';
  end if;
  if v_status <> 'em_assinatura' then
    raise exception 'esta reunião não está aguardando assinatura' using errcode = 'HC033';
  end if;

  v_hash := encode(extensions.digest(coalesce(v_minutes, ''), 'sha256'), 'hex');

  -- ELIGIBILITY: this function is SECURITY DEFINER (owned by a superuser), so the
  -- INSERT below BYPASSES the meeting_signatures_insert RLS policy entirely —
  -- RLS is not enforced for the table owner. We therefore re-assert the same
  -- predicate (app.can_sign_meeting) EXPLICITLY here: only a PRESENT PLATFORM
  -- attendee whose user_id = the caller, on an em_assinatura meeting in the
  -- caller's commission, may sign their OWN row. The sign-own-row RLS policy
  -- remains the authority for any DIRECT (invoker) insert path; this explicit
  -- check is the authority for THIS definer path. (HC036.)
  if not app.can_sign_meeting(p_attendee_id, v_uid) then
    raise exception 'apenas participantes presentes podem assinar a ata' using errcode = 'HC036';
  end if;

  -- Insert the signature. A double-sign collides with the active partial-unique
  -- (meeting_signatures_active_key) -> unique_violation -> HC035. signer_id MUST
  -- be the acting user (asserted by can_sign_meeting above).
  begin
    insert into public.meeting_signatures
      (meeting_id, attendee_id, signer_id, method, status, content_hash, note)
    values
      (v_meeting_id, p_attendee_id, v_uid, coalesce(p_method, 'internal_eauth'),
       'signed', v_hash, nullif(btrim(p_note), ''))
    returning * into v_result;
  exception
    when unique_violation then
      raise exception 'você já assinou esta ata' using errcode = 'HC035';
  end;

  -- Count required (present platform attendees) vs. active signatures.
  select count(*) into v_required
  from public.meeting_attendees
  where meeting_id = v_meeting_id and user_id is not null and attendance = 'presente';

  select count(*) into v_signed
  from public.meeting_signatures
  where meeting_id = v_meeting_id and status = 'signed';

  -- AUTO-FLIP em_assinatura -> assinada when the last required signature lands.
  if v_required > 0 and v_signed >= v_required then
    perform set_config('app.in_meeting_rpc', 'on', true);
    update public.meetings set status = 'assinada', updated_at = now()
    where id = v_meeting_id and status = 'em_assinatura';
    perform set_config('app.in_meeting_rpc', 'off', true);
  end if;

  return v_result;
end;
$$;

grant execute on function public.sign_meeting(uuid, text, text) to authenticated, service_role;

-- ===========================================================================
-- Action items — create / update / advance / complete / (delete via RLS)
-- ===========================================================================
create function public.create_meeting_action_item(
  p_meeting_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_date date default null,
  p_source_agenda_item_id uuid default null,
  p_case_id uuid default null
)
returns public.meeting_action_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.meeting_action_items;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  -- A source agenda item, if given, must belong to THIS meeting.
  if p_source_agenda_item_id is not null and not exists (
    select 1 from public.meeting_agenda_items
    where id = p_source_agenda_item_id and meeting_id = p_meeting_id
  ) then
    raise exception 'o item de pauta de origem não pertence a esta reunião'
      using errcode = 'check_violation';
  end if;
  -- The case cross-link's same-commission is enforced by guard_meeting_action_item (HC032).

  insert into public.meeting_action_items
    (meeting_id, commission_id, source_agenda_item_id, case_id, title, description,
     assigned_to, due_date, created_by)
  values
    (p_meeting_id, v_commission_id, p_source_agenda_item_id, p_case_id,
     btrim(p_title), nullif(btrim(p_description), ''), p_assigned_to, p_due_date, auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_meeting_action_item(uuid, text, text, uuid, date, uuid, uuid)
  to authenticated, service_role;

create function public.update_meeting_action_item(
  p_action_item_id uuid,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_due_date date default null
)
returns public.meeting_action_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.meeting_action_items;
begin
  perform app.assert_meetings_enabled();
  select commission_id into v_commission_id
  from public.meeting_action_items where id = p_action_item_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  update public.meeting_action_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      updated_at = now()
  where id = p_action_item_id returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_meeting_action_item(uuid, text, text, uuid, date)
  to authenticated, service_role;

-- app.advance_meeting_action_item_core — assignee OR staff_admin (HC037). DEFINER
-- so a plain ASSIGNEE (no UPDATE RLS) can move status; the internal gate is the
-- authority. Mirror app.advance_action_item_core.
create function app.advance_meeting_action_item_core(
  p_action_item_id uuid,
  p_status text
)
returns public.meeting_action_items
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_assigned_to uuid;
  v_uid uuid := auth.uid();
  v_result public.meeting_action_items;
begin
  if p_status not in ('open', 'in_progress', 'done', 'cancelled') then
    raise exception 'estado de item inválido' using errcode = 'check_violation';
  end if;

  select commission_id, assigned_to into v_commission_id, v_assigned_to
  from public.meeting_action_items where id = p_action_item_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;

  if not (
    (v_assigned_to is not null and v_assigned_to = v_uid)
    or app.is_staff_admin_of(v_commission_id)
    or app.is_admin()
  ) then
    raise exception 'você não pode alterar este item de ação' using errcode = 'HC037';
  end if;

  update public.meeting_action_items
  set status = p_status,
      completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'done' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_item_id returning * into v_result;

  return v_result;
end;
$$;

revoke all on function app.advance_meeting_action_item_core(uuid, text) from public;
grant execute on function app.advance_meeting_action_item_core(uuid, text) to authenticated, service_role;

create function public.advance_meeting_action_item(
  p_action_item_id uuid,
  p_status text
)
returns public.meeting_action_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_meetings_enabled();
  return app.advance_meeting_action_item_core(p_action_item_id, p_status);
end;
$$;

grant execute on function public.advance_meeting_action_item(uuid, text) to authenticated, service_role;

create function public.complete_meeting_action_item(p_action_item_id uuid)
returns public.meeting_action_items
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_meetings_enabled();
  return app.advance_meeting_action_item_core(p_action_item_id, 'done');
end;
$$;

grant execute on function public.complete_meeting_action_item(uuid) to authenticated, service_role;

-- NOTE on CANCEL vs DELETE (mirror case_action_items): CANCEL is
-- advance_meeting_action_item(id,'cancelled') (keeps the audit row);
-- HARD-DELETE is a direct DELETE under the staff_admin-write RLS (deleteMeetingActionItem).

-- ===========================================================================
-- my_pending_meeting_signatures() — the shell badge + queue (DEFINER read)
-- ===========================================================================
-- Meetings where the CURRENT user is a PRESENT PLATFORM attendee of an
-- em_assinatura meeting AND has no ACTIVE signature yet. DEFINER + internally
-- scoped to auth.uid() (mirror list_signoff_queue). Returns one row per pending
-- meeting with the attendee_id to sign for.
create function public.my_pending_meeting_signatures()
returns table (
  meeting_id uuid,
  meeting_number integer,
  title text,
  scheduled_start timestamptz,
  attendee_id uuid
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  return query
  select m.id, m.meeting_number, m.title, m.scheduled_start, a.id
  from public.meeting_attendees a
  join public.meetings m on m.id = a.meeting_id
  where a.user_id = v_uid
    and a.attendance = 'presente'
    and m.status = 'em_assinatura'
    and not exists (
      select 1 from public.meeting_signatures s
      where s.attendee_id = a.id and s.status = 'signed'
    )
  order by m.scheduled_start asc;
end;
$$;

grant execute on function public.my_pending_meeting_signatures() to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE on every public function created above
-- ===========================================================================
revoke execute on function public.create_meeting(uuid, text, uuid, timestamptz, timestamptz, text, text, text) from anon, public;
revoke execute on function public.update_meeting(uuid, text, timestamptz, text, uuid, timestamptz, text, text, text) from anon, public;
revoke execute on function public.update_meeting_minutes(uuid, text) from anon, public;
revoke execute on function public.set_meeting_quorum_met(uuid, boolean) from anon, public;
revoke execute on function public.conclude_meeting(uuid) from anon, public;
revoke execute on function public.reopen_meeting(uuid) from anon, public;
revoke execute on function public.distribute_meeting(uuid) from anon, public;
revoke execute on function public.cancel_meeting(uuid) from anon, public;
revoke execute on function public.create_meeting_agenda_item(uuid, text, text, text, text) from anon, public;
revoke execute on function public.update_meeting_agenda_item(uuid, text, text, text, text) from anon, public;
revoke execute on function public.delete_meeting_agenda_item(uuid) from anon, public;
revoke execute on function public.reorder_meeting_agenda_item(uuid, text) from anon, public;
revoke execute on function public.add_meeting_attendee(uuid, uuid, text, text, text, text, text) from anon, public;
revoke execute on function public.update_meeting_attendee(uuid, text, text, text, text, text) from anon, public;
revoke execute on function public.remove_meeting_attendee(uuid) from anon, public;
revoke execute on function public.seed_expected_meeting_attendees(uuid) from anon, public;
revoke execute on function public.link_meeting_case(uuid, uuid, uuid, text, text) from anon, public;
revoke execute on function public.unlink_meeting_case(uuid) from anon, public;
revoke execute on function public.add_meeting_attachment(uuid, text, text, text, text, bigint) from anon, public;
revoke execute on function public.delete_meeting_attachment(uuid) from anon, public;
revoke execute on function public.sign_meeting(uuid, text, text) from anon, public;
revoke execute on function public.create_meeting_action_item(uuid, text, text, uuid, date, uuid, uuid) from anon, public;
revoke execute on function public.update_meeting_action_item(uuid, text, text, uuid, date) from anon, public;
revoke execute on function public.advance_meeting_action_item(uuid, text) from anon, public;
revoke execute on function public.complete_meeting_action_item(uuid) from anon, public;
revoke execute on function public.my_pending_meeting_signatures() from anon, public;
