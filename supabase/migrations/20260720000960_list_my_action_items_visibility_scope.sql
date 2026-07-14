-- Migration: list_my_action_items — project visibility_scope (AI·ui §4.3)
-- ---------------------------------------------------------------------------
-- The hub's per-row `visibility_scope` (ADR 0050) has shipped end-to-end in the
-- DB since 20260707000000, but `list_my_action_items` never projected it into its
-- jsonb rows, so "Meus itens de ação" cannot render a visibility badge (plan §4.6).
--
-- This is a purely ADDITIVE `create or replace` of the RPC: it adds ONE key
-- (`visibility_scope`) to BOTH UNION arms' jsonb_build_object, and is otherwise
-- byte-identical to the 20260707000000 §7 body (same self-scoping, same flags,
-- same ordering, same existing keys/order — callers that ignore the new key are
-- unaffected). Forward-only; does NOT touch the 20260706/20260707 migration files.
--
-- No new RLS, no new parameter, no behaviour change beyond the extra field.
-- REVOKE/GRANT re-issued (t19 guard — belt-and-suspenders on a plain replace).
-- ---------------------------------------------------------------------------

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
    -- CASE-sourced hub items assigned to the caller (gated by `cases_extras`).
    select
      ai.due_date,
      ai.created_at,
      jsonb_build_object(
        'id', ai.id,
        'source', 'case',
        'title', ai.title,
        'description', ai.description,
        'status', st.key,
        'visibility_scope', ai.visibility_scope,
        'due_date', ai.due_date,
        'created_at', ai.created_at,
        'created_by_name', ab.full_name,
        'case_id', c.id,
        'case_number', c.case_number,
        'case_label', c.label,
        'meeting_id', null,
        'meeting_number', null,
        'meeting_scheduled_start', null
      ) as row_obj
    from public.action_items ai
    join public.action_item_statuses st on st.id = ai.status_id
    join public.cases c on c.id = ai.source_case_id
    left join public.profiles ab on ab.id = ai.created_by
    where app.feature_enabled('cases_extras')
      and ai.source_type = 'case'
      and ai.assigned_to = v_uid
      and ai.commission_id = p_commission

    union all

    -- MEETING/MANUAL hub items assigned to the caller (gated by `action_items`).
    -- Meeting-sourced rows emit source='meeting' (+ meeting labels); manual rows
    -- emit source='manual'. Status is the joined status KEY (client-compatible).
    select
      ai.due_date,
      ai.created_at,
      jsonb_build_object(
        'id', ai.id,
        'source', ai.source_type,
        'title', ai.title,
        'description', ai.description,
        'status', st.key,
        'visibility_scope', ai.visibility_scope,
        'due_date', ai.due_date,
        'created_at', ai.created_at,
        'created_by_name', ab.full_name,
        'case_id', null,
        'case_number', null,
        'case_label', null,
        'meeting_id', m.id,
        'meeting_number', m.meeting_number,
        'meeting_scheduled_start', m.scheduled_start
      ) as row_obj
    from public.action_items ai
    join public.action_item_statuses st on st.id = ai.status_id
    left join public.meetings m on m.id = ai.source_meeting_id
    left join public.profiles ab on ab.id = ai.created_by
    where app.feature_enabled('action_items')
      and ai.source_type in ('meeting', 'manual')
      and ai.assigned_to = v_uid
      and ai.commission_id = p_commission
  ) rows;

  return v_result;
end;
$$;

alter function public.list_my_action_items(uuid) owner to postgres;
revoke all on function public.list_my_action_items(uuid) from public;
grant execute on function public.list_my_action_items(uuid) to authenticated;
grant execute on function public.list_my_action_items(uuid) to service_role;
comment on function public.list_my_action_items(uuid) is
  'Self-scoped (assigned_to = auth.uid()) union of the caller''s action items for '
  'one commission, ALL statuses, on the shared action_items hub. The case-sourced '
  'arm (source_type=''case'') is gated by cases_extras and carries case labels; the '
  'meeting/manual arm is gated by action_items and carries meeting labels. Returns '
  'the status KEY and the per-row visibility_scope (ADR 0050). PHI-free; no audit row.';
