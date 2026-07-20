-- Committee Charters & Meeting Cadence (S4·CH, Phase 21) — RPCs (CH-BE-3).
-- The security core: the single write door + the two DEFINER reads. ADR 0080 D6/D7;
-- build plan docs/plans/charters-cadence.md §3/§4/§5. No PHI (Rule 12).
--
-- All three are public, SECURITY DEFINER, owner postgres, t19 (revoke all from public +
-- grant execute to authenticated, service_role), search_path pinned. Flag-gate FIRST
-- (charters OFF → HC000). SQLSTATE family HC0K· (ADR 0080 D10):
--   HC0K0 not staff_admin (upsert authority)   HC0K1 invalid regimento link
--   HC0K2 not a member (cadence / carry-forward entry check)
--
-- Catalog-verified names used (live catalog, not migration text — graphify exception):
--   • app.assert-flag idiom  = app.feature_enabled(text) + raise errcode 'HC000'
--       (mirrors app.assert_ethics_enabled — the newest flag-gate convention).
--   • authority (upsert)     = app.is_staff_admin_of(uuid)  [has_role('commission',
--       …,'staff_admin',…) — the STAFF-ADMIN-specific check, NOT the broader
--       is_commission_admin_of which also admits org/hospital admins].
--   • member (reads)         = app.is_member_of(uuid).
--   • confidentiality filter = app.can_read_action_item(p_action_item_id uuid, p_uid uuid).
--   • meetings.held_at / meetings.visibility_policy='commission_default';
--     meeting_agenda_items.resolution / .title / .description / .meeting_id;
--     action_items.source_type='meeting' / .source_meeting_id / .status_id →
--     action_item_statuses.is_terminal / .key.
--   • audit                  = app.audit_write(p_action,p_entity_type,p_entity_id,
--       p_commission,p_summary,p_metadata,…); verb 'charter.upserted', entity 'commission'.
--
-- Return shape: camelCase jsonb (the get_ethics_case_procedure precedent — the RPC emits
-- the domain shape verbatim so src/lib/queries/charters.ts casts, CH-BE-1 contract).

-- -----------------------------------------------------------------------------
-- 0 · flag-gate helper (HC000) — mirrors app.assert_ethics_enabled
-- -----------------------------------------------------------------------------
create or replace function app.assert_charters_enabled()
  returns void
  language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('charters') then
    raise exception 'recurso indisponível' using errcode = 'HC000';
  end if;
end;
$$;
alter function app.assert_charters_enabled() owner to postgres;

-- -----------------------------------------------------------------------------
-- 1 · upsert_commission_charter — the SOLE write door.
--     Order: flag-off HC000 → authority FIRST (HC0K0) → link validation (HC0K1) →
--     upsert → audit. Authority and link use DISTINCT SQLSTATEs, authority checked
--     first, so an HC0K0 deny keystone cannot be satisfied vacuously by the link
--     check (ADR 0078/0079 non-vacuity).
-- -----------------------------------------------------------------------------
create or replace function public.upsert_commission_charter(
  p_commission uuid,
  p_meeting_frequency text,
  p_controlled_document_id uuid default null
)
  returns jsonb
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.commission_charters;
begin
  perform app.assert_charters_enabled();

  -- Authority FIRST — staff_admin of THIS commission (not org/hospital admin).
  if not app.is_staff_admin_of(p_commission) then
    raise exception 'apenas a coordenação da comissão pode configurar o regimento e a cadência'
      using errcode = 'HC0K0';
  end if;

  -- Then the regimento link: a same-commission doc_type='regimento' controlled document.
  if p_controlled_document_id is not null then
    if not exists (
      select 1 from public.controlled_documents d
      where d.id = p_controlled_document_id
        and d.commission_id = p_commission
        and d.doc_type = 'regimento'
    ) then
      raise exception 'o documento selecionado não é um regimento válido desta comissão'
        using errcode = 'HC0K1';
    end if;
  end if;

  insert into public.commission_charters
    (commission_id, meeting_frequency, controlled_document_id, created_by)
  values
    (p_commission, p_meeting_frequency, p_controlled_document_id, v_uid)
  on conflict (commission_id) do update
    set meeting_frequency      = excluded.meeting_frequency,
        controlled_document_id = excluded.controlled_document_id
        -- created_by intentionally NOT updated (set on insert only)
  returning * into v_row;

  -- Audit (Rule 11) — config-level metadata only, PHI-free (Rule 12).
  perform app.audit_write(
    'charter.upserted', 'commission', p_commission, p_commission,
    'Regimento e cadência atualizados',
    jsonb_build_object(
      'meeting_frequency', v_row.meeting_frequency,
      'has_regimento', (v_row.controlled_document_id is not null)
    )
  );

  return jsonb_build_object(
    'commissionId',         v_row.commission_id,
    'meetingFrequency',     v_row.meeting_frequency,
    'controlledDocumentId', v_row.controlled_document_id,
    'createdBy',            v_row.created_by,
    'createdAt',            v_row.created_at,
    'updatedAt',            v_row.updated_at
  );
end;
$$;
alter function public.upsert_commission_charter(uuid, text, uuid) owner to postgres;
revoke all on function public.upsert_commission_charter(uuid, text, uuid) from public;
grant execute on function public.upsert_commission_charter(uuid, text, uuid)
  to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2 · meeting_cadence_status — cadence adherence (plan §4). DEFINER over base
--     tables (NOT RLS-filtered) so the indicator is consistent regardless of the
--     caller's meeting visibility; member-scoped entry (HC0K2). Boundary inclusive.
-- -----------------------------------------------------------------------------
create or replace function public.meeting_cadence_status(p_commission uuid)
  returns jsonb
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_freq text;
  v_window interval;
  v_last_held timestamptz;
  v_status text;
begin
  perform app.assert_charters_enabled();

  if not app.is_member_of(p_commission) then
    raise exception 'você não é membro desta comissão' using errcode = 'HC0K2';
  end if;

  select meeting_frequency into v_freq
  from public.commission_charters
  where commission_id = p_commission;

  -- last held qualifying (commission_default) meeting — over full data, not RLS-filtered.
  select max(held_at) into v_last_held
  from public.meetings
  where commission_id = p_commission
    and held_at is not null
    and visibility_policy = 'commission_default';

  v_window := case v_freq
    when 'semanal'    then interval '1 week'
    when 'quinzenal'  then interval '2 weeks'
    when 'mensal'     then interval '1 month'
    when 'bimestral'  then interval '2 months'
    when 'trimestral' then interval '3 months'
    else null
  end;

  if v_freq is null then
    v_status := 'sem_regimento';
  elsif v_last_held is null then
    v_status := 'sem_reunioes';
  elsif (now() - v_last_held) <= v_window then      -- boundary INCLUSIVE
    v_status := 'em_dia';
  else
    v_status := 'em_atraso';
  end if;

  return jsonb_build_object(
    'status',           v_status,
    'lastHeldAt',       v_last_held,
    'meetingFrequency', v_freq
  );
end;
$$;
alter function public.meeting_cadence_status(uuid) owner to postgres;
revoke all on function public.meeting_cadence_status(uuid) from public;
grant execute on function public.meeting_cadence_status(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · suggest_carry_forward — pure DEFINER read (plan §5). Unresolved agenda items
--     from the most-recent held commission_default meeting + open meeting-sourced
--     action items, each passed through app.can_read_action_item so case_restricted /
--     hearing items never leak. Member-scoped (HC0K2). No writes.
-- -----------------------------------------------------------------------------
create or replace function public.suggest_carry_forward(p_commission uuid)
  returns jsonb
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_last_meeting uuid;
  v_agenda jsonb;
  v_actions jsonb;
begin
  perform app.assert_charters_enabled();

  if not app.is_member_of(p_commission) then
    raise exception 'você não é membro desta comissão' using errcode = 'HC0K2';
  end if;

  -- Most-recent held commission_default meeting of the commission.
  select id into v_last_meeting
  from public.meetings
  where commission_id = p_commission
    and held_at is not null
    and visibility_policy = 'commission_default'
  order by held_at desc
  limit 1;

  -- Agenda: unresolved items (resolution IS NULL) from that meeting.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'title',          a.title,
        'description',    a.description,
        'sourceMeetingId', a.meeting_id
      ) order by a.position
    ) filter (where a.id is not null),
    '[]'::jsonb
  ) into v_agenda
  from public.meeting_agenda_items a
  where v_last_meeting is not null
    and a.meeting_id = v_last_meeting
    and a.resolution is null;

  -- Actions: open (non-terminal) meeting-sourced items across the commission's
  -- commission_default meetings, confidentiality-filtered per item.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',      ai.id,
        'title',   ai.title,
        'status',  s.key,
        'dueDate', ai.due_date
      ) order by ai.created_at
    ) filter (where ai.id is not null),
    '[]'::jsonb
  ) into v_actions
  from public.action_items ai
  join public.action_item_statuses s on s.id = ai.status_id
  join public.meetings m on m.id = ai.source_meeting_id
  where ai.commission_id = p_commission
    and ai.source_type = 'meeting'
    and m.commission_id = p_commission
    and m.visibility_policy = 'commission_default'
    and s.is_terminal = false
    and app.can_read_action_item(ai.id, v_uid);

  return jsonb_build_object(
    'agendaItems', v_agenda,
    'actionItems', v_actions
  );
end;
$$;
alter function public.suggest_carry_forward(uuid) owner to postgres;
revoke all on function public.suggest_carry_forward(uuid) from public;
grant execute on function public.suggest_carry_forward(uuid) to authenticated, service_role;
