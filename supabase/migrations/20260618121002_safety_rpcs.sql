-- Phase 14a / B4: Patient-Safety / NSP — lifecycle RPCs, the PHI-free queue, the
-- mutation-audit triggers (PHI-free allow-lists), and the feature-flag flip ON.
-- ADR 0030/0031. All RPCs are SECURITY DEFINER, gate app.assert_patient_safety_enabled(),
-- and set app.in_safety_rpc = 'on' for the duration of any write so the state-machine
-- / custody guards admit the legitimate change (mirror the meetings/interviews RPCs).
--
-- Authorization model:
--   * notify_safety_event — JUST-CULTURE exception (ADR 0030): ANY member of the
--     reporting commission may file (not just staff_admin). It opens the initial PQS
--     custody interval and, when case-linked, writes the case_events 'safety_event' row.
--   * acknowledge_event / cancel_event / update_event — the current custodian (PQS, or
--     a staff_admin of the holding commission) or admin. HC044 when not the custodian.
--   * transfer_event_custody — the current custodian only (HC044 otherwise).
--   * set_event_patient — the current custodian (PHI write); audited identifier-free.
--   * pqs_inbox — is_pqs_member-gated, PHI-FREE governance queue.
--
-- Mutation-audit (Rule 11): AFTER triggers on patient_safety_event + event_custody
-- diff a PHI-FREE column allow-list ONLY; event_patient audits "updated + who" with
-- NO identifier in metadata. description_md / title / location / all identifiers are
-- the no-fly zone (Rule 1 + Rule 11). The TS-side AuditAction / AuditEntityType union
-- members for these verbs are added (additively) in B5.

-- ===========================================================================
-- app.event_current_custodian(event_id, uid) -> boolean    (custody write gate)
-- ===========================================================================
-- TRUE when uid may act as the current custodian of the event: admin/PQS, OR a
-- staff_admin of the event's current-owner commission (when commission-held). Used by
-- the lifecycle RPCs to raise HC044. SECURITY DEFINER + uid-pure (pgTAP-assertable).
create function app.event_current_custodian(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_pqs_member(p_user_id)
        or (e.current_owner_kind = 'commission'
            and app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id))
      )
  );
$$;

revoke all on function app.event_current_custodian(uuid, uuid) from public;
grant execute on function app.event_current_custodian(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- notify_safety_event(...) — file an event (ANY member of the reporting commission)
-- ===========================================================================
-- Just-culture write exception. Mints the code (one-shot unique_violation retry over
-- the advisory-locked mint), inserts the event at status 'reported' / owner = PQS,
-- opens the initial PQS custody interval, and — when case-linked — writes the
-- case_events 'safety_event' row (Phase-12 timeline). Returns the new event id + code.
create function public.notify_safety_event(
  p_reporting_commission_id uuid,
  p_title text,
  p_description_md text default null,
  p_suspected_harm_level text default 'unknown',
  p_case_id uuid default null,
  p_event_type_id uuid default null,
  p_location text default null,
  p_discovered_at date default null
)
returns public.patient_safety_event
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_event public.patient_safety_event;
  v_attempts int := 0;
  v_case_commission uuid;
begin
  perform app.assert_patient_safety_enabled();

  -- Authorize: ANY member of the reporting commission (just-culture), or admin.
  if not (app.is_member_of(p_reporting_commission_id) or app.is_admin()) then
    raise exception 'apenas membros da comissão notificante podem registrar um evento'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para o evento' using errcode = 'check_violation';
  end if;

  -- A case-linked event's case must belong to the reporting commission (honesty).
  if p_case_id is not null then
    select commission_id into v_case_commission from public.cases where id = p_case_id;
    if v_case_commission is null then
      raise exception 'caso não encontrado' using errcode = 'P0002';
    end if;
    if v_case_commission <> p_reporting_commission_id then
      raise exception 'o caso não pertence à comissão notificante' using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);

  -- Insert with a bounded retry over the minted code (the trigger mints it; the
  -- unique(code) backstops a rare concurrent collision).
  loop
    begin
      insert into public.patient_safety_event (
        reporting_commission_id, case_id, discovered_at, location, reported_by,
        event_type_id, suspected_harm_level, title, description_md,
        status, current_owner_kind, current_owner_commission_id
      ) values (
        p_reporting_commission_id, p_case_id, p_discovered_at, p_location, auth.uid(),
        p_event_type_id, coalesce(p_suspected_harm_level, 'unknown'), p_title, p_description_md,
        'reported', 'pqs', null
      )
      returning * into v_event;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;

  -- Open the initial custody interval at the NSP.
  insert into public.event_custody (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values (v_event.id, 'pqs', null, auth.uid(), 'Notificação inicial ao NSP');

  -- Case-linked: write the Phase-12 timeline entry (body is NOT NULL).
  if p_case_id is not null then
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (
      p_case_id, 'safety_event',
      'Evento de segurança ' || v_event.code,
      'Evento ' || v_event.code || ' notificado ao NSP: ' || p_title,
      coalesce(p_discovered_at, current_date), auth.uid()
    );
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_event;
end;
$$;

revoke all on function public.notify_safety_event(uuid, text, text, text, uuid, uuid, text, date) from public, anon;
grant execute on function public.notify_safety_event(uuid, text, text, text, uuid, uuid, text, date) to authenticated, service_role;

-- ===========================================================================
-- acknowledge_event(event) — reported -> acknowledged (NSP takes receipt)
-- ===========================================================================
create function public.acknowledge_event(p_event_id uuid)
returns public.patient_safety_event
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_event public.patient_safety_event;
  v_status text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode reconhecê-lo'
      using errcode = 'HC044';
  end if;

  select status into v_status from public.patient_safety_event where id = p_event_id;
  if v_status <> 'reported' then
    raise exception 'apenas eventos notificados podem ser reconhecidos' using errcode = 'HC043';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now(),
      updated_at = now()
  where id = p_event_id
  returning * into v_event;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_event;
end;
$$;

revoke all on function public.acknowledge_event(uuid) from public, anon;
grant execute on function public.acknowledge_event(uuid) to authenticated, service_role;

-- ===========================================================================
-- transfer_event_custody(event, to_owner_kind, to_commission?, note) — hand-off
-- ===========================================================================
-- Closes the open interval (held_until = now()) and appends a new one, updating the
-- denormalized owner on the event — atomically, under the flag (the custody guard
-- admits exactly the held_until close). HC044 if the caller is not the current
-- custodian. Access-follows-custody: the new holder gains read, the reporting
-- commission keeps it (provenance), a foreign committee gains nothing.
create function public.transfer_event_custody(
  p_event_id uuid,
  p_to_owner_kind text,
  p_to_commission_id uuid default null,
  p_note text default null
)
returns public.patient_safety_event
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_event public.patient_safety_event;
  v_status text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode transferi-la'
      using errcode = 'HC044';
  end if;

  select status into v_status from public.patient_safety_event where id = p_event_id;
  if v_status in ('closed', 'cancelled') then
    raise exception 'um evento encerrado ou cancelado não pode ter a custódia transferida'
      using errcode = 'HC043';
  end if;

  if p_to_owner_kind not in ('pqs', 'commission') then
    raise exception 'destino de custódia inválido' using errcode = 'check_violation';
  end if;
  if p_to_owner_kind = 'commission' and p_to_commission_id is null then
    raise exception 'selecione a comissão de destino' using errcode = 'check_violation';
  end if;
  if p_to_owner_kind = 'pqs' then
    p_to_commission_id := null;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);

  -- Close the open interval (the guard admits exactly this held_until move).
  update public.event_custody
  set held_until = now()
  where event_id = p_event_id and held_until is null;

  -- Append the new interval.
  insert into public.event_custody (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values (p_event_id, p_to_owner_kind, p_to_commission_id, auth.uid(), p_note);

  -- Update the denormalized owner head (drives access-follows-custody RLS).
  update public.patient_safety_event
  set current_owner_kind = p_to_owner_kind,
      current_owner_commission_id = p_to_commission_id,
      updated_at = now()
  where id = p_event_id
  returning * into v_event;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_event;
end;
$$;

revoke all on function public.transfer_event_custody(uuid, text, uuid, text) from public, anon;
grant execute on function public.transfer_event_custody(uuid, text, uuid, text) to authenticated, service_role;

-- ===========================================================================
-- update_event(event, fields…) — governance edits (not status, not PHI)
-- ===========================================================================
create function public.update_event(
  p_event_id uuid,
  p_title text,
  p_description_md text default null,
  p_suspected_harm_level text default 'unknown',
  p_event_type_id uuid default null,
  p_location text default null,
  p_discovered_at date default null
)
returns public.patient_safety_event
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_event public.patient_safety_event;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode editá-lo'
      using errcode = 'HC044';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para o evento' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set title = p_title, description_md = p_description_md,
      suspected_harm_level = coalesce(p_suspected_harm_level, 'unknown'),
      event_type_id = p_event_type_id, location = p_location, discovered_at = p_discovered_at,
      updated_at = now()
  where id = p_event_id
  returning * into v_event;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_event;
end;
$$;

revoke all on function public.update_event(uuid, text, text, text, uuid, text, date) from public, anon;
grant execute on function public.update_event(uuid, text, text, text, uuid, text, date) to authenticated, service_role;

-- ===========================================================================
-- set_event_patient(event, fields…) — the ISOLATED PHI write (audited)
-- ===========================================================================
-- Insert-or-update the 0..1 satellite. The mutation-audit trigger (below) logs
-- event_patient.updated + the actor ONLY — NO identifier in metadata.
create function public.set_event_patient(
  p_event_id uuid,
  p_name text default null,
  p_mrn text default null,
  p_date_of_birth date default null,
  p_age_years integer default null,
  p_sex text default 'unknown',
  p_encounter_ref text default null,
  p_unit text default null,
  p_attending text default null
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode registrar dados do paciente'
      using errcode = 'HC044';
  end if;
  if p_sex is not null and p_sex not in ('female', 'male', 'other', 'unknown') then
    raise exception 'sexo inválido' using errcode = 'check_violation';
  end if;

  insert into public.event_patient (
    event_id, name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, attending
  ) values (
    p_event_id, p_name, p_mrn, p_date_of_birth, p_age_years, coalesce(p_sex, 'unknown'),
    p_encounter_ref, p_unit, p_attending
  )
  on conflict (event_id) do update
  set name = excluded.name, mrn = excluded.mrn, date_of_birth = excluded.date_of_birth,
      age_years = excluded.age_years, sex = excluded.sex,
      encounter_ref = excluded.encounter_ref, unit = excluded.unit,
      attending = excluded.attending, updated_at = now();
end;
$$;

revoke all on function public.set_event_patient(uuid, text, text, date, integer, text, text, text, text) from public, anon;
grant execute on function public.set_event_patient(uuid, text, text, date, integer, text, text, text, text) to authenticated, service_role;

-- ===========================================================================
-- cancel_event(event) — -> cancelled (terminal)
-- ===========================================================================
create function public.cancel_event(p_event_id uuid)
returns public.patient_safety_event
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_event public.patient_safety_event;
  v_status text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode cancelá-lo'
      using errcode = 'HC044';
  end if;

  select status into v_status from public.patient_safety_event where id = p_event_id;
  if v_status in ('closed', 'cancelled') then
    raise exception 'este evento já está em um estado final' using errcode = 'HC043';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set status = 'cancelled', closed_by = auth.uid(), closed_at = now(), updated_at = now()
  where id = p_event_id
  returning * into v_event;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_event;
end;
$$;

revoke all on function public.cancel_event(uuid) from public, anon;
grant execute on function public.cancel_event(uuid) to authenticated, service_role;

-- ===========================================================================
-- pqs_inbox(filters) — the PHI-FREE NSP triage queue (DEFINER, is_pqs_member-gated)
-- ===========================================================================
-- Returns GOVERNANCE METADATA ONLY — NO patient identifiers (minimum-necessary,
-- Rule 12). A non-PQS caller gets zero rows (the gate returns early). Newest-first.
create function public.pqs_inbox(
  p_status text default null,
  p_suspected_harm_level text default null,
  p_reporting_commission_id uuid default null
)
returns table (
  id uuid,
  code text,
  title text,
  status text,
  suspected_harm_level text,
  reporting_commission_id uuid,
  reporting_commission_name text,
  current_owner_kind text,
  current_owner_commission_id uuid,
  case_id uuid,
  case_number integer,
  reported_at timestamptz,
  acknowledged_at timestamptz
)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select
    e.id, e.code, e.title, e.status, e.suspected_harm_level,
    e.reporting_commission_id, rc.name,
    e.current_owner_kind, e.current_owner_commission_id,
    e.case_id, c.case_number,
    e.reported_at, e.acknowledged_at
  from public.patient_safety_event e
  join public.commissions rc on rc.id = e.reporting_commission_id
  left join public.cases c on c.id = e.case_id
  where app.is_pqs_member(auth.uid())
    and (p_status is null or e.status = p_status)
    and (p_suspected_harm_level is null or e.suspected_harm_level = p_suspected_harm_level)
    and (p_reporting_commission_id is null or e.reporting_commission_id = p_reporting_commission_id)
  order by e.reported_at desc;
$$;

revoke all on function public.pqs_inbox(text, text, uuid) from public, anon;
grant execute on function public.pqs_inbox(text, text, uuid) to authenticated, service_role;

-- ===========================================================================
-- Mutation-audit triggers (Rule 11) — PHI-FREE allow-lists
-- ===========================================================================
-- AFTER INSERT/UPDATE on patient_safety_event: report on a PHI-FREE allow-list
-- [status, suspected_harm_level, current_owner_kind, current_owner_commission_id] —
-- NEVER description_md / title / location (free text / clinical). Verbs:
-- safety_event.reported (INSERT) / .acknowledged / .cancelled / .status_changed.
create function app.trg_audit_safety_event()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['status', 'suspected_harm_level',
                                  'current_owner_kind', 'current_owner_commission_id'];
  v_action text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('safety_event.reported', 'safety_event', new.id,
      new.reporting_commission_id,
      'Evento de segurança ' || new.code || ' notificado ao NSP',
      app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  end if;

  -- UPDATE: only emit on a status flip (the meaningful lifecycle event).
  if new.status is distinct from old.status then
    if new.status = 'acknowledged' then
      v_action := 'safety_event.acknowledged';
      v_summary := 'Evento ' || new.code || ' reconhecido pelo NSP';
    elsif new.status = 'cancelled' then
      v_action := 'safety_event.cancelled';
      v_summary := 'Evento ' || new.code || ' cancelado';
    else
      v_action := 'safety_event.status_changed';
      v_summary := 'Evento ' || new.code || ': ' || old.status || ' → ' || new.status;
    end if;
    perform app.audit_write(v_action, 'safety_event', new.id, new.reporting_commission_id,
      v_summary, app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

create trigger audit_safety_event_trg
  after insert or update on public.patient_safety_event
  for each row execute function app.trg_audit_safety_event();

-- AFTER INSERT/UPDATE on event_custody: allow-list [owner_kind, owner_commission_id,
-- held_until]. INSERT = the hand-off (a new interval opens); the close UPDATE is part
-- of the same transfer, so we log the INSERT only (one transfer -> one row). The
-- event chain (reporting commission) carries it.
create function app.trg_audit_event_custody()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['owner_kind', 'owner_commission_id', 'held_until'];
  v_comm uuid;
begin
  if tg_op = 'INSERT' then
    v_comm := app.commission_of_event(new.event_id);
    perform app.audit_write('event_custody.transferred', 'event_custody', new.id, v_comm,
      'Custódia do evento atribuída a ' ||
        case new.owner_kind when 'pqs' then 'NSP' else 'comissão' end,
      app.audit_diff(null, to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

create trigger audit_event_custody_trg
  after insert on public.event_custody
  for each row execute function app.trg_audit_event_custody();

-- AFTER INSERT/UPDATE on event_patient: log event_patient.updated + the ACTOR ONLY,
-- with EMPTY metadata — NO identifier ever enters the audit log (Rule 11/12). We do
-- NOT call app.audit_diff over the identifier columns (that would copy PHI).
create function app.trg_audit_event_patient()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_comm uuid;
begin
  v_comm := app.commission_of_event(new.event_id);
  perform app.audit_write('event_patient.updated', 'event_patient', new.event_id, v_comm,
    'Dados do paciente do evento atualizados', '{}'::jsonb);
  return null;
end;
$$;

create trigger audit_event_patient_trg
  after insert or update on public.event_patient
  for each row execute function app.trg_audit_event_patient();

-- The patient_safety flag flip ON ships as a separate one-line migration
-- (…121003_enable_patient_safety.sql), mirroring the meetings/interviews/cases
-- enable migrations — kept out of this RPC migration so the flip is a clean,
-- reviewable one-liner.
