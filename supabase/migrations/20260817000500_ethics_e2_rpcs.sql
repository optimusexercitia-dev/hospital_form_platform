-- =============================================================================
-- ETH·E2 (ADR 0073 D1-D10) — BE-6: the HC0J-coded DEFINER write RPCs + the
--   case_assignment_roles catalog + case_phases.assignment_role_id (window 20260817000500).
--
-- Every RPC: assert_ethics_enabled (HC000) · authority checked FIRST with a DISTINCT
-- SQLSTATE (HC0J1 case-coordinator / 42501 org-catalog — never an exclusion code) ·
-- exists(ethics_case_details) where ethics-scoped (HC0J0) · t19 REVOKE ALL FROM PUBLIC →
-- GRANT authenticated, service_role · PHI-free audit (Rule 11).
--
-- NOT here (already shipped): cast_case_vote (BE-3), schedule_ethics_hearing (BE-4),
-- redact_professional_profile (BE-5), target_case_response / submit_targeted_case_response
-- (BE-3b — the D13 door supersedes D10's set_response_target_participant).
--
-- SQLSTATEs: HC0J0 (lifecycle/state — non-ethics, non-admissible, bad status),
-- HC0J1 (coordinator authority), HC0J2 (bad allegation category), HC0J3 (finding exists),
-- HC0J6 (notification already acknowledged/cancelled), HC0J8 (vote quorum — O-3).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · case_assignment_roles catalog (D10) + case_phases.assignment_role_id.
-- -----------------------------------------------------------------------------
create table if not exists public.case_assignment_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  display_name text not null,
  is_active boolean not null default true,
  position int not null default 0,
  unique (organization_id, key)
);
comment on table public.case_assignment_roles is
  'ADR 0073 D10 — org-scoped case-phase assignment-role catalog (relator/revisor/'
  'presidente/…). SELECT org-scoped (mirrors case_participant_roles); writes DEFINER-CRUD.';
alter table public.case_assignment_roles enable row level security;
create policy case_assignment_roles_select on public.case_assignment_roles
  for select to authenticated
  using (app.is_org_member(organization_id) or app.is_admin());
grant select on public.case_assignment_roles to authenticated;

alter table public.case_phases
  add column if not exists assignment_role_id uuid references public.case_assignment_roles(id);

-- -----------------------------------------------------------------------------
-- helper — resolve a case's commission + assert coordinator authority (HC0J1) +
-- ethics-typed (HC0J0). Returns the commission. Raises on any failure.
-- -----------------------------------------------------------------------------
create or replace function app.assert_ethics_coordinator(p_case_id uuid)
  returns uuid language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_commission uuid;
begin
  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  -- AUTHORITY FIRST (HC0J1) — distinct from every exclusion code.
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar este processo ético'
      using errcode = 'HC0J1';
  end if;
  return v_commission;
end;
$$;
alter function app.assert_ethics_coordinator(uuid) owner to postgres;
revoke all on function app.assert_ethics_coordinator(uuid) from public;
grant execute on function app.assert_ethics_coordinator(uuid) to authenticated, service_role;

create or replace function app.assert_ethics_typed(p_case_id uuid)
  returns void language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not exists (select 1 from public.ethics_case_details d where d.case_id = p_case_id) then
    raise exception 'ação inválida para o status atual do processo ético' using errcode = 'HC0J0';
  end if;
end;
$$;
alter function app.assert_ethics_typed(uuid) owner to postgres;
revoke all on function app.assert_ethics_typed(uuid) from public;
grant execute on function app.assert_ethics_typed(uuid) to authenticated, service_role;

-- =============================================================================
-- D1 — admissibility / intake
-- =============================================================================
create or replace function public.upsert_ethics_case_details(
  p_case_id uuid, p_complaint_channel text default null,
  p_complaint_received_at timestamptz default null, p_summary_md text default null
) returns public.ethics_case_details
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_commission uuid; v_row public.ethics_case_details;
begin
  perform app.assert_ethics_enabled();
  v_commission := app.assert_ethics_coordinator(p_case_id);   -- HC0J1
  if p_complaint_channel is not null
     and p_complaint_channel not in ('internal','patient','external_body','anonymous','other') then
    raise exception 'canal de denúncia inválido' using errcode = 'HC0J0';
  end if;
  insert into public.ethics_case_details as d (case_id, complaint_channel, complaint_received_at, summary_md)
  values (p_case_id, p_complaint_channel, p_complaint_received_at, nullif(btrim(p_summary_md), ''))
  on conflict (case_id) do update set
    complaint_channel     = coalesce(excluded.complaint_channel, d.complaint_channel),
    complaint_received_at = coalesce(excluded.complaint_received_at, d.complaint_received_at),
    summary_md            = coalesce(excluded.summary_md, d.summary_md),
    updated_at            = now()
  returning * into v_row;
  perform app.audit_write('ethics.case_details_upserted', 'case', p_case_id, v_commission,
    'Dados do processo ético atualizados', '{}'::jsonb);
  return v_row;
end;
$$;
alter function public.upsert_ethics_case_details(uuid, text, timestamptz, text) owner to postgres;
revoke all on function public.upsert_ethics_case_details(uuid, text, timestamptz, text) from public;
grant execute on function public.upsert_ethics_case_details(uuid, text, timestamptz, text) to authenticated, service_role;

create or replace function public.decide_admissibility(
  p_case_id uuid, p_status text, p_rationale_md text
) returns void
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_commission uuid;
begin
  perform app.assert_ethics_enabled();
  v_commission := app.assert_ethics_coordinator(p_case_id);   -- HC0J1
  perform app.assert_ethics_typed(p_case_id);                 -- HC0J0
  if p_status not in ('pending','admissible','inadmissible') then
    raise exception 'status de admissibilidade inválido' using errcode = 'HC0J0';
  end if;
  update public.ethics_case_details set
    admissibility_status = p_status,
    admissibility_decided_at = now(),
    admissibility_decided_by = auth.uid(),
    admissibility_rationale_md = nullif(btrim(p_rationale_md), ''),
    updated_at = now()
  where case_id = p_case_id;
  perform app.audit_write('ethics.admissibility_decided', 'case', p_case_id, v_commission,
    'Admissibilidade decidida', jsonb_build_object('admissibility_status', p_status));
end;
$$;
alter function public.decide_admissibility(uuid, text, text) owner to postgres;
revoke all on function public.decide_admissibility(uuid, text, text) from public;
grant execute on function public.decide_admissibility(uuid, text, text) to authenticated, service_role;

-- =============================================================================
-- D2 — allegations / findings + the allegation-category catalog
-- =============================================================================
create or replace function public.add_ethics_allegation(
  p_case_id uuid, p_category_id uuid, p_description_md text,
  p_severity text default null, p_alleged_event_date date default null
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_commission uuid; v_org uuid; v_id uuid;
begin
  perform app.assert_ethics_enabled();
  v_commission := app.assert_ethics_coordinator(p_case_id);   -- HC0J1
  perform app.assert_ethics_typed(p_case_id);                 -- HC0J0
  v_org := app.org_of_commission(v_commission);
  if not exists (select 1 from public.ethics_allegation_categories c
                 where c.id = p_category_id and c.organization_id = v_org and c.is_active) then
    raise exception 'categoria de alegação inválida' using errcode = 'HC0J2';
  end if;
  if p_severity is not null and p_severity not in ('low','moderate','high','critical') then
    raise exception 'severidade inválida' using errcode = 'HC0J0';
  end if;
  insert into public.ethics_allegations
    (case_id, allegation_category_id, description_md, severity, alleged_event_date, created_by)
  values (p_case_id, p_category_id, p_description_md, p_severity, p_alleged_event_date, auth.uid())
  returning id into v_id;
  perform app.audit_write('ethics.allegation_added', 'case', p_case_id, v_commission,
    'Alegação adicionada', jsonb_build_object('allegation_id', v_id));
  return v_id;
end;
$$;
alter function public.add_ethics_allegation(uuid, uuid, text, text, date) owner to postgres;
revoke all on function public.add_ethics_allegation(uuid, uuid, text, text, date) from public;
grant execute on function public.add_ethics_allegation(uuid, uuid, text, text, date) to authenticated, service_role;

create or replace function public.update_ethics_allegation(
  p_allegation_id uuid, p_category_id uuid default null, p_description_md text default null,
  p_severity text default null, p_alleged_event_date date default null, p_status text default null
) returns void
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.ethics_allegations where id = p_allegation_id;
  if v_case_id is null then raise exception 'alegação não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  v_org := app.org_of_commission(v_commission);
  if p_category_id is not null and not exists (
       select 1 from public.ethics_allegation_categories c
       where c.id = p_category_id and c.organization_id = v_org) then
    raise exception 'categoria de alegação inválida' using errcode = 'HC0J2';
  end if;
  if p_severity is not null and p_severity not in ('low','moderate','high','critical') then
    raise exception 'severidade inválida' using errcode = 'HC0J0';
  end if;
  if p_status is not null and p_status not in
     ('under_review','substantiated','not_substantiated','partially_substantiated','dismissed','referred_elsewhere') then
    raise exception 'status de alegação inválido' using errcode = 'HC0J0';
  end if;
  update public.ethics_allegations set
    allegation_category_id = coalesce(p_category_id, allegation_category_id),
    description_md         = coalesce(nullif(btrim(p_description_md), ''), description_md),
    severity              = coalesce(p_severity, severity),
    alleged_event_date    = coalesce(p_alleged_event_date, alleged_event_date),
    status                = coalesce(p_status, status),
    updated_at            = now()
  where id = p_allegation_id;
  perform app.audit_write('ethics.allegation_updated', 'case', v_case_id, v_commission,
    'Alegação atualizada', jsonb_build_object('allegation_id', p_allegation_id));
end;
$$;
alter function public.update_ethics_allegation(uuid, uuid, text, text, date, text) owner to postgres;
revoke all on function public.update_ethics_allegation(uuid, uuid, text, text, date, text) from public;
grant execute on function public.update_ethics_allegation(uuid, uuid, text, text, date, text) to authenticated, service_role;

create or replace function public.record_ethics_finding(
  p_allegation_id uuid, p_finding text,
  p_rationale_md text default null, p_evidence_summary_md text default null
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_id uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.ethics_allegations where id = p_allegation_id;
  if v_case_id is null then raise exception 'alegação não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  if p_finding not in ('substantiated','not_substantiated','partially_substantiated','inconclusive','dismissed') then
    raise exception 'conclusão inválida' using errcode = 'HC0J0';
  end if;
  begin
    insert into public.ethics_findings
      (allegation_id, case_id, finding, rationale_md, evidence_summary_md, decided_by)
    values (p_allegation_id, v_case_id, p_finding, nullif(btrim(p_rationale_md), ''),
            nullif(btrim(p_evidence_summary_md), ''), auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'já existe uma conclusão para esta alegação' using errcode = 'HC0J3';
  end;
  perform app.audit_write('ethics.finding_recorded', 'case', v_case_id, v_commission,
    'Conclusão registrada', jsonb_build_object('allegation_id', p_allegation_id, 'finding', p_finding));
  return v_id;
end;
$$;
alter function public.record_ethics_finding(uuid, text, text, text) owner to postgres;
revoke all on function public.record_ethics_finding(uuid, text, text, text) from public;
grant execute on function public.record_ethics_finding(uuid, text, text, text) to authenticated, service_role;

-- =============================================================================
-- Org-scoped catalog CRUD (allegation categories, sanction types, assignment roles).
-- Authority = can_manage_professional (admin / org_admin / staff_admin-in-org) → 42501.
-- =============================================================================
create or replace function public.create_ethics_allegation_category(
  p_org uuid, p_key text, p_display_name text
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_id uuid;
begin
  perform app.assert_ethics_enabled();
  if not app.can_manage_professional(p_org, auth.uid()) then
    raise exception 'sem autorização para gerenciar o catálogo' using errcode = '42501';
  end if;
  insert into public.ethics_allegation_categories (organization_id, key, display_name)
  values (p_org, p_key, p_display_name) returning id into v_id;
  return v_id;
end;
$$;
alter function public.create_ethics_allegation_category(uuid, text, text) owner to postgres;
revoke all on function public.create_ethics_allegation_category(uuid, text, text) from public;
grant execute on function public.create_ethics_allegation_category(uuid, text, text) to authenticated, service_role;

create or replace function public.archive_ethics_allegation_category(p_category_id uuid)
  returns void language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select organization_id into v_org from public.ethics_allegation_categories where id = p_category_id;
  if v_org is null then raise exception 'categoria não encontrada' using errcode = 'P0002'; end if;
  if not app.can_manage_professional(v_org, auth.uid()) then
    raise exception 'sem autorização para gerenciar o catálogo' using errcode = '42501';
  end if;
  update public.ethics_allegation_categories set is_active = false where id = p_category_id;
end;
$$;
alter function public.archive_ethics_allegation_category(uuid) owner to postgres;
revoke all on function public.archive_ethics_allegation_category(uuid) from public;
grant execute on function public.archive_ethics_allegation_category(uuid) to authenticated, service_role;

create or replace function public.create_ethics_sanction_type(
  p_org uuid, p_key text, p_display_name text
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_id uuid;
begin
  perform app.assert_ethics_enabled();
  if not app.can_manage_professional(p_org, auth.uid()) then
    raise exception 'sem autorização para gerenciar o catálogo' using errcode = '42501';
  end if;
  insert into public.ethics_sanction_types (organization_id, key, display_name)
  values (p_org, p_key, p_display_name) returning id into v_id;
  return v_id;
end;
$$;
alter function public.create_ethics_sanction_type(uuid, text, text) owner to postgres;
revoke all on function public.create_ethics_sanction_type(uuid, text, text) from public;
grant execute on function public.create_ethics_sanction_type(uuid, text, text) to authenticated, service_role;

create or replace function public.archive_ethics_sanction_type(p_type_id uuid)
  returns void language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select organization_id into v_org from public.ethics_sanction_types where id = p_type_id;
  if v_org is null then raise exception 'sanção não encontrada' using errcode = 'P0002'; end if;
  if not app.can_manage_professional(v_org, auth.uid()) then
    raise exception 'sem autorização para gerenciar o catálogo' using errcode = '42501';
  end if;
  update public.ethics_sanction_types set is_active = false where id = p_type_id;
end;
$$;
alter function public.archive_ethics_sanction_type(uuid) owner to postgres;
revoke all on function public.archive_ethics_sanction_type(uuid) from public;
grant execute on function public.archive_ethics_sanction_type(uuid) to authenticated, service_role;

create or replace function public.create_case_assignment_role(
  p_org uuid, p_key text, p_display_name text
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_id uuid;
begin
  perform app.assert_ethics_enabled();
  if not app.can_manage_professional(p_org, auth.uid()) then
    raise exception 'sem autorização para gerenciar o catálogo' using errcode = '42501';
  end if;
  insert into public.case_assignment_roles (organization_id, key, display_name)
  values (p_org, p_key, p_display_name) returning id into v_id;
  return v_id;
end;
$$;
alter function public.create_case_assignment_role(uuid, text, text) owner to postgres;
revoke all on function public.create_case_assignment_role(uuid, text, text) from public;
grant execute on function public.create_case_assignment_role(uuid, text, text) to authenticated, service_role;

create or replace function public.archive_case_assignment_role(p_role_id uuid)
  returns void language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select organization_id into v_org from public.case_assignment_roles where id = p_role_id;
  if v_org is null then raise exception 'papel não encontrado' using errcode = 'P0002'; end if;
  if not app.can_manage_professional(v_org, auth.uid()) then
    raise exception 'sem autorização para gerenciar o catálogo' using errcode = '42501';
  end if;
  update public.case_assignment_roles set is_active = false where id = p_role_id;
end;
$$;
alter function public.archive_case_assignment_role(uuid) owner to postgres;
revoke all on function public.archive_case_assignment_role(uuid) from public;
grant execute on function public.archive_case_assignment_role(uuid) to authenticated, service_role;

create or replace function public.set_case_phase_assignment_role(p_phase_id uuid, p_role_id uuid)
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

-- =============================================================================
-- D3 — decision lifecycle
-- =============================================================================
create or replace function public.create_case_decision(
  p_case_id uuid, p_decision_type text, p_summary_md text, p_rationale_md text default null
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_commission uuid; v_id uuid;
begin
  perform app.assert_ethics_enabled();
  v_commission := app.assert_ethics_coordinator(p_case_id);   -- HC0J1
  perform app.assert_ethics_typed(p_case_id);                 -- HC0J0
  -- The case must be admissible to reach a decision (an inadmissible case just closes).
  if not exists (select 1 from public.ethics_case_details d
                 where d.case_id = p_case_id and d.admissibility_status = 'admissible') then
    raise exception 'a decisão exige um caso admissível' using errcode = 'HC0J0';
  end if;
  insert into public.case_decisions (case_id, decision_type, summary_md, rationale_md)
  values (p_case_id, p_decision_type, p_summary_md, nullif(btrim(p_rationale_md), ''))
  returning id into v_id;
  perform app.audit_write('case.decision_created', 'case', p_case_id, v_commission,
    'Decisão criada', jsonb_build_object('decision_id', v_id));
  return v_id;
end;
$$;
alter function public.create_case_decision(uuid, text, text, text) owner to postgres;
revoke all on function public.create_case_decision(uuid, text, text, text) from public;
grant execute on function public.create_case_decision(uuid, text, text, text) to authenticated, service_role;

create or replace function public.set_ethics_decision_details(
  p_decision_id uuid,
  p_sanction_type_id uuid default null,
  p_sanction_start_date date default null, p_sanction_end_date date default null,
  p_remediation_required boolean default null, p_remediation_description_md text default null,
  p_external_reporting_required boolean default null, p_external_reporting_target text default null,
  p_external_reporting_deadline timestamptz default null,
  p_appeal_allowed boolean default null, p_appeal_deadline timestamptz default null
) returns void
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_org uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then raise exception 'decisão não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  v_org := app.org_of_commission(v_commission);
  if p_sanction_type_id is not null and not exists (
       select 1 from public.ethics_sanction_types s where s.id = p_sanction_type_id and s.organization_id = v_org) then
    raise exception 'tipo de sanção inválido' using errcode = 'HC0J0';
  end if;
  if p_external_reporting_target is not null
     and p_external_reporting_target not in ('crm','cfm','legal_department','police','other') then
    raise exception 'destino de comunicação externa inválido' using errcode = 'HC0J0';
  end if;
  insert into public.ethics_decision_details as d
    (decision_id, case_id, sanction_type_id, sanction_start_date, sanction_end_date,
     remediation_required, remediation_description_md, external_reporting_required,
     external_reporting_target, external_reporting_deadline, appeal_allowed, appeal_deadline)
  values (p_decision_id, v_case_id, p_sanction_type_id, p_sanction_start_date, p_sanction_end_date,
     coalesce(p_remediation_required, false), nullif(btrim(p_remediation_description_md), ''),
     coalesce(p_external_reporting_required, false), p_external_reporting_target,
     p_external_reporting_deadline, coalesce(p_appeal_allowed, true), p_appeal_deadline)
  on conflict (decision_id) do update set
    sanction_type_id            = coalesce(excluded.sanction_type_id, d.sanction_type_id),
    sanction_start_date         = coalesce(excluded.sanction_start_date, d.sanction_start_date),
    sanction_end_date           = coalesce(excluded.sanction_end_date, d.sanction_end_date),
    remediation_required        = coalesce(p_remediation_required, d.remediation_required),
    remediation_description_md  = coalesce(excluded.remediation_description_md, d.remediation_description_md),
    external_reporting_required = coalesce(p_external_reporting_required, d.external_reporting_required),
    external_reporting_target   = coalesce(excluded.external_reporting_target, d.external_reporting_target),
    external_reporting_deadline = coalesce(excluded.external_reporting_deadline, d.external_reporting_deadline),
    appeal_allowed              = coalesce(p_appeal_allowed, d.appeal_allowed),
    appeal_deadline             = coalesce(excluded.appeal_deadline, d.appeal_deadline),
    updated_at                  = now();
  perform app.audit_write('case.decision_details_set', 'case', v_case_id, v_commission,
    'Detalhes da decisão definidos', jsonb_build_object('decision_id', p_decision_id));
end;
$$;
alter function public.set_ethics_decision_details(uuid, uuid, date, date, boolean, text, boolean, text, timestamptz, boolean, timestamptz) owner to postgres;
revoke all on function public.set_ethics_decision_details(uuid, uuid, date, date, boolean, text, boolean, text, timestamptz, boolean, timestamptz) from public;
grant execute on function public.set_ethics_decision_details(uuid, uuid, date, date, boolean, text, boolean, text, timestamptz, boolean, timestamptz) to authenticated, service_role;

create or replace function public.issue_decision(p_decision_id uuid)
  returns void language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_status text;
        v_eligible int; v_votes int; v_required int; v_quorum numeric;
begin
  perform app.assert_ethics_enabled();
  select case_id, status into v_case_id, v_status from public.case_decisions where id = p_decision_id;
  if v_case_id is null then raise exception 'decisão não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  if v_status not in ('draft','proposed','voted') then
    raise exception 'a decisão não pode ser emitida a partir do status atual' using errcode = 'HC0J0';
  end if;
  -- O-3 vote quorum: votes cast >= required (settings quorum_value, else simple majority).
  v_eligible := (select count(*)::int from app.eligible_voters(v_case_id));
  v_votes    := (select count(*)::int from public.case_votes where decision_id = p_decision_id);
  select quorum_value into v_quorum from public.commission_meeting_settings where commission_id = v_commission;
  v_required := greatest(coalesce(v_quorum, ceil(v_eligible::numeric / 2)), 1)::int;
  if v_votes < v_required then
    raise exception 'decisão não pode ser emitida sem quórum de votos' using errcode = 'HC0J8';
  end if;
  -- Fires app.trg_pin_respondent_retention (BE-5).
  update public.case_decisions set status = 'issued', decided_at = now(), decided_by = auth.uid(), updated_at = now()
  where id = p_decision_id;
  perform app.audit_write('case.decision_issued', 'case', v_case_id, v_commission,
    'Decisão emitida', jsonb_build_object('decision_id', p_decision_id));
end;
$$;
alter function public.issue_decision(uuid) owner to postgres;
revoke all on function public.issue_decision(uuid) from public;
grant execute on function public.issue_decision(uuid) to authenticated, service_role;

create or replace function public.void_decision(p_decision_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then raise exception 'decisão não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  update public.case_decisions set status = 'voided', updated_at = now() where id = p_decision_id;
  perform app.audit_write('case.decision_voided', 'case', v_case_id, v_commission,
    'Decisão anulada', jsonb_build_object('decision_id', p_decision_id));
end;
$$;
alter function public.void_decision(uuid, text) owner to postgres;
revoke all on function public.void_decision(uuid, text) from public;
grant execute on function public.void_decision(uuid, text) to authenticated, service_role;

-- =============================================================================
-- D5 — notifications
-- =============================================================================
create or replace function public.issue_ethics_notification(
  p_case_id uuid, p_notification_type text, p_delivery_method text,
  p_recipient_participant_id uuid default null, p_recipient_user_id uuid default null,
  p_due_at timestamptz default null, p_related_document_id uuid default null, p_notes_md text default null
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_commission uuid; v_id uuid;
begin
  perform app.assert_ethics_enabled();
  v_commission := app.assert_ethics_coordinator(p_case_id);   -- HC0J1
  perform app.assert_ethics_typed(p_case_id);                 -- HC0J0
  if p_notification_type not in
     ('complaint_acknowledgement','respondent_notification','request_for_response',
      'hearing_notice','decision_notice','appeal_notice','external_reporting_notice','other') then
    raise exception 'tipo de notificação inválido' using errcode = 'HC0J0';
  end if;
  if p_delivery_method not in ('email','letter','in_person','system','phone','other') then
    raise exception 'método de entrega inválido' using errcode = 'HC0J0';
  end if;
  insert into public.ethics_notifications
    (case_id, recipient_participant_id, recipient_user_id, notification_type, delivery_method,
     status, sent_at, due_at, related_document_id, notes_md, created_by)
  values (p_case_id, p_recipient_participant_id, p_recipient_user_id, p_notification_type, p_delivery_method,
     'sent', now(), p_due_at, p_related_document_id, nullif(btrim(p_notes_md), ''), auth.uid())
  returning id into v_id;
  perform app.audit_write('ethics.notification_issued', 'case', p_case_id, v_commission,
    'Notificação emitida', jsonb_build_object('notification_id', v_id, 'notification_type', p_notification_type));
  return v_id;
end;
$$;
alter function public.issue_ethics_notification(uuid, text, text, uuid, uuid, timestamptz, uuid, text) owner to postgres;
revoke all on function public.issue_ethics_notification(uuid, text, text, uuid, uuid, timestamptz, uuid, text) from public;
grant execute on function public.issue_ethics_notification(uuid, text, text, uuid, uuid, timestamptz, uuid, text) to authenticated, service_role;

create or replace function public.acknowledge_ethics_notification(p_notification_id uuid)
  returns void language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_status text;
begin
  perform app.assert_ethics_enabled();
  select case_id, status into v_case_id, v_status from public.ethics_notifications where id = p_notification_id;
  if v_case_id is null then raise exception 'notificação não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  if v_status in ('acknowledged','cancelled') then
    raise exception 'prazo/notificação inválido ou já reconhecido' using errcode = 'HC0J6';
  end if;
  update public.ethics_notifications set status = 'acknowledged', acknowledged_at = now(), updated_at = now()
  where id = p_notification_id;
  perform app.audit_write('ethics.notification_acknowledged', 'case', v_case_id, v_commission,
    'Notificação reconhecida', jsonb_build_object('notification_id', p_notification_id));
end;
$$;
alter function public.acknowledge_ethics_notification(uuid) owner to postgres;
revoke all on function public.acknowledge_ethics_notification(uuid) from public;
grant execute on function public.acknowledge_ethics_notification(uuid) to authenticated, service_role;

create or replace function public.cancel_ethics_notification(p_notification_id uuid)
  returns void language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_status text;
begin
  perform app.assert_ethics_enabled();
  select case_id, status into v_case_id, v_status from public.ethics_notifications where id = p_notification_id;
  if v_case_id is null then raise exception 'notificação não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  if v_status in ('acknowledged','cancelled') then
    raise exception 'prazo/notificação inválido ou já reconhecido' using errcode = 'HC0J6';
  end if;
  update public.ethics_notifications set status = 'cancelled', updated_at = now() where id = p_notification_id;
  perform app.audit_write('ethics.notification_cancelled', 'case', v_case_id, v_commission,
    'Notificação cancelada', jsonb_build_object('notification_id', p_notification_id));
end;
$$;
alter function public.cancel_ethics_notification(uuid) owner to postgres;
revoke all on function public.cancel_ethics_notification(uuid) from public;
grant execute on function public.cancel_ethics_notification(uuid) to authenticated, service_role;

-- =============================================================================
-- D8 — hearings (complete; schedule shipped in BE-4)
-- =============================================================================
create or replace function public.complete_ethics_hearing(
  p_hearing_id uuid, p_summary_md text, p_outcome_md text,
  p_respondent_present boolean default null, p_complainant_present boolean default null,
  p_legal_representative_present boolean default null
) returns void
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.ethics_hearings where id = p_hearing_id;
  if v_case_id is null then raise exception 'audiência não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  update public.ethics_hearings set
    completed_at = now(),
    summary_md = nullif(btrim(p_summary_md), ''),
    outcome_md = nullif(btrim(p_outcome_md), ''),
    respondent_present = p_respondent_present,
    complainant_present = p_complainant_present,
    legal_representative_present = p_legal_representative_present,
    updated_at = now()
  where id = p_hearing_id;
  perform app.audit_write('ethics.hearing_completed', 'case', v_case_id, v_commission,
    'Audiência concluída', jsonb_build_object('hearing_id', p_hearing_id));
end;
$$;
alter function public.complete_ethics_hearing(uuid, text, text, boolean, boolean, boolean) owner to postgres;
revoke all on function public.complete_ethics_hearing(uuid, text, text, boolean, boolean, boolean) from public;
grant execute on function public.complete_ethics_hearing(uuid, text, text, boolean, boolean, boolean) to authenticated, service_role;

-- =============================================================================
-- D-appeals
-- =============================================================================
create or replace function public.submit_ethics_appeal(
  p_case_id uuid, p_decision_id uuid, p_appeal_reason_md text,
  p_submitted_by_participant_id uuid default null
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_commission uuid; v_dec_case uuid; v_status text; v_id uuid;
begin
  perform app.assert_ethics_enabled();
  v_commission := app.assert_ethics_coordinator(p_case_id);   -- HC0J1
  perform app.assert_ethics_typed(p_case_id);                 -- HC0J0
  select case_id, status into v_dec_case, v_status from public.case_decisions where id = p_decision_id;
  if v_dec_case is null or v_dec_case <> p_case_id then
    raise exception 'decisão inválida para este caso' using errcode = 'HC0J0';
  end if;
  if v_status not in ('issued','appealed') then
    raise exception 'apenas decisões emitidas podem ser objeto de recurso' using errcode = 'HC0J0';
  end if;
  insert into public.ethics_appeals (case_id, decision_id, submitted_by_participant_id, appeal_reason_md)
  values (p_case_id, p_decision_id, p_submitted_by_participant_id, p_appeal_reason_md)
  returning id into v_id;
  update public.case_decisions set status = 'appealed', updated_at = now() where id = p_decision_id;
  perform app.audit_write('case.appeal_submitted', 'case', p_case_id, v_commission,
    'Recurso interposto', jsonb_build_object('appeal_id', v_id, 'decision_id', p_decision_id));
  return v_id;
end;
$$;
alter function public.submit_ethics_appeal(uuid, uuid, text, uuid) owner to postgres;
revoke all on function public.submit_ethics_appeal(uuid, uuid, text, uuid) from public;
grant execute on function public.submit_ethics_appeal(uuid, uuid, text, uuid) to authenticated, service_role;

create or replace function public.review_ethics_appeal(
  p_appeal_id uuid, p_status text, p_outcome text default null, p_outcome_rationale_md text default null
) returns void
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.ethics_appeals where id = p_appeal_id;
  if v_case_id is null then raise exception 'recurso não encontrado' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  if p_status not in ('submitted','under_review','accepted','rejected','withdrawn','closed') then
    raise exception 'status de recurso inválido' using errcode = 'HC0J0';
  end if;
  update public.ethics_appeals set
    status = p_status, reviewed_by = auth.uid(), reviewed_at = now(),
    outcome = nullif(btrim(p_outcome), ''), outcome_rationale_md = nullif(btrim(p_outcome_rationale_md), ''),
    updated_at = now()
  where id = p_appeal_id;
  perform app.audit_write('case.appeal_reviewed', 'case', v_case_id, v_commission,
    'Recurso avaliado', jsonb_build_object('appeal_id', p_appeal_id, 'status', p_status));
end;
$$;
alter function public.review_ethics_appeal(uuid, text, text, text) owner to postgres;
revoke all on function public.review_ethics_appeal(uuid, text, text, text) from public;
grant execute on function public.review_ethics_appeal(uuid, text, text, text) to authenticated, service_role;
