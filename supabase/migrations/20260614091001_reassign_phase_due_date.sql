-- Extend reassign_phase to also accept and update due_date.
--
-- The existing guard_case_phase_status trigger permits any non-status column
-- change while app.in_case_rpc = 'on', which reassign_phase already sets around
-- its UPDATE. So adding due_date to that UPDATE requires no trigger change.
--
-- p_due_date defaults to null. Since null CLEARS the column, the action layer
-- should always pass the current due date if the user did not change it — the UI
-- handles this by pre-filling the date picker with the current value.
--
-- Drop the old 2-arg overload before recreating with the appended parameter,
-- following the same pattern as 20260614091000_phase_due_dates.sql.

drop function if exists public.reassign_phase(uuid, uuid);

create function public.reassign_phase(
  p_case_phase_id uuid,
  p_new_assignee uuid,
  p_due_date date default null
)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_status text;
  v_commission_id uuid;
  v_has_response boolean;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select c.status, c.commission_id
    into v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_commission_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status <> 'aberto' then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  select exists (
    select 1 from public.responses where case_phase_id = p_case_phase_id
  ) into v_has_response;
  if v_has_response then
    raise exception 'não é possível redefinir o responsável após o início do preenchimento'
      using errcode = 'HC019';
  end if;

  if not app.is_member_of_for(v_commission_id, p_new_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set assigned_to = p_new_assignee,
      due_date = p_due_date,
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.reassign_phase(uuid, uuid, date) to authenticated, service_role;
