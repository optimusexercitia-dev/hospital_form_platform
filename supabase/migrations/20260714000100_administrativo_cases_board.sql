-- ============================================================================
-- Administrativo (ADR 0061) — widen list_cases_board to the caller's readable set
-- ============================================================================
-- list_cases_board was coordinator-DEFINER-gated (`if not app.is_staff_admin_of
-- then return`), so a `create_cases` Administrativo who opens a case hit an EMPTY
-- board. Minimally widen: a coordinator (staff_admin OR commission-admin) still
-- sees the WHOLE commission board (unchanged); anyone else sees ONLY the cases they
-- already have read authority to — the SAME set app.can_read_case admits (creator/
-- assignee/narrative-assignee/case_access grant/org-admin arms). This adds NO new
-- read authority and NO new PHI exposure: it filters to the existing read boundary,
-- so an Administrativo sees only cases they can already open, never the full board.
--
-- Body is byte-identical to 20260713000600_board_open_narrative_count.sql EXCEPT
-- the gate: the early coordinator-only return becomes a per-row read predicate.
-- Same signature + RETURNS type, so CREATE OR REPLACE (no drop). Forward-only.
-- ============================================================================

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
declare
  -- Coordinator fast-path: a staff_admin OR commission-admin (org_admin/
  -- hospital_admin) sees the whole board without a per-row read check. Everyone
  -- else is filtered to app.can_read_case per row (their existing read boundary).
  v_is_coordinator boolean :=
    app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id);
  v_uid uuid := auth.uid();
begin
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
         (select count(*)::int
            from public.case_narratives cn
            where cn.case_id = c.id and cn.status = 'aberta') as open_narrative_count
  from public.cases c
  left join public.case_outcomes o on o.id = c.outcome_id
  where c.commission_id = p_commission_id
    -- Coordinator sees all; a non-coordinator sees only cases they can already read
    -- (ADR 0061 — no broadening beyond app.can_read_case's existing arms).
    and (v_is_coordinator or app.can_read_case(c.id, v_uid))
  order by c.case_number desc
  limit greatest(p_limit, 0);
end;
$$;

alter function public.list_cases_board(uuid, integer) owner to postgres;

comment on function public.list_cases_board(uuid, integer) is
  'CAPPED kanban board (most-recent p_limit cases by case_number desc). A coordinator '
  '(staff_admin OR commission-admin) sees the whole commission board; any other caller '
  'sees ONLY cases they can already read via app.can_read_case (ADR 0061 — Administrativo '
  'create_cases board; no new read authority / PHI). Carries a scalar open_narrative_count '
  '(status=aberta) per case for the "Etapas pendentes" KPI (no narrative bodies).';

revoke all on function public.list_cases_board(uuid, integer) from public;
grant execute on function public.list_cases_board(uuid, integer) to authenticated, service_role;
