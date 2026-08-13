-- =============================================================================
-- ETH·E1 (ADR 0072 · BE-7) — modified reads: list_my_cases respondent/recusal
-- exclusion.
--
-- "Meus Casos" is a personal list keyed on ATTRIBUTION (phase/narrative assignee) or
-- a case_access grant. A respondent or a recused user could otherwise appear there via
-- their attribution — arm order matters for the personal list too (ADR 0072 §2.3). So
-- the WHERE gains an EXPLICIT respondent/recusal exclusion, belt-and-suspenders atop
-- can_read_case's deny-terms (BE-4). Body reproduces the CURRENT live definition (the
-- ADR-0051 predicate rename → is_commission_admin_of_for + the D11 status anglicization
-- → 'active'/'open') + the two new conjuncts; every other arm unchanged.
--
-- get_case_detail's new fields (confidentiality_level / visibility_policy / participants
-- / caller recusal+COI) are surfaced in the TS layer via RLS-scoped reads alongside the
-- envelope (the established getCaseDetailUncached pattern for department/mode rows) — no
-- change to the heavily-tested envelope RPC. Audit verbs are emitted by the BE-5/BE-6
-- RPCs (via app.audit_write); nothing to add here.
-- =============================================================================

create or replace function public.list_my_cases(p_commission uuid)
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
  perform app.assert_case_access_enabled();

  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_obj order by created_at desc, case_number desc), '[]'::jsonb)
    into v_result
  from (
    select
      c.id,
      c.created_at,
      c.case_number,
      jsonb_build_object(
        'case_id', c.id,
        'case_number', c.case_number,
        'label', c.label,
        'status', c.status,
        'my_role',
          case
            when app.is_staff_admin_of_for(c.commission_id, v_uid)
                 or app.is_commission_admin_of_for(c.commission_id, v_uid) then 'coordinator'
            when exists (
              select 1 from public.case_access ca
              where ca.case_id = c.id and ca.user_id = v_uid and ca.level = 'write'
                and (ca.expires_at is null or ca.expires_at > now())
            ) then 'collaborator'
            else 'viewer'
          end,
        'items', (
          select coalesce(jsonb_agg(item order by display_position), '[]'::jsonb)
          from (
            -- the caller's PHASES of this case
            select
              coalesce(cp.display_position, cp.position) as display_position,
              jsonb_build_object(
                'kind', 'phase',
                'id', cp.id,
                'title', coalesce(nullif(btrim(cp.title), ''), f.title, 'Fase ' || cp.position),
                'status', cp.status,
                'display_position', coalesce(cp.display_position, cp.position),
                'actionable', (cp.status = 'active')
              ) as item
            from public.case_phases cp
            join public.forms f on f.id = cp.form_id
            where cp.case_id = c.id and cp.assigned_to = v_uid
            union all
            -- the caller's NARRATIVES of this case
            select
              cn.display_position,
              jsonb_build_object(
                'kind', 'narrative',
                'id', cn.id,
                'title', cn.type_label,
                'status', cn.status,
                'display_position', cn.display_position,
                'actionable', (cn.status = 'open')
              ) as item
            from public.case_narratives cn
            where cn.case_id = c.id and cn.assigned_to = v_uid
          ) items
        )
      ) as row_obj
    from public.cases c
    where c.commission_id = p_commission
      -- "Meus Casos" is the caller's PERSONAL list: cases they are attributed to
      -- (phase/narrative assignee) OR granted (ADR 0033 D7). A coordinator/admin is
      -- NOT auto-included for every case (the board is their management surface) —
      -- they appear here only when personally attributed/granted, and then carry the
      -- 'coordinator' role chip. An EXPIRED grant no longer keeps a case here.
      and (
        exists (select 1 from public.case_access ca
                where ca.case_id = c.id and ca.user_id = v_uid
                  and (ca.expires_at is null or ca.expires_at > now()))
        or exists (select 1 from public.case_phases cp
                   where cp.case_id = c.id and cp.assigned_to = v_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = c.id and cn.assigned_to = v_uid)
      )
      -- ⟵E1 (ADR 0072): a respondent or a recused user is EXCLUDED from their personal
      -- list even when attributed — matching the can_read_case hard-deny (BE-4).
      and not app.is_case_respondent(c.id, v_uid)
      and not app.is_recused_from_case(c.id, v_uid)
  ) rows;

  return v_result;
end;
$$;

alter function public.list_my_cases(uuid) owner to postgres;
revoke all on function public.list_my_cases(uuid) from public;
grant all on function public.list_my_cases(uuid) to authenticated;
grant all on function public.list_my_cases(uuid) to service_role;
