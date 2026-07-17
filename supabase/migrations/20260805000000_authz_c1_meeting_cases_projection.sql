-- ============================================================================
-- ADR 0078 Gate 2 · Stage C · C1 — meeting_cases content, tiered projection.
-- Plan lines 341–351, keystones 5 and 16. Depends on C3's app.can_reach_meeting.
--
-- THE TWO-GATE SPLIT (plan:346-351):
--   • summary  — substance. Visible only with read_case_deliberation (A15 — NOT
--     read_case_content; that was the widening).
--   • decision — the ratified outcome ("Processo 052 — arquivado"). BROADER:
--     visible to any reacher of the meeting who is NOT excluded, uniform across
--     visibility_policy (keystone 16, A5/A7). A member with no substance reach on
--     a sub-group case still reads the decision; a recused member reads neither.
--
-- ⭐ THE MEETING SURFACE IS MEMBER-WIDE (A6, keystone-4 scope note ADR:672-674).
-- The pauta/ata names the process number and the decision tier member-wide,
-- DELIBERATELY — the case BOARD hides sub-group cases, the meeting surface does
-- not. So this migration DROPS the `can_reach_case_on_member_surface` conjunct
-- from meeting_cases_select: the row SKELETON (id, meeting_id, case_id,
-- agenda_item_id, times) is visible to any meeting-reacher, and case authority
-- masks the two CONTENT columns instead of hiding the whole row. Without this,
-- keystone 16 ("member reads the decision on a sub-group case") is unreachable —
-- the old row gate hid the row entirely. This widening is SAFE only because the
-- content columns are REVOKE'd below and served masked through the RPC.
--
-- MECHANISM (lead Q1 ruling): RLS is whole-row, so column masking goes through a
-- DEFINER projection RPC + a base-column REVOKE (not a masking view). The two
-- readers — the meeting detail view and the case timeline — each get a door.
-- LOCAL ONLY. Catalog-verified.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kill the direct PostgREST read of the two content columns. authenticated
--    holds TABLE-level SELECT, so revoke it and re-grant only the skeleton
--    columns; summary/decision are then reachable ONLY through the RPCs below.
--    INSERT/UPDATE grants are untouched, so the INVOKER write RPCs still work.
-- ----------------------------------------------------------------------------
revoke select on public.meeting_cases from authenticated;
grant select (id, meeting_id, case_id, agenda_item_id, created_at)
  on public.meeting_cases to authenticated;

-- ----------------------------------------------------------------------------
-- 2. The row skeleton becomes member-wide on the meeting surface (A6). Drop the
--    case-content conjunct; keep the meeting reach gate + the admin arm (C7).
-- ----------------------------------------------------------------------------
drop policy if exists meeting_cases_select on public.meeting_cases;
create policy meeting_cases_select on public.meeting_cases
  for select to authenticated
  using (
    app.can_reach_meeting(meeting_id, (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

-- ----------------------------------------------------------------------------
-- 3. The tier masker (one source for the split; both RPCs call it).
--    Operates on an already-read row; the DEFINER predicates resolve authority.
-- ----------------------------------------------------------------------------
create or replace function app._project_meeting_case(r public.meeting_cases, p_uid uuid)
returns public.meeting_cases
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- summary: substance tier — read_case_deliberation only.
  if not app.has_case_capability(r.case_id, p_uid, 'read_case_deliberation') then
    r.summary := null;
  end if;
  -- decision: outcome tier — any non-excluded reacher (already gated on reach by
  -- the caller). is_case_excluded hard-denies the respondent/recused.
  if app.is_case_excluded(r.case_id, p_uid) then
    r.decision := null;
  end if;
  return r;
end;
$$;

revoke all on function app._project_meeting_case(public.meeting_cases, uuid) from public;

-- ----------------------------------------------------------------------------
-- 4. Meeting detail door: all case links of a meeting, content masked per tier.
--    Row skeleton is member-wide (A6) — no per-row case gate, matching the
--    re-cut meeting_cases_select.
-- ----------------------------------------------------------------------------
create or replace function public.get_meeting_cases(p_meeting_id uuid)
returns setof public.meeting_cases
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
    return;  -- no reach → empty
  end if;

  -- Rule 11: the meeting-view surface already emits 'meeting.viewed' (app layer,
  -- src/lib/queries/meetings.ts) and the case surface emits 'case.opened'; this
  -- projection is read within those audited surfaces, so no duplicate log here.

  return query
    select (app._project_meeting_case(mc, v_uid)).*
    from public.meeting_cases mc
    where mc.meeting_id = p_meeting_id
    order by mc.created_at;
end;
$$;

revoke all on function public.get_meeting_cases(uuid) from public;
grant execute on function public.get_meeting_cases(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Case-timeline door: the meeting links of a case, content masked per tier.
--    Guard on can_read_case (the case-detail surface the timeline renders on).
-- ----------------------------------------------------------------------------
create or replace function public.get_case_meeting_links(p_case_id uuid)
returns setof public.meeting_cases
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not app.can_read_case(p_case_id, v_uid) then
    return;  -- cannot read the case → no timeline meeting content
  end if;

  -- Rule 11: gated by can_read_case; the case-detail surface already audits the
  -- case read ('case.opened'). No duplicate log for this projection.

  return query
    select (app._project_meeting_case(mc, v_uid)).*
    from public.meeting_cases mc
    where mc.case_id = p_case_id
      and (app.can_reach_meeting(mc.meeting_id, v_uid)
           or app.is_commission_admin_of(app.commission_of_meeting(mc.meeting_id)))
    order by mc.created_at;
end;
$$;

revoke all on function public.get_case_meeting_links(uuid) from public;
grant execute on function public.get_case_meeting_links(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 6. REVOKE consequence: link_meeting_case is INVOKER and did `returning * into
--    v_result` on meeting_cases — after the column REVOKE that fails with 42501
--    (RETURNING requires SELECT on every returned column; verified empirically).
--    Re-emitted VERBATIM from live pg_get_functiondef with the ONLY change being
--    `returning id` / `returns uuid` — its sole consumer (linkMeetingCase in
--    src/lib/meetings/actions.ts) reads only `.id`. Authorization is unchanged
--    (assert_meeting_staff_admin, still INVOKER — no DEFINER conversion).
--    DROP first: CREATE OR REPLACE cannot change a function's return type (42P13).
-- ----------------------------------------------------------------------------
drop function if exists public.link_meeting_case(uuid, uuid, uuid, text, text);
create or replace function public.link_meeting_case(
  p_meeting_id uuid, p_case_id uuid, p_agenda_item_id uuid default null::uuid,
  p_summary text default null::text, p_decision text default null::text)
returns uuid
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_id uuid;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_cases (meeting_id, case_id, agenda_item_id, summary, decision)
  values (p_meeting_id, p_case_id, p_agenda_item_id,
          nullif(btrim(p_summary), ''), nullif(btrim(p_decision), ''))
  returning id into v_id;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_id;
end;
$function$;
