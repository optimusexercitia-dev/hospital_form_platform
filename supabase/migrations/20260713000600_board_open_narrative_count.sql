-- ============================================================================
-- Cases board: scalar open-narrative count per case (feeds the "Etapas
-- pendentes" KPI). Additive — re-creates list_cases_board(uuid, integer) with one
-- new scalar column `open_narrative_count` = count of that case's narratives with
-- status='aberta'. SCALAR count only (minimum-necessary): the board renders no
-- narrative rows, so no full narratives[] array is exposed. No new RLS.
--
-- Body is byte-identical to 20260711000900_perf_sweep_wave2.sql's version EXCEPT
-- the added RETURNS column + the scalar subquery. Gate + ordering + cap unchanged.
--
-- Adding a column to a RETURNS TABLE changes the function's return type, which
-- CREATE OR REPLACE forbids (42P13) — so DROP first, then recreate. No SQL-level
-- dependents (called only via PostgREST/RPC), so the drop is safe.
-- ============================================================================

drop function if exists public.list_cases_board(uuid, integer);

create or replace function public.list_cases_board(
  p_commission_id uuid,
  p_limit integer default 200
) returns table (
  case_id uuid, case_number integer, label text, status text,
  outcome_id uuid, outcome jsonb, created_at timestamptz, closed_at timestamptz,
  phases jsonb, open_narrative_count integer
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
begin
  if not app.is_staff_admin_of(p_commission_id) then
    return;
  end if;

  return query
  select c.id,
         c.case_number,
         c.label,
         c.status,
         c.outcome_id,
         case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end as outcome,
         c.created_at,
         c.closed_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
               'position', cp.position,
               'title', cp.title,
               'status', cp.status,
               'recommended', cp.recommended,
               'assigned_to', cp.assigned_to,
               'assignee_name', pr.full_name,
               'due_date', cp.due_date,
               'result', case when prr.id is null then null else jsonb_build_object(
                 'id', prr.id,
                 'label', prr.label,
                 'color_token', prr.color_token,
                 'is_adverse', prr.is_adverse,
                 'source', cp.result_source
               ) end
             ) order by cp.position)
            from public.case_phases cp
            left join public.profiles pr on pr.id = cp.assigned_to
            left join public.phase_results prr on prr.id = cp.result_id
            where cp.case_id = c.id),
           '[]'::jsonb) as phases,
         -- Scalar open-narrative count (status='aberta'). NON-PHI count only; the
         -- board renders no narrative bodies. 0 when the case has none / the feature
         -- is off (no rows). Feeds the "Etapas pendentes" KPI alongside pending phases.
         (select count(*)::int
            from public.case_narratives cn
            where cn.case_id = c.id and cn.status = 'aberta') as open_narrative_count
  from public.cases c
  left join public.case_outcomes o on o.id = c.outcome_id
  where c.commission_id = p_commission_id
  order by c.case_number desc
  limit greatest(p_limit, 0);
end;
$$;

alter function public.list_cases_board(uuid, integer) owner to postgres;

comment on function public.list_cases_board(uuid, integer) is
  'P3 (WS-6): CAPPED kanban board (most-recent p_limit cases by case_number desc). NOT keyset-cursored (condition-b). Gate + ordering unchanged. Carries a scalar open_narrative_count (status=aberta) per case for the "Etapas pendentes" KPI — minimum-necessary (no narrative bodies). Backed by cases_commission_number_key UNIQUE(commission_id, case_number).';

revoke all on function public.list_cases_board(uuid, integer) from public;
grant execute on function public.list_cases_board(uuid, integer) to authenticated, service_role;
