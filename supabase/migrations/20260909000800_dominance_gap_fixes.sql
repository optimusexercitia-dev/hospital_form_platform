-- AFF W2 / T2.4 — close the two live dominance gaps, so the grid ships GREEN.
--
-- ADR 0097 D18 / finding 9: "org_admin dominates hospital_admin" was asserted in prose
-- and tested nowhere, and a census found exactly two gates admitting
-- `is_hospital_admin_of` with no org arm. This migration fixes both; pgTAP `303` turns
-- the prose into an enforced invariant so a third cannot land unnoticed.
--
-- (The census's third hit, `list_approver_candidates`, is a FALSE POSITIVE — it reaches
-- org_admin through `is_commission_admin_of`, whose `_for` variant resolves
-- `has_role('organization', c.organization_id, 'org_admin', ...)`. `303` resolves that
-- transitivity rather than matching surface text, and its dry-run against a
-- hand-classified sample reproduces the same verdict.)

-- ---------------------------------------------------------------------------
-- GAP 1 — `set_standard_ownership`. Body regenerated from live pg_get_functiondef;
-- the ONLY change is the authority line. CREATE OR REPLACE, so the ACL survives.
-- ---------------------------------------------------------------------------
create or replace function public.set_standard_ownership(
  p_hospital uuid,
  p_standard uuid,
  p_commission uuid default null
)
returns public.standard_ownerships
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_result public.standard_ownerships;
  v_commission_hospital uuid;
begin
  perform app.assert_accreditation_enabled();

  -- AFF T2.4 (ADR 0097 D18): an org_admin dominates a hospital_admin. Before this, an
  -- org_admin who held no hospital_admin membership was denied 42501 on their own org's
  -- hospital — the BUG-AUTHZ-001 shape, recurring because dominance was never tested.
  if not (app.is_hospital_admin_of(p_hospital)
          or app.is_org_admin_of(app.org_of_hospital(p_hospital))) then
    raise exception 'apenas o administrador do hospital ou da organização pode definir a comissão responsável'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.accreditation_standards where id = p_standard) then
    raise exception 'padrão não encontrado' using errcode = 'HC0QC';
  end if;

  if p_commission is null then
    delete from public.standard_ownerships where hospital_id = p_hospital and standard_id = p_standard;
    return null;
  end if;

  v_commission_hospital := app.hospital_of_commission(p_commission);
  if v_commission_hospital is distinct from p_hospital then
    raise exception 'a comissão informada não pertence a este hospital'
      using errcode = 'HC0QC';
  end if;

  insert into public.standard_ownerships (hospital_id, standard_id, responsible_commission_id, assigned_by)
  values (p_hospital, p_standard, p_commission, v_uid)
  on conflict (hospital_id, standard_id)
  do update set
    responsible_commission_id = excluded.responsible_commission_id,
    assigned_by = excluded.assigned_by,
    assigned_at = now()
  returning * into v_result;

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- GAP 2 — `standard_ownerships_select`. ALTER POLICY, so name, roles, command and
-- with_check cannot be silently lost by a drop+create.
-- ---------------------------------------------------------------------------
alter policy standard_ownerships_select on public.standard_ownerships
  using (
    app.is_hospital_member_of(hospital_id)
    or app.is_hospital_admin_of(hospital_id)
    or app.is_org_admin_of(app.org_of_hospital(hospital_id))
  );
