-- =============================================================================
-- ETH·E1 (ADR 0072 D6/D8) — BE-5: DEFINER write authority.
--
-- The REAL write authority for the SELECT-only participant/recusal/COI tables
-- (E0 left case_participants / professional_profiles write-less on purpose — 0064 QA
-- MINOR-1). Every RPC: assert the case_participants flag · coordinator/authority gate ·
-- pt-BR errors · HC0E· codes · audit_write (PHI-free metadata — Rule 11) · t19
-- REVOKE ALL FROM PUBLIC → GRANT authenticated, service_role. A case READER who is not
-- a coordinator gets HC0E4 / 42501. case_participants stays SELECT-only.
--
-- HC0E· (ADR 0072 D9): HC0E0 live-recusal clash · HC0E1 recusal missing/lifted ·
-- HC0E2 duplicate declaration · HC0E3 role/participant-type mismatch · HC0E4
-- write-authority gate · HC0E5 invalid confidentiality level · HC0E7 >1 primary subject.
-- =============================================================================

-- lift_reason: additive column so lift_recusal can persist its justification (D8).
alter table public.case_recusals
  add column if not exists lift_reason_md text;

-- Flag assert for the whole ethics write spine (gated by the m2 flag case_participants).
create or replace function app.assert_case_participants_enabled()
  returns void language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('case_participants') then
    raise exception 'o registro de participantes do caso não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;
alter function app.assert_case_participants_enabled() owner to postgres;

-- Shared org-authority check for the org-scoped professional writers: admin, an
-- org-admin of the org, OR a staff_admin (coordinator) of some commission in the org.
create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_uid is not null and (
    coalesce(app.is_admin(), false)
    or app.is_org_admin_of(p_org)
    or exists (
      select 1 from public.memberships m
      join public.commissions c on c.id = m.commission_id
      where c.organization_id = p_org
        and m.principal_id = p_uid
        and m.role = 'staff_admin'
    )
  );
$$;
alter function app.can_manage_professional(uuid, uuid) owner to postgres;
revoke all on function app.can_manage_professional(uuid, uuid) from public;
grant execute on function app.can_manage_professional(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- Participant write authority (D6).
-- ===========================================================================

create or replace function public.add_case_participant(
  p_case_id uuid, p_participant_id uuid, p_role_id uuid,
  p_is_primary_subject boolean default false, p_involvement_summary text default null
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case public.cases;
  v_role_types text[];
  v_ptype text;
  v_new uuid;
begin
  perform app.assert_case_participants_enabled();
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id) or app.is_commission_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  select allowed_participant_types into v_role_types from public.case_participant_roles where id = p_role_id;
  select participant_type into v_ptype from public.participants where id = p_participant_id;
  if v_role_types is null or v_ptype is null then
    raise exception 'papel ou participante inválido' using errcode = 'P0002';
  end if;
  if not (v_ptype = any (v_role_types)) then
    raise exception 'papel de participante inválido para o tipo de participante'
      using errcode = 'HC0E3';
  end if;

  begin
    insert into public.case_participants
      (case_id, participant_id, role_id, is_primary_subject, involvement_summary, added_by)
    values
      (p_case_id, p_participant_id, p_role_id, coalesce(p_is_primary_subject, false),
       nullif(btrim(p_involvement_summary), ''), auth.uid())
    returning id into v_new;
  exception when unique_violation then
    if coalesce(p_is_primary_subject, false) then
      raise exception 'não é possível definir mais de um sujeito principal ativo'
        using errcode = 'HC0E7';
    end if;
    raise;
  end;

  perform app.audit_write('case.participant_added', 'case', p_case_id, v_case.commission_id,
    'Participante adicionado ao caso',
    jsonb_build_object('participant_id', p_participant_id, 'role_id', p_role_id));
  return v_new;
end;
$$;
alter function public.add_case_participant(uuid, uuid, uuid, boolean, text) owner to postgres;
revoke all on function public.add_case_participant(uuid, uuid, uuid, boolean, text) from public;
grant execute on function public.add_case_participant(uuid, uuid, uuid, boolean, text) to authenticated, service_role;

create or replace function public.remove_case_participant(p_case_participant_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_commission uuid;
begin
  perform app.assert_case_participants_enabled();
  select cp.case_id, c.commission_id into v_case_id, v_commission
  from public.case_participants cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_participant_id and cp.removed_at is null;
  if v_case_id is null then
    raise exception 'participante não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  update public.case_participants set removed_at = now() where id = p_case_participant_id;
  perform app.audit_write('case.participant_removed', 'case', v_case_id, v_commission,
    'Participante removido do caso',
    jsonb_build_object('case_participant_id', p_case_participant_id));
end;
$$;
alter function public.remove_case_participant(uuid) owner to postgres;
revoke all on function public.remove_case_participant(uuid) from public;
grant execute on function public.remove_case_participant(uuid) to authenticated, service_role;

create or replace function public.set_primary_subject(p_case_participant_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_commission uuid;
begin
  perform app.assert_case_participants_enabled();
  select cp.case_id, c.commission_id into v_case_id, v_commission
  from public.case_participants cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_participant_id and cp.removed_at is null;
  if v_case_id is null then
    raise exception 'participante não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  begin
    update public.case_participants set is_primary_subject = true where id = p_case_participant_id;
  exception when unique_violation then
    raise exception 'não é possível definir mais de um sujeito principal ativo'
      using errcode = 'HC0E7';
  end;
  perform app.audit_write('case.primary_subject_set', 'case', v_case_id, v_commission,
    'Sujeito principal definido',
    jsonb_build_object('case_participant_id', p_case_participant_id));
end;
$$;
alter function public.set_primary_subject(uuid) owner to postgres;
revoke all on function public.set_primary_subject(uuid) from public;
grant execute on function public.set_primary_subject(uuid) to authenticated, service_role;

create or replace function public.set_case_participant_role(p_case_participant_id uuid, p_role_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_ptype text;
  v_role_types text[];
begin
  perform app.assert_case_participants_enabled();
  select cp.case_id, c.commission_id, p.participant_type
    into v_case_id, v_commission, v_ptype
  from public.case_participants cp
  join public.cases c on c.id = cp.case_id
  join public.participants p on p.id = cp.participant_id
  where cp.id = p_case_participant_id and cp.removed_at is null;
  if v_case_id is null then
    raise exception 'participante não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode gerenciar participantes deste caso'
      using errcode = 'HC0E4';
  end if;
  select allowed_participant_types into v_role_types from public.case_participant_roles where id = p_role_id;
  if v_role_types is null then
    raise exception 'papel inválido' using errcode = 'P0002';
  end if;
  if not (v_ptype = any (v_role_types)) then
    raise exception 'papel de participante inválido para o tipo de participante'
      using errcode = 'HC0E3';
  end if;
  update public.case_participants set role_id = p_role_id where id = p_case_participant_id;
  perform app.audit_write('case.participant_role_changed', 'case', v_case_id, v_commission,
    'Papel do participante alterado',
    jsonb_build_object('case_participant_id', p_case_participant_id, 'role_id', p_role_id));
end;
$$;
alter function public.set_case_participant_role(uuid, uuid) owner to postgres;
revoke all on function public.set_case_participant_role(uuid, uuid) from public;
grant execute on function public.set_case_participant_role(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- Professional-profile writers (D6) — E0 shipped only readers. Org-scoped.
-- No dispose_*/erasure path at E1 (M2 §7 — retention-pinned; correction only).
-- ===========================================================================

create or replace function public.create_professional_profile(
  p_org uuid, p_full_name text, p_professional_type text default null,
  p_license_number text default null, p_license_region text default null,
  p_specialty text default null, p_affiliation_status text default null,
  p_user_id uuid default null
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_id uuid;
begin
  perform app.assert_case_participants_enabled();
  if not app.can_manage_professional(p_org, auth.uid()) then
    raise exception 'apenas a coordenação ou administração da organização pode registrar profissionais'
      using errcode = '42501';
  end if;
  if coalesce(btrim(p_full_name), '') = '' then
    raise exception 'informe o nome do profissional' using errcode = 'check_violation';
  end if;
  insert into public.professional_profiles
    (organization_id, user_id, full_name, professional_type, license_number,
     license_region, specialty, affiliation_status)
  values
    (p_org, p_user_id, btrim(p_full_name), p_professional_type, p_license_number,
     p_license_region, p_specialty, p_affiliation_status)
  returning id into v_id;
  -- Rule 11: record THAT + WHO + org, NEVER the identity payload (Class-2 personal data).
  perform app.audit_write('professional_profile.created', 'professional_profile', v_id, null,
    'Perfil profissional criado', '{}'::jsonb, p_org);
  return v_id;
end;
$$;
alter function public.create_professional_profile(uuid, text, text, text, text, text, text, uuid) owner to postgres;
revoke all on function public.create_professional_profile(uuid, text, text, text, text, text, text, uuid) from public;
grant execute on function public.create_professional_profile(uuid, text, text, text, text, text, text, uuid) to authenticated, service_role;

create or replace function public.update_professional_profile(
  p_profile_id uuid, p_full_name text default null, p_professional_type text default null,
  p_license_number text default null, p_license_region text default null,
  p_specialty text default null, p_affiliation_status text default null
) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
begin
  perform app.assert_case_participants_enabled();
  select organization_id into v_org from public.professional_profiles where id = p_profile_id;
  if v_org is null then
    raise exception 'profissional não encontrado' using errcode = 'P0002';
  end if;
  if not app.can_manage_professional(v_org, auth.uid()) then
    raise exception 'apenas a coordenação ou administração da organização pode alterar profissionais'
      using errcode = '42501';
  end if;
  -- LGPD Art. 18 CORRECTION (partial update; null keeps the existing value). No erasure
  -- path at E1 (retention-pinned — ADR 0072 §7).
  update public.professional_profiles set
    full_name          = coalesce(nullif(btrim(p_full_name), ''), full_name),
    professional_type  = coalesce(p_professional_type, professional_type),
    license_number     = coalesce(p_license_number, license_number),
    license_region     = coalesce(p_license_region, license_region),
    specialty          = coalesce(p_specialty, specialty),
    affiliation_status = coalesce(p_affiliation_status, affiliation_status),
    updated_at         = now()
  where id = p_profile_id;
  perform app.audit_write('professional_profile.updated', 'professional_profile', p_profile_id, null,
    'Perfil profissional corrigido', '{}'::jsonb, v_org);
end;
$$;
alter function public.update_professional_profile(uuid, text, text, text, text, text, text) owner to postgres;
revoke all on function public.update_professional_profile(uuid, text, text, text, text, text, text) from public;
grant execute on function public.update_professional_profile(uuid, text, text, text, text, text, text) to authenticated, service_role;

-- ===========================================================================
-- Confidentiality / recusal / COI (D8).
-- ===========================================================================

create or replace function public.set_case_confidentiality(p_case_id uuid, p_level text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case public.cases;
begin
  perform app.assert_case_participants_enabled();
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id) or app.is_commission_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação pode alterar a confidencialidade deste caso'
      using errcode = 'HC0E4';
  end if;
  if app.confidentiality_rank(p_level) is null then
    raise exception 'nível de confidencialidade inválido' using errcode = 'HC0E5';
  end if;
  -- in_case_rpc bypasses the terminal-case immutability guard (a closed case may still
  -- be reclassified); the confidentiality-only update emits NO auto case audit (that
  -- trigger only fires on a status change) — so the explicit verb below is the one row.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.cases set confidentiality_level = p_level where id = p_case_id;
  perform set_config('app.in_case_rpc', 'off', true);
  perform app.audit_write('case.confidentiality_changed', 'case', p_case_id, v_case.commission_id,
    'Confidencialidade do caso alterada',
    jsonb_build_object('confidentiality_level', p_level));
end;
$$;
alter function public.set_case_confidentiality(uuid, text) owner to postgres;
revoke all on function public.set_case_confidentiality(uuid, text) from public;
grant execute on function public.set_case_confidentiality(uuid, text) to authenticated, service_role;

create or replace function public.declare_conflict(
  p_case_id uuid, p_conflict_type text, p_description_md text
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
  v_id uuid;
begin
  perform app.assert_case_participants_enabled();
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  -- Self-service: any case READER may declare their OWN conflict.
  if not app.can_read_case(p_case_id, auth.uid()) then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if p_conflict_type not in ('professional_relationship', 'personal_relationship',
                             'financial_interest', 'prior_involvement', 'other') then
    raise exception 'tipo de conflito inválido' using errcode = 'check_violation';
  end if;
  begin
    insert into public.case_conflict_declarations (case_id, declarant_id, conflict_type, description_md)
    values (p_case_id, auth.uid(), p_conflict_type, nullif(btrim(p_description_md), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'declaração de conflito já existe para este usuário neste caso'
      using errcode = 'HC0E2';
  end;
  perform app.audit_write('case.conflict_declared', 'case', p_case_id, v_commission,
    'Conflito de interesse declarado',
    jsonb_build_object('conflict_type', p_conflict_type));
  return v_id;
end;
$$;
alter function public.declare_conflict(uuid, text, text) owner to postgres;
revoke all on function public.declare_conflict(uuid, text, text) from public;
grant execute on function public.declare_conflict(uuid, text, text) to authenticated, service_role;

create or replace function public.record_recusal(
  p_case_id uuid, p_user_id uuid, p_reason_md text, p_conflict_declaration_id uuid default null
) returns uuid
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
  v_source text;
  v_id uuid;
begin
  perform app.assert_case_participants_enabled();
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  -- Coordinator may recuse anyone; a member may recuse THEMSELVES (source='self').
  if p_user_id = auth.uid() then
    v_source := 'self';
  elsif app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission) then
    v_source := 'coordinator';
  else
    raise exception 'apenas a coordenação pode registrar recusas deste caso'
      using errcode = 'HC0E4';
  end if;
  begin
    insert into public.case_recusals
      (case_id, user_id, reason_md, source, conflict_declaration_id, recused_by)
    values
      (p_case_id, p_user_id, nullif(btrim(p_reason_md), ''),
       case when p_conflict_declaration_id is not null then 'conflict' else v_source end,
       p_conflict_declaration_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'recusa já registrada para este usuário neste caso'
      using errcode = 'HC0E0';
  end;
  -- Resolve a linked declaration → 'recused'.
  if p_conflict_declaration_id is not null then
    update public.case_conflict_declarations
      set status = 'recused', resolved_at = now(), resolved_by = auth.uid()
    where id = p_conflict_declaration_id and case_id = p_case_id;
  end if;
  perform app.audit_write('case.recusal_recorded', 'case', p_case_id, v_commission,
    'Recusa registrada no caso',
    jsonb_build_object('user_id', p_user_id, 'source', v_source));
  return v_id;
end;
$$;
alter function public.record_recusal(uuid, uuid, text, uuid) owner to postgres;
revoke all on function public.record_recusal(uuid, uuid, text, uuid) from public;
grant execute on function public.record_recusal(uuid, uuid, text, uuid) to authenticated, service_role;

create or replace function public.lift_recusal(p_recusal_id uuid, p_reason_md text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_commission uuid;
begin
  perform app.assert_case_participants_enabled();
  select cr.case_id, c.commission_id into v_case_id, v_commission
  from public.case_recusals cr
  join public.cases c on c.id = cr.case_id
  where cr.id = p_recusal_id and cr.lifted_at is null;
  if v_case_id is null then
    raise exception 'recusa não encontrada ou já suspensa' using errcode = 'HC0E1';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas a coordenação pode suspender recusas deste caso'
      using errcode = 'HC0E4';
  end if;
  update public.case_recusals
    set lifted_at = now(), lifted_by = auth.uid(), lift_reason_md = nullif(btrim(p_reason_md), '')
  where id = p_recusal_id;
  perform app.audit_write('case.recusal_lifted', 'case', v_case_id, v_commission,
    'Recusa suspensa no caso',
    jsonb_build_object('recusal_id', p_recusal_id));
end;
$$;
alter function public.lift_recusal(uuid, text) owner to postgres;
revoke all on function public.lift_recusal(uuid, text) from public;
grant execute on function public.lift_recusal(uuid, text) to authenticated, service_role;
