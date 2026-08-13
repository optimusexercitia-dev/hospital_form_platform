-- Migration: Member overview + unified "my action items"
-- ---------------------------------------------------------------------------
-- Two additive, self-scoped SECURITY DEFINER read RPCs backing the current
-- member's landing surface at `/o/[org]/c/[commission]/`:
--
--   * public.list_my_action_items(p_commission uuid) -> jsonb
--       The caller's action items (assigned_to = auth.uid()) unioned across
--       exactly TWO sources — case_action_items (gated by the `cases_extras`
--       flag) and meeting_action_items (gated by the `meetings` flag). A source
--       whose flag is OFF is simply OMITTED (never an error). CAPA action items
--       are intentionally NOT included. Returns ALL statuses (the client filters
--       active/done + source and sorts); the RPC ships a stable default order
--       (due_date asc nulls last, then created_at desc).
--
--   * public.get_member_overview(p_commission uuid) -> jsonb
--       Five self-scoped counts + two cheap secondary hints, in one round-trip.
--
-- Security posture (Architecture Rules 1, 9, 11):
--   * DEFINER, but every arm self-scopes with an explicit `= auth.uid()`
--     predicate on the source table, so each returns ONLY the caller's own rows.
--     The parent case/meeting is joined for PHI-FREE label columns only
--     (case number/label, meeting number/scheduled_start, creator display name)
--     about a case/meeting the caller is already the assignee of — no answers,
--     no *_md / free-text, no PHI.
--   * These are reads of the caller's OWN work / own aggregate counts
--     (self-scoped) — NOT reads of another member's data and no PHI table — so
--     no audit row is emitted (Rule 11).
--   * REVOKE ALL FROM PUBLIC before GRANT EXECUTE (dashboard t19 anon-exec
--     guard); search_path pinned; STABLE; owned by postgres.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- list_my_action_items
-- ===========================================================================
create or replace function public.list_my_action_items(p_commission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
           jsonb_agg(
             row_obj
             order by (due_date is null), due_date asc, created_at desc
           ),
           '[]'::jsonb
         )
    into v_result
  from (
    -- CASE action items assigned to the caller (gated by `cases_extras`).
    select
      cai.due_date,
      cai.created_at,
      jsonb_build_object(
        'id', cai.id,
        'source', 'case',
        'title', cai.title,
        'description', cai.description,
        'status', cai.status,
        'due_date', cai.due_date,
        'created_at', cai.created_at,
        'created_by_name', cb.full_name,
        'case_id', c.id,
        'case_number', c.case_number,
        'case_label', c.label,
        'meeting_id', null,
        'meeting_number', null,
        'meeting_scheduled_start', null
      ) as row_obj
    from public.case_action_items cai
    join public.cases c on c.id = cai.case_id
    left join public.profiles cb on cb.id = cai.created_by
    where app.feature_enabled('cases_extras')
      and cai.assigned_to = v_uid
      and c.commission_id = p_commission

    union all

    -- MEETING action items assigned to the caller (gated by `meetings`).
    -- commission_id is denormalized on the row, so the scope is a direct predicate.
    select
      mai.due_date,
      mai.created_at,
      jsonb_build_object(
        'id', mai.id,
        'source', 'meeting',
        'title', mai.title,
        'description', mai.description,
        'status', mai.status,
        'due_date', mai.due_date,
        'created_at', mai.created_at,
        'created_by_name', mb.full_name,
        'case_id', null,
        'case_number', null,
        'case_label', null,
        'meeting_id', m.id,
        'meeting_number', m.meeting_number,
        'meeting_scheduled_start', m.scheduled_start
      ) as row_obj
    from public.meeting_action_items mai
    join public.meetings m on m.id = mai.meeting_id
    left join public.profiles mb on mb.id = mai.created_by
    where app.feature_enabled('meetings')
      and mai.assigned_to = v_uid
      and mai.commission_id = p_commission
  ) rows;

  return v_result;
end;
$$;

alter function public.list_my_action_items(uuid) owner to postgres;
revoke all on function public.list_my_action_items(uuid) from public;
grant execute on function public.list_my_action_items(uuid) to authenticated;
grant execute on function public.list_my_action_items(uuid) to service_role;

comment on function public.list_my_action_items(uuid) is
  'Self-scoped (assigned_to = auth.uid()) union of the caller''s case + meeting '
  'action items for one commission, ALL statuses. Each source is gated by its '
  'feature flag (cases_extras / meetings) and OMITTED when off. PHI-free; no '
  'audit row (reads the caller''s own items).';

-- ===========================================================================
-- get_member_overview
-- ===========================================================================
create or replace function public.get_member_overview(p_commission uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_uid uuid := auth.uid();
  v_cases_flag boolean := app.feature_enabled('cases_extras');
  v_case_access_flag boolean := app.feature_enabled('case_access');
  v_meetings_flag boolean := app.feature_enabled('meetings');

  v_cases_not_concluded int := 0;
  v_pending_action_items int := 0;
  v_pending_overdue int := 0;
  v_meetings_not_concluded int := 0;
  v_next_meeting_start timestamptz := null;
  v_pending_signatures int := 0;
  v_in_progress_responses int := 0;
begin
  if v_uid is null then
    return jsonb_build_object(
      'cases_not_concluded', 0,
      'pending_action_items', 0,
      'pending_action_items_overdue', 0,
      'meetings_not_concluded', 0,
      'next_meeting_start', null,
      'pending_signatures', 0,
      'in_progress_responses', 0
    );
  end if;

  -- (1) Cases not concluded — PERSONAL interpretation (ADR: the human spec).
  -- Faithful to app.can_read_case's attribution logic:
  --   * phase/narrative attribution counts REGARDLESS of the `case_access` flag
  --     (the minhas-fases reality when the flag is off);
  --   * the explicit read/write grant leg counts ONLY when `case_access` is ON.
  -- Non-terminal = status not in (concluido, cancelado). Requires the cases
  -- feature (`cases_extras`) at all; else 0.
  if v_cases_flag then
    select count(*) into v_cases_not_concluded
    from public.cases c
    where c.commission_id = p_commission
      and c.status not in ('concluido', 'cancelado')
      and (
        exists (
          select 1 from public.case_phases cp
          where cp.case_id = c.id and cp.assigned_to = v_uid
        )
        or exists (
          select 1 from public.case_narratives cn
          where cn.case_id = c.id and cn.assigned_to = v_uid
        )
        or (
          v_case_access_flag
          and exists (
            select 1 from public.case_access ca
            where ca.case_id = c.id and ca.user_id = v_uid
          )
        )
      );
  end if;

  -- (2) Pending action items (open + in_progress) across the section-A union,
  -- plus how many are overdue (due_date < today). Each source flag-gated; a
  -- source that is off contributes nothing.
  select
    count(*),
    count(*) filter (where due_date is not null and due_date < current_date)
    into v_pending_action_items, v_pending_overdue
  from (
    select cai.due_date
    from public.case_action_items cai
    join public.cases c on c.id = cai.case_id
    where v_cases_flag
      and cai.assigned_to = v_uid
      and c.commission_id = p_commission
      and cai.status in ('open', 'in_progress')

    union all

    select mai.due_date
    from public.meeting_action_items mai
    where v_meetings_flag
      and mai.assigned_to = v_uid
      and mai.commission_id = p_commission
      and mai.status in ('open', 'in_progress')
  ) pend;

  -- (3) Meetings not concluded the caller ATTENDS, + the next upcoming start.
  -- "Not concluded" = status in (agendada, realizada, em_assinatura). Gated by
  -- `meetings`.
  if v_meetings_flag then
    select
      count(*),
      min(m.scheduled_start) filter (where m.scheduled_start >= now())
      into v_meetings_not_concluded, v_next_meeting_start
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.user_id = v_uid
      and m.commission_id = p_commission
      and m.status in ('agendada', 'realizada', 'em_assinatura');
  end if;

  -- (4) Pending meeting-minute signatures — mirrors
  -- public.my_pending_meeting_signatures (attendance = 'presente', meeting
  -- em_assinatura, no signed signature yet), scoped to this commission. Gated by
  -- `meetings`.
  if v_meetings_flag then
    select count(*) into v_pending_signatures
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.user_id = v_uid
      and m.commission_id = p_commission
      and a.attendance = 'presente'
      and m.status = 'em_assinatura'
      and not exists (
        select 1 from public.meeting_signatures s
        where s.attendee_id = a.id and s.status = 'signed'
      );
  end if;

  -- (5) The caller's own in_progress form responses (drafts) in this commission.
  select count(*) into v_in_progress_responses
  from public.responses r
  where r.created_by = v_uid
    and r.commission_id = p_commission
    and r.status = 'in_progress';

  return jsonb_build_object(
    'cases_not_concluded', v_cases_not_concluded,
    'pending_action_items', v_pending_action_items,
    'pending_action_items_overdue', v_pending_overdue,
    'meetings_not_concluded', v_meetings_not_concluded,
    'next_meeting_start', v_next_meeting_start,
    'pending_signatures', v_pending_signatures,
    'in_progress_responses', v_in_progress_responses
  );
end;
$$;

alter function public.get_member_overview(uuid) owner to postgres;
revoke all on function public.get_member_overview(uuid) from public;
grant execute on function public.get_member_overview(uuid) to authenticated;
grant execute on function public.get_member_overview(uuid) to service_role;

comment on function public.get_member_overview(uuid) is
  'Self-scoped per-member "Visão Geral" for one commission: 5 counts + 2 hints '
  'in one round-trip. Flag-dependent counts return 0/null when off (never raise). '
  'Count 1 (cases-not-concluded) uses the PERSONAL rule: phase/narrative '
  'attribution counts regardless of the case_access flag; the grant leg only '
  'when case_access is ON. No audit row (reads the caller''s own aggregates).';
