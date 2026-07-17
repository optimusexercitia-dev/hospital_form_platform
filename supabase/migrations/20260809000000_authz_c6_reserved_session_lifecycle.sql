-- ============================================================================
-- ADR 0078 Gate 2 · Stage C · C6 — reserved-session lifecycle. Plan lines 417–420,
-- O7/O8. Depends on C4/C5.
--
-- Opening a reserved session is COORDINATOR-ONLY — it is an access-granting act
-- (the opener picks the reader list for case-less subjects), so NOT an
-- administrativo capability (contrast schedule_meetings; ADR 0061) and NOT
-- Organization-User administration. Gate: app.is_staff_admin_of(commission) ONLY
-- (no member_can arm, no is_commission_admin_of arm). No separate reserved-session
-- signatures pre-pilot — the meeting-level signature covers annexes.
--
-- DEFINER, audited, REVOKE ALL FROM PUBLIC before GRANT. Case-linked items carry
-- the exclusion guard (a recused coordinator cannot author reserved content on her
-- own case — mirrors the exclusion-perimeter U2 content-write DEFINER pattern).
-- LOCAL ONLY.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- open_reserved_session — coordinator opens a time block on a meeting.
-- ----------------------------------------------------------------------------
create or replace function public.open_reserved_session(p_meeting_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_comm uuid := app.commission_of_meeting(p_meeting_id);
  v_id   uuid;
begin
  perform app.assert_meetings_enabled();
  if v_comm is null then
    raise exception 'reunião não encontrada' using errcode = 'P0002';
  end if;
  -- coordinator-only: NOT administrativo, NOT Organization User.
  if not app.is_staff_admin_of(v_comm) then
    raise exception 'apenas a coordenação pode abrir uma sessão reservada'
      using errcode = '42501';
  end if;

  insert into public.meeting_closed_sessions (meeting_id, opened_by)
  values (p_meeting_id, v_uid)
  returning id into v_id;

  perform app.audit_write('reserved_session.opened', 'meeting', p_meeting_id, v_comm,
    'Sessão reservada aberta', '{}'::jsonb);
  return v_id;
end;
$$;

revoke all on function public.open_reserved_session(uuid) from public;
grant execute on function public.open_reserved_session(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- add_reserved_item — coordinator adds a reserved item; picks the reader list for
-- case-less subjects (readers must be commission members).
-- ----------------------------------------------------------------------------
create or replace function public.add_reserved_item(
  p_session_id  uuid,
  p_case_id     uuid    default null,
  p_substance   text    default null,
  p_decision    text    default null,
  p_withdrawals text    default null,
  p_quorum_met  boolean default true,
  p_reader_uids uuid[]  default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_meeting uuid;
  v_comm    uuid;
  v_id      uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting from public.meeting_closed_sessions where id = p_session_id;
  if v_meeting is null then
    raise exception 'sessão reservada não encontrada' using errcode = 'P0002';
  end if;
  v_comm := app.commission_of_meeting(v_meeting);
  if not app.is_staff_admin_of(v_comm) then
    raise exception 'apenas a coordenação pode editar uma sessão reservada'
      using errcode = '42501';
  end if;

  if p_case_id is not null then
    if app.commission_of_case(p_case_id) <> v_comm then
      raise exception 'o caso pertence a outra comissão' using errcode = 'HC032';
    end if;
    -- a recused coordinator cannot author reserved content on her own case.
    perform app.assert_not_case_excluded(p_case_id);
  end if;

  insert into public.meeting_closed_session_items
    (closed_session_id, case_id, substance, decision, withdrawals, quorum_met, position)
  values
    (p_session_id, p_case_id,
     nullif(btrim(p_substance), ''), nullif(btrim(p_decision), ''), nullif(btrim(p_withdrawals), ''),
     coalesce(p_quorum_met, true),
     coalesce((select max(position) + 1 from public.meeting_closed_session_items
               where closed_session_id = p_session_id), 1))
  returning id into v_id;

  -- case-less subjects: the opener picks the reader list (members only).
  if p_case_id is null and p_reader_uids is not null then
    insert into public.meeting_closed_session_item_readers (item_id, user_id)
    select v_id, u
    from unnest(p_reader_uids) u
    where app.is_member_of_for(v_comm, u)
    on conflict (item_id, user_id) do nothing;
  end if;

  perform app.audit_write('reserved_item.added', 'meeting', v_meeting, v_comm,
    'Item de sessão reservada adicionado', '{}'::jsonb);
  return v_id;
end;
$$;

revoke all on function public.add_reserved_item(uuid, uuid, text, text, text, boolean, uuid[]) from public;
grant execute on function public.add_reserved_item(uuid, uuid, text, text, text, boolean, uuid[]) to authenticated;
