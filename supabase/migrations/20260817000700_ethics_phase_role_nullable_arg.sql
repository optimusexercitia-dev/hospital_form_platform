-- =============================================================================
-- ETH·E2 (ADR 0073 D10) — BE-11: make set_case_phase_assignment_role.p_role_id
--   nullable-by-default so the action can CLEAR a phase's assignment role.
--
-- BE-6 declared `p_role_id uuid` (no default). Clearing a role is a valid op (pass
-- NULL), but supabase-js generates a REQUIRED `string` arg with no default, so the
-- typed action cannot pass null. `default null` makes the API honest (the clear path)
-- and the generated type optional. Body unchanged (CREATE OR REPLACE; same signature
-- shape `uuid, uuid`, only the default added). Additive, forward-only.
-- =============================================================================
create or replace function public.set_case_phase_assignment_role(p_phase_id uuid, p_role_id uuid default null)
  returns void language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_phases where id = p_phase_id;
  if v_case_id is null then raise exception 'fase não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  v_org := app.org_of_commission(v_commission);
  if p_role_id is not null and not exists (
       select 1 from public.case_assignment_roles r where r.id = p_role_id and r.organization_id = v_org) then
    raise exception 'papel de atribuição inválido' using errcode = 'HC0J0';
  end if;
  update public.case_phases set assignment_role_id = p_role_id where id = p_phase_id;
end;
$$;
alter function public.set_case_phase_assignment_role(uuid, uuid) owner to postgres;
revoke all on function public.set_case_phase_assignment_role(uuid, uuid) from public;
grant execute on function public.set_case_phase_assignment_role(uuid, uuid) to authenticated, service_role;
