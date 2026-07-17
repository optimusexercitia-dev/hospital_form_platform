-- ============================================================================
-- ADR 0078 Gate 2 · Stage C · C2 — meeting_agenda_items content, tiered.
-- Plan lines 354–364, keystone 14 + a NEW title/respondent keystone. Depends on
-- C1 (shares the projection pattern) and C3 (can_reach_meeting).
--
-- THE TIERS (plan:354-364), applied ONLY when the agenda item is case-linked
-- (via meeting_cases.agenda_item_id); a non-case-linked item stays member-wide:
--   • title            — the PROCESS NUMBER. Propriety tier: NOT is_case_respondent.
--     ⭐ A4·1 said "title = process number, member-wide ALWAYS"; A7/O6 OVERRULE it —
--     the respondent must not read his own process number off the pauta. No prior
--     keystone caught this (K10 tests the recused, not the respondent) → new one.
--   • discussion_notes — deliberation. Substance tier: read_case_deliberation.
--   • resolution       — deliberation. Substance tier: read_case_deliberation.
--
-- Conjunct B alone does NOT close this (A3), and C2 alone would be a no-op past
-- the FOR ALL write side door — closed by C8 (already landed).
--
-- MECHANISM (lead Q1 ruling): DEFINER projection RPC + base-column REVOKE.
-- LOCAL ONLY. Catalog-verified.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Hide the three content columns from direct PostgREST reads.
-- ----------------------------------------------------------------------------
revoke select on public.meeting_agenda_items from authenticated;
grant select (id, meeting_id, position, description, created_by, created_at, updated_at)
  on public.meeting_agenda_items to authenticated;

-- ----------------------------------------------------------------------------
-- 2. The tier masker. Resolves the item's linked case(s) via
--    meeting_cases.agenda_item_id; a non-linked item is member-wide.
-- ----------------------------------------------------------------------------
create or replace function app._project_meeting_agenda_item(
  r public.meeting_agenda_items, p_uid uuid)
returns public.meeting_agenda_items
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cases uuid[];
begin
  select array_agg(mc.case_id) into v_cases
  from public.meeting_cases mc where mc.agenda_item_id = r.id;

  if v_cases is null then
    return r;  -- not case-linked → member-wide, no masking
  end if;

  -- title (process number): propriety tier — hidden from a respondent of ANY
  -- linked case (he must not read his own process number).
  if exists (select 1 from unnest(v_cases) c where app.is_case_respondent(c, p_uid)) then
    r.title := null;
  end if;

  -- discussion_notes / resolution: substance tier — visible only with
  -- read_case_deliberation on EVERY linked case.
  if exists (
    select 1 from unnest(v_cases) c
    where not app.has_case_capability(c, p_uid, 'read_case_deliberation')
  ) then
    r.discussion_notes := null;
    r.resolution := null;
  end if;

  return r;
end;
$$;

revoke all on function app._project_meeting_agenda_item(public.meeting_agenda_items, uuid) from public;

-- ----------------------------------------------------------------------------
-- 3. The agenda door: the meeting's agenda items, content masked per tier.
--    Row skeleton is member-wide once the caller reaches the meeting.
-- ----------------------------------------------------------------------------
create or replace function public.get_meeting_agenda_items(p_meeting_id uuid)
returns setof public.meeting_agenda_items
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_comm uuid := app.commission_of_meeting(p_meeting_id);
begin
  if not (app.can_reach_meeting(p_meeting_id, v_uid) or app.is_commission_admin_of(v_comm)) then
    return;
  end if;

  -- Rule 11: the meeting-view surface already emits 'meeting.viewed' (app layer);
  -- this projection is read within it, so no duplicate log here.

  return query
    select (app._project_meeting_agenda_item(ai, v_uid)).*
    from public.meeting_agenda_items ai
    where ai.meeting_id = p_meeting_id
    order by ai.position;
end;
$$;

revoke all on function public.get_meeting_agenda_items(uuid) from public;
grant execute on function public.get_meeting_agenda_items(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. REVOKE consequence: the two agenda write RPCs are INVOKER and did
--    `returning * into v_result` on meeting_agenda_items — fails 42501 after the
--    column REVOKE. Re-emitted VERBATIM from live pg_get_functiondef with the
--    ONLY change `returning id` / `returns uuid` (their sole consumers in
--    src/lib/meetings/actions.ts read only `.id` / ignore the payload).
--    Authorization unchanged (assert_meeting_staff_admin, still INVOKER).
--    DROP first: CREATE OR REPLACE cannot change a function's return type (42P13).
-- ----------------------------------------------------------------------------
drop function if exists public.create_meeting_agenda_item(uuid, text, text, text, text);
create or replace function public.create_meeting_agenda_item(
  p_meeting_id uuid, p_title text, p_description text default null::text,
  p_discussion_notes text default null::text, p_resolution text default null::text)
returns uuid
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_position integer;
  v_id uuid;
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
  returning id into v_id;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_id;
end;
$function$;

drop function if exists public.update_meeting_agenda_item(uuid, text, text, text, text);
create or replace function public.update_meeting_agenda_item(
  p_agenda_item_id uuid, p_title text, p_description text default null::text,
  p_discussion_notes text default null::text, p_resolution text default null::text)
returns uuid
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_meeting_id uuid;
  v_id uuid;
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
  where id = p_agenda_item_id returning id into v_id;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_id;
end;
$function$;
