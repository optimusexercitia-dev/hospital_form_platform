-- Meeting actual-occurrence time (`held_at` / `held_end`) — ADR 0062.
--
-- Adds a dedicated, nullable actual-occurrence window to `public.meetings`,
-- distinct from the SCHEDULE (`scheduled_start`/`scheduled_end`, the plan, never
-- overwritten) and from `concluded_at` ("ata sent to signature"). Captured at the
-- `→ realizada` transition (`mark_meeting_held` / `conclude_meeting`) and
-- correctable AFTERWARD while `status = 'realizada'` (product decision: NOT while
-- `em_assinatura` — a concluded meeting is frozen; reopen first).
--
-- Errcodes (next free after HC080; HC055/HC056 in the ADR handoff were already
-- taken by narrative-state / phi-disposed):
--   HC081 — held_end < held_at
--   HC082 — held_at in the future
--   HC083 — set_meeting_held_window on a non-`realizada` meeting
--   HC084 — held_end present while held_at is null (an end with no start)
--
-- Forward-only; the baseline (20260620000000) is NOT edited in place.

-- =========================================================================
-- B1 — Columns (nullable; no default; no backfill).
-- =========================================================================
alter table public.meetings
  add column held_at timestamptz,
  add column held_end timestamptz;

comment on column public.meetings.held_at is
  'ADR 0062: when the meeting ACTUALLY started (occurrence, not the schedule). '
  'Null = not recorded (never backfilled from scheduled_start). Plain timestamp, not PHI.';
comment on column public.meetings.held_end is
  'ADR 0062: when the meeting actually ended (optional real-duration end). '
  'Null = not recorded. Plain timestamp, not PHI.';

-- =========================================================================
-- B2/B3 — Widen the two transition RPCs to capture the occurrence window.
--
-- DROP-then-recreate (approved): adding defaulted params via CREATE OR REPLACE
-- would leave the old 1-arg overload in place and make PostgREST resolution
-- ambiguous. Dropping the old signature first and recreating at the widened
-- signature keeps a single function; the frontend's current 1-arg call still
-- resolves because both new params default to null.
-- =========================================================================

drop function if exists public.mark_meeting_held(uuid);

create function public.mark_meeting_held(
  p_meeting_id uuid,
  p_held_at timestamptz default null,
  p_held_end timestamptz default null
) returns public.meetings
    language plpgsql
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status <> 'agendada' then
    raise exception 'apenas reuniões agendadas podem ser marcadas como realizadas'
      using errcode = 'HC033';
  end if;

  -- Occurrence-window validation (ADR 0062). Null held_at is allowed
  -- (allow-null, fill-later).
  if p_held_end is not null and p_held_at is null then
    raise exception 'informe o início da realização antes do término da reunião'
      using errcode = 'HC084';
  end if;
  if p_held_end is not null and p_held_at is not null and p_held_end < p_held_at then
    raise exception 'o horário de término não pode ser anterior ao horário de início da reunião'
      using errcode = 'HC081';
  end if;
  if p_held_at is not null and p_held_at > now() then
    raise exception 'a data e hora de realização não podem estar no futuro'
      using errcode = 'HC082';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set status = 'realizada', held_at = p_held_at, held_end = p_held_end, updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

alter function public.mark_meeting_held(uuid, timestamptz, timestamptz) owner to postgres;
revoke all on function public.mark_meeting_held(uuid, timestamptz, timestamptz) from public;
grant all on function public.mark_meeting_held(uuid, timestamptz, timestamptz) to authenticated;
grant all on function public.mark_meeting_held(uuid, timestamptz, timestamptz) to service_role;


drop function if exists public.conclude_meeting(uuid);

create function public.conclude_meeting(
  p_meeting_id uuid,
  p_held_at timestamptz default null,
  p_held_end timestamptz default null
) returns public.meetings
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
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
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
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

  -- Occurrence-window validation (ADR 0062). Null held_at is allowed.
  if p_held_end is not null and p_held_at is null then
    raise exception 'informe o início da realização antes do término da reunião'
      using errcode = 'HC084';
  end if;
  if p_held_end is not null and p_held_at is not null and p_held_end < p_held_at then
    raise exception 'o horário de término não pode ser anterior ao horário de início da reunião'
      using errcode = 'HC081';
  end if;
  if p_held_at is not null and p_held_at > now() then
    raise exception 'a data e hora de realização não podem estar no futuro'
      using errcode = 'HC082';
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
  -- first (under the flag) so both legal transitions are honoured. The occurrence
  -- window is stamped on this step so the `→ realizada` transition records it.
  if v_status = 'agendada' then
    update public.meetings
    set status = 'realizada', held_at = p_held_at, held_end = p_held_end, updated_at = now()
    where id = p_meeting_id;
  else
    -- Already realizada: still capture/overwrite the occurrence window from the
    -- conclude dialog. (A no-status-change UPDATE under the flag; the audit
    -- trigger's held-changed branch fires if the values differ.)
    update public.meetings
    set held_at = p_held_at, held_end = p_held_end, updated_at = now()
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

alter function public.conclude_meeting(uuid, timestamptz, timestamptz) owner to postgres;
revoke all on function public.conclude_meeting(uuid, timestamptz, timestamptz) from public;
grant all on function public.conclude_meeting(uuid, timestamptz, timestamptz) to authenticated;
grant all on function public.conclude_meeting(uuid, timestamptz, timestamptz) to service_role;

-- =========================================================================
-- B4 — Dedicated edit RPC: correct the occurrence window AFTER the transition.
--
-- Product decision (overrides the handoff): allowed ONLY while
-- `status = 'realizada'`. A concluded meeting (`em_assinatura`+) is frozen; the
-- coordinator must `reopen_meeting` (→ realizada) first. Writes ONLY held_*
-- (never the schedule). staff_admin-gated; sets the in_meeting_rpc flag so the
-- guard permits the (no-status-change) edit uniformly.
-- =========================================================================
create function public.set_meeting_held_window(
  p_meeting_id uuid,
  p_held_at timestamptz,
  p_held_end timestamptz default null
) returns public.meetings
    language plpgsql
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status <> 'realizada' then
    raise exception 'a data de realização só pode ser alterada enquanto a reunião está no estado "realizada"; reabra a reunião para editá-la'
      using errcode = 'HC083';
  end if;

  if p_held_end is not null and p_held_at is null then
    raise exception 'informe o início da realização antes do término da reunião'
      using errcode = 'HC084';
  end if;
  if p_held_end is not null and p_held_at is not null and p_held_end < p_held_at then
    raise exception 'o horário de término não pode ser anterior ao horário de início da reunião'
      using errcode = 'HC081';
  end if;
  if p_held_at is not null and p_held_at > now() then
    raise exception 'a data e hora de realização não podem estar no futuro'
      using errcode = 'HC082';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set held_at = p_held_at, held_end = p_held_end, updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

alter function public.set_meeting_held_window(uuid, timestamptz, timestamptz) owner to postgres;
revoke all on function public.set_meeting_held_window(uuid, timestamptz, timestamptz) from public;
grant all on function public.set_meeting_held_window(uuid, timestamptz, timestamptz) to authenticated;
grant all on function public.set_meeting_held_window(uuid, timestamptz, timestamptz) to service_role;

-- =========================================================================
-- B5 — Audit trigger: emit `meeting.held_changed` when held_at/held_end change.
--
-- NON-EXCLUSIVE branches (approved): setting OR changing held_* emits
-- `meeting.held_changed`, so it must fire at the transition too (null → chosen).
-- A transition that also sets held emits BOTH a status_changed and a held_changed
-- row — intended (ADR 0062 decision 5). The `is distinct from` guards prevent
-- spurious rows.
-- =========================================================================
create or replace function app.trg_audit_meetings() returns trigger
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('meeting.created', 'meeting', new.id, new.commission_id,
      'Reunião criada nº ' || new.meeting_number,
      app.audit_diff(null, to_jsonb(new), array['status']));
    return null;
  end if;

  -- Independent branches (not elsif): a single UPDATE may change both status and
  -- the occurrence window and must audit both.
  if new.status is distinct from old.status then
    perform app.audit_write('meeting.status_changed', 'meeting', new.id, new.commission_id,
      'Status da reunião nº ' || new.meeting_number || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['status']));
  end if;

  if new.held_at is distinct from old.held_at or new.held_end is distinct from old.held_end then
    perform app.audit_write('meeting.held_changed', 'meeting', new.id, new.commission_id,
      'Data de realização da reunião nº ' || new.meeting_number || ': '
        || coalesce(old.held_at::text, '—') || ' → ' || coalesce(new.held_at::text, '—'),
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['held_at', 'held_end']));
  end if;

  return null;
end;
$$;

alter function app.trg_audit_meetings() owner to postgres;
