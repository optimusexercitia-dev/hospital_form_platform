-- `set_template_case_type` — the write door for a process template's declared case type
-- (ADR 0064 D4; companion to 20260829000000_case_type_assignment.sql).
--
-- Mirrors `set_template_collects_patient`: a SECURITY DEFINER gate on staff_admin, so
-- the template editor never writes `process_templates` directly for this field.
--
-- ⚠ DELIBERATE divergence from `set_template_collects_patient`, which is DRAFT-only:
-- this accepts `draft` AND `active`, rejecting only `archived`. Two reasons —
--   (1) `collects_patient` changes the SHAPE of the case-creation form, so editing it
--       under a live process would desync in-flight cases; `case_type_id` only supplies
--       DEFAULTS to cases created afterwards. Existing cases keep the posture they
--       snapshotted at creation (the `case_outcomes` D11 propagation rule).
--   (2) Draft-only would block the remediation path for the gap this chain closes: an
--       org that discovers its live ethics process is untyped could not fix it without
--       cloning the process, and every case created meanwhile keeps landing
--       `commission_default`.
--
-- The org-consistency check is enforced by `trg_process_template_case_type` regardless
-- of write path; it is re-raised here only so the editor gets it before the UPDATE.

create or replace function public.set_template_case_type(
  p_template_id uuid,
  p_case_type_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_status text;
begin
  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if v_status = 'archived' then
    raise exception 'processos arquivados não podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_case_type_id is not null
     and not exists (
       select 1
       from public.case_types ct
       where ct.id = p_case_type_id
         and ct.organization_id = app.org_of_commission(v_commission_id)
     ) then
    raise exception 'este tipo de caso não pertence à organização desta comissão'
      using errcode = 'HC0F7';
  end if;

  update public.process_templates
  set case_type_id = p_case_type_id, updated_at = now()
  where id = p_template_id;
end;
$function$;

revoke all on function public.set_template_case_type(uuid, uuid) from public;
grant execute on function public.set_template_case_type(uuid, uuid) to authenticated;
