-- =============================================================================
-- Administrativo — delegated-capability role (per commission) · ADR 0061
-- =============================================================================
-- A coordinator (staff_admin) may APPOINT a non-coordinator `staff` member of
-- their commission as an "Administrativo" and grant them a curated, finite set of
-- capabilities from a fixed menu (schedule_meetings / create_cases /
-- assign_case_phases / view_signoffs). This delegates a SUBSET of coordinator
-- bureaucracy WITHOUT introducing a new role enum value and WITHOUT touching the
-- display-only `title` system (ADR 0061; handoff docs/plans/administrativo-…md).
--
-- Governing principle (handoff §3): the `cases` / `case_phases` FOR ALL write
-- policies govern DANGEROUS verbs (conclude/cancel/terminal-status; phase
-- skip/complete) that close_case/cancel_case gate on NOTHING else, so we do NOT
-- broaden them. Administrativo is admitted only through guarded SECURITY DEFINER
-- doors whose bodies expose exactly the safe columns/verbs. Only
-- meetings_staff_admin_write (no PHI, no terminal transition) is opened directly.
--
-- Ships behind an OFF-by-default feature flag `administrativo`. The single
-- capability chokepoint app.member_can() is FLAG-AWARE (returns false when the
-- flag is off), so flipping the flag off is a true kill switch and seeded local
-- appointments stay DORMANT until the flag is flipped on for verification. This
-- strengthens (does not weaken) the handoff's Step-D helper; the appoint/grant
-- RPCs assert the flag independently.
--
-- Forward-only / additive: never edits an applied migration (remote-history rule).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A · Feature flag + assert
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description) values
  ('administrativo', false,
   'When true, the Administrativo delegated-capability role is live: a '
   'coordinator may appoint a non-coordinator staff member and grant a curated '
   'capability subset (schedule_meetings/create_cases/assign_case_phases/'
   'view_signoffs) admitted through guarded DEFINER doors. OFF by default (ADR 0061).')
on conflict (key) do nothing;

create or replace function app.assert_administrativo_enabled() returns void
  language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('administrativo') then
    raise exception 'o recurso de delegação Administrativo não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;
alter function app.assert_administrativo_enabled() owner to postgres;

-- -----------------------------------------------------------------------------
-- B · Tables (DEFINER-only door: SELECT policy only; NO write policy; no DML
--     grant to authenticated — writes flow ONLY through the guarded RPCs below).
-- -----------------------------------------------------------------------------
-- The appointment. A member may be an Administrativo with ZERO capabilities
-- (explicit appointment, not "derived from >=1 cap"). Composite FK to the
-- membership row so un-membering cascades the appointment away.
create table if not exists public.commission_administrativos (
  commission_id uuid not null,
  user_id       uuid not null,
  appointed_by  uuid references public.profiles (id),
  appointed_at  timestamptz not null default now(),
  primary key (commission_id, user_id),
  constraint commission_administrativos_member_fk
    foreign key (commission_id, user_id)
    references public.commission_members (commission_id, user_id) on delete cascade
);
comment on table public.commission_administrativos is
  'Per-commission "Administrativo" APPOINTMENT (ADR 0061). A row means the member '
  'was explicitly appointed by a coordinator; capabilities hang off the child '
  'commission_administrativo_capabilities. DEFINER-only door: SELECT policy only, '
  'no client DML — writes flow through appoint_/revoke_administrativo. Audited by '
  'trg_audit_administrativo. Independent of the display-only title system.';

alter table public.commission_administrativos enable row level security;
revoke insert, update, delete, truncate on public.commission_administrativos from authenticated;
grant select on public.commission_administrativos to authenticated;
grant all on public.commission_administrativos to service_role;

create policy commission_administrativos_select on public.commission_administrativos
  for select to authenticated
  using (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or user_id = auth.uid()
  );

-- The granted capabilities (finite, CHECK-constrained). FK to the appointment so
-- a capability cannot exist without an appointment, and un-appointing cascades.
create table if not exists public.commission_administrativo_capabilities (
  commission_id uuid not null,
  user_id       uuid not null,
  capability    text not null
    check (capability in ('schedule_meetings', 'create_cases', 'assign_case_phases', 'view_signoffs')),
  granted_by    uuid references public.profiles (id),
  granted_at    timestamptz not null default now(),
  primary key (commission_id, user_id, capability),
  constraint commission_admin_cap_appointment_fk
    foreign key (commission_id, user_id)
    references public.commission_administrativos (commission_id, user_id) on delete cascade
);
comment on table public.commission_administrativo_capabilities is
  'Curated finite capability grants for an Administrativo appointment (ADR 0061). '
  'FK-cascades on un-appointment. DEFINER-only door: SELECT policy only, no client '
  'DML — writes flow through grant_/revoke_member_capability. Audited by '
  'trg_audit_administrativo_capabilities. Named administrativo_* to avoid confusion '
  'with the case-access "capabilities" concept.';

alter table public.commission_administrativo_capabilities enable row level security;
revoke insert, update, delete, truncate on public.commission_administrativo_capabilities from authenticated;
grant select on public.commission_administrativo_capabilities to authenticated;
grant all on public.commission_administrativo_capabilities to service_role;

create policy commission_administrativo_capabilities_select on public.commission_administrativo_capabilities
  for select to authenticated
  using (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- C · Blanket audit triggers (Rule 11) — every appoint/grant/revoke audited,
--     regardless of write path. Composite-PK tables (no surrogate id): entity_id
--     = user_id (the appointed principal), mirroring trg_audit_pqs_members. Payload
--     records who/where/what only — never answer or PHI data.
-- -----------------------------------------------------------------------------
create or replace function app.trg_audit_administrativo() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if tg_op = 'INSERT' then
    perform app.audit_write(
      'administrativo.appointed', 'administrativo', new.user_id,
      new.commission_id, 'Administrativo designado',
      jsonb_build_object('user_id', new.user_id, 'commission_id', new.commission_id));
    return null;
  else
    perform app.audit_write(
      'administrativo.revoked', 'administrativo', old.user_id,
      old.commission_id, 'Administrativo removido',
      jsonb_build_object('user_id', old.user_id, 'commission_id', old.commission_id));
    return null;
  end if;
end;
$$;
alter function app.trg_audit_administrativo() owner to postgres;

drop trigger if exists trg_audit_administrativo on public.commission_administrativos;
create trigger trg_audit_administrativo
  after insert or delete on public.commission_administrativos
  for each row execute function app.trg_audit_administrativo();

create or replace function app.trg_audit_administrativo_capabilities() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if tg_op = 'INSERT' then
    perform app.audit_write(
      'administrativo_capability.granted', 'administrativo', new.user_id,
      new.commission_id, 'Capacidade de Administrativo concedida (' || new.capability || ')',
      jsonb_build_object('user_id', new.user_id, 'commission_id', new.commission_id,
                         'capability', new.capability));
    return null;
  else
    perform app.audit_write(
      'administrativo_capability.revoked', 'administrativo', old.user_id,
      old.commission_id, 'Capacidade de Administrativo revogada (' || old.capability || ')',
      jsonb_build_object('user_id', old.user_id, 'commission_id', old.commission_id,
                         'capability', old.capability));
    return null;
  end if;
end;
$$;
alter function app.trg_audit_administrativo_capabilities() owner to postgres;

drop trigger if exists trg_audit_administrativo_capabilities on public.commission_administrativo_capabilities;
create trigger trg_audit_administrativo_capabilities
  after insert or delete on public.commission_administrativo_capabilities
  for each row execute function app.trg_audit_administrativo_capabilities();

-- -----------------------------------------------------------------------------
-- D · Capability predicate — the single chokepoint OR-composed into each guarded
--     door. FLAG-AWARE (returns false when the flag is off) so the flag is a true
--     kill switch and seeded appointments stay dormant while dark. STABLE/DEFINER.
-- -----------------------------------------------------------------------------
create or replace function app.member_can(p_commission_id uuid, p_capability text)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.feature_enabled('administrativo')
     and app.is_active(auth.uid())
     and exists (
       select 1 from public.commission_administrativo_capabilities c
       where c.commission_id = p_commission_id
         and c.user_id = auth.uid()
         and c.capability = p_capability
     );
$$;
alter function app.member_can(uuid, text) owner to postgres;
comment on function app.member_can(uuid, text) is
  'True when the CALLER holds the given Administrativo capability in the commission '
  '(ADR 0061). Flag-aware: false when the administrativo flag is off (kill switch). '
  'OR-composed into the specific guarded DEFINER doors for each capability; never '
  'ORed into the cases/case_phases FOR ALL write policies (leak guardrails 1-2).';
revoke all on function app.member_can(uuid, text) from public;
grant execute on function app.member_can(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- E · Internal unchecked case_access grant. Extracts grant_case_access's upsert
--     so the phase RPCs can grant an assignee working access WITHOUT tripping
--     grant_case_access's own caller gate. NO authority gate of its own — every
--     caller must gate first. app.* is not PostgREST-exposed.
-- -----------------------------------------------------------------------------
create or replace function app._grant_case_access_unchecked(
  p_case uuid, p_user uuid, p_level text,
  p_expires_at timestamptz default null, p_reason text default null
) returns void language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  insert into public.case_access (case_id, user_id, level, granted_by, granted_at, expires_at, reason)
  values (p_case, p_user, p_level, auth.uid(), now(), p_expires_at, nullif(btrim(p_reason), ''))
  on conflict (case_id, user_id)
  do update set level = excluded.level, granted_by = excluded.granted_by,
                granted_at = excluded.granted_at,
                expires_at = excluded.expires_at, reason = excluded.reason;
end;
$$;
alter function app._grant_case_access_unchecked(uuid, uuid, text, timestamptz, text) owner to postgres;
comment on function app._grant_case_access_unchecked(uuid, uuid, text, timestamptz, text) is
  'INTERNAL (ADR 0061): the case_access upsert body of grant_case_access with NO '
  'authority gate. Callers (grant_case_access after its gate; activate_phase / '
  'reassign_phase to grant the assignee working access) MUST authorize first.';
revoke all on function app._grant_case_access_unchecked(uuid, uuid, text, timestamptz, text) from public;
grant execute on function app._grant_case_access_unchecked(uuid, uuid, text, timestamptz, text) to authenticated, service_role;

-- Re-point grant_case_access to call the internal helper AFTER its existing gate.
-- Body verbatim from 20260708000000 except the upsert -> helper delegation.
create or replace function public.grant_case_access(
  p_case uuid, p_user uuid, p_level text,
  p_expires_at timestamptz default null, p_reason text default null
) returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_level not in ('read', 'write') then
    raise exception 'nível de acesso inválido' using errcode = 'check_violation';
  end if;
  if not app.is_member_of_for(v_commission, p_user) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'a data de expiração deve ser futura' using errcode = 'check_violation';
  end if;

  perform app._grant_case_access_unchecked(p_case, p_user, p_level, p_expires_at, p_reason);
end;
$$;
alter function public.grant_case_access(uuid, uuid, text, timestamptz, text) owner to postgres;
revoke all on function public.grant_case_access(uuid, uuid, text, timestamptz, text) from public;
grant all on function public.grant_case_access(uuid, uuid, text, timestamptz, text) to authenticated;
grant all on function public.grant_case_access(uuid, uuid, text, timestamptz, text) to service_role;

-- -----------------------------------------------------------------------------
-- F · Appointment + capability RPCs (guarded DEFINER doors). Escalation guard =
--     is_staff_admin_of OR is_commission_admin_of, so a holder can NEVER appoint
--     or grant (including to themselves — _deny_self_grant). t19 grant hygiene.
-- -----------------------------------------------------------------------------
create or replace function public.appoint_administrativo(p_commission_id uuid, p_user_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_administrativo_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  perform app._deny_self_grant(p_user_id);
  -- The target must be a current NON-coordinator staff member of THIS commission.
  -- A coordinator already holds every capability implicitly, so appointing one is
  -- meaningless; a non-member cannot be appointed.
  if not app.is_member_of_for(p_commission_id, p_user_id) then
    raise exception 'o membro deve pertencer à comissão' using errcode = 'HC021';
  end if;
  if not exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id and user_id = p_user_id and role = 'staff'
  ) then
    raise exception 'apenas um membro comum (staff) pode ser designado Administrativo'
      using errcode = '42501';
  end if;

  insert into public.commission_administrativos (commission_id, user_id, appointed_by)
  values (p_commission_id, p_user_id, auth.uid())
  on conflict (commission_id, user_id) do nothing;
end;
$$;
alter function public.appoint_administrativo(uuid, uuid) owner to postgres;
revoke all on function public.appoint_administrativo(uuid, uuid) from public;
grant execute on function public.appoint_administrativo(uuid, uuid) to authenticated, service_role;

create or replace function public.revoke_administrativo(p_commission_id uuid, p_user_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_administrativo_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- Deleting the appointment FK-cascades its capabilities away.
  delete from public.commission_administrativos
  where commission_id = p_commission_id and user_id = p_user_id;
end;
$$;
alter function public.revoke_administrativo(uuid, uuid) owner to postgres;
revoke all on function public.revoke_administrativo(uuid, uuid) from public;
grant execute on function public.revoke_administrativo(uuid, uuid) to authenticated, service_role;

create or replace function public.grant_member_capability(
  p_commission_id uuid, p_user_id uuid, p_capability text
) returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_administrativo_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_capability not in ('schedule_meetings', 'create_cases', 'assign_case_phases', 'view_signoffs') then
    raise exception 'capacidade inválida' using errcode = 'check_violation';
  end if;
  -- The appointment-first FK guarantees the member is an Administrativo; a missing
  -- appointment surfaces as a foreign_key_violation (mapped to a pt-BR error by the
  -- action layer). Idempotent.
  insert into public.commission_administrativo_capabilities (commission_id, user_id, capability, granted_by)
  values (p_commission_id, p_user_id, p_capability, auth.uid())
  on conflict (commission_id, user_id, capability) do nothing;
end;
$$;
alter function public.grant_member_capability(uuid, uuid, text) owner to postgres;
revoke all on function public.grant_member_capability(uuid, uuid, text) from public;
grant execute on function public.grant_member_capability(uuid, uuid, text) to authenticated, service_role;

create or replace function public.revoke_member_capability(
  p_commission_id uuid, p_user_id uuid, p_capability text
) returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_administrativo_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  delete from public.commission_administrativo_capabilities
  where commission_id = p_commission_id and user_id = p_user_id and capability = p_capability;
end;
$$;
alter function public.revoke_member_capability(uuid, uuid, text) owner to postgres;
revoke all on function public.revoke_member_capability(uuid, uuid, text) from public;
grant execute on function public.revoke_member_capability(uuid, uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- G · ALTER existing objects — body verbatim except the new gate line. t19 grant
--     hygiene re-asserted after each CREATE OR REPLACE (resets the ACL).
-- -----------------------------------------------------------------------------

-- G1 · create_meeting — add the schedule_meetings capability arm.
create or replace function public.create_meeting(
  p_commission_id uuid, p_title text, p_meeting_type_id uuid default null,
  p_scheduled_start timestamptz default now(), p_scheduled_end timestamptz default null,
  p_modality text default 'presencial', p_location_text text default null,
  p_meeting_url text default null
) returns public.meetings
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_result public.meetings;
  v_attempt integer := 0;
begin
  perform app.assert_meetings_enabled();
  if not (app.is_staff_admin_of(p_commission_id)
          or app.is_commission_admin_of(p_commission_id)
          or app.member_can(p_commission_id, 'schedule_meetings')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para a reunião' using errcode = 'check_violation';
  end if;
  if p_meeting_type_id is not null and not exists (
    select 1 from public.commission_meeting_types
    where id = p_meeting_type_id and commission_id = p_commission_id
  ) then
    raise exception 'tipo de reunião inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.meetings
        (commission_id, meeting_type_id, title, scheduled_start, scheduled_end,
         modality, location_text, meeting_url, created_by)
      values
        (p_commission_id, p_meeting_type_id, btrim(p_title),
         p_scheduled_start, p_scheduled_end, coalesce(p_modality, 'presencial'),
         nullif(btrim(p_location_text), ''), nullif(btrim(p_meeting_url), ''), auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;
alter function public.create_meeting(uuid, text, uuid, timestamptz, timestamptz, text, text, text) owner to postgres;
revoke all on function public.create_meeting(uuid, text, uuid, timestamptz, timestamptz, text, text, text) from public;
grant all on function public.create_meeting(uuid, text, uuid, timestamptz, timestamptz, text, text, text) to authenticated, service_role;

-- G2 · create_case — add the create_cases capability arm.
create or replace function public.create_case(
  p_commission_id uuid, p_label text default null, p_patient_enabled boolean default false,
  p_outcome_ids uuid[] default '{}'::uuid[], p_department_id uuid default null,
  p_department_other text default null
) returns public.cases
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case public.cases;
  v_attempt integer := 0;
  v_bad uuid;
  v_dept_other text := nullif(btrim(p_department_other), '');
begin
  perform app.assert_cases_enabled();
  perform app.assert_processless_cases_enabled();

  if not exists (select 1 from public.commissions where id = p_commission_id) then
    raise exception 'comissão % não encontrada', p_commission_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()
          or app.member_can(p_commission_id, 'create_cases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, p_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  if cardinality(p_outcome_ids) > 0 then
    perform app.assert_extras_enabled();

    select oid into v_bad
    from unnest(p_outcome_ids) as oid
    where not exists (
      select 1 from public.case_outcomes o
      where o.id = oid
        and o.commission_id = p_commission_id
        and o.archived = false
    )
    limit 1;
    if found then
      raise exception 'este desfecho não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_id, label, created_by, patient_enabled,
         department_id, department_other)
      values
        (p_commission_id, null, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(p_patient_enabled, false), p_department_id, v_dept_other)
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  if cardinality(p_outcome_ids) > 0 then
    insert into public.case_offered_outcomes (case_id, outcome_id)
    select v_case.id, oid from unnest(p_outcome_ids) as oid
    on conflict do nothing;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  return v_case;
end;
$$;
alter function public.create_case(uuid, text, boolean, uuid[], uuid, text) owner to postgres;
revoke all on function public.create_case(uuid, text, boolean, uuid[], uuid, text) from public;
grant execute on function public.create_case(uuid, text, boolean, uuid[], uuid, text) to authenticated, service_role;

-- G3 · create_case_from_template — add the create_cases capability arm. The
-- "not found" masking is preserved (unauthorized still sees no_data_found).
create or replace function public.create_case_from_template(
  p_template_id uuid, p_label text default null,
  p_department_id uuid default null, p_department_other text default null
) returns public.cases
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
  v_dept_other text := nullif(btrim(p_department_other), '');
begin
  perform app.assert_cases_enabled();

  select commission_id, status, collects_patient
    into v_commission_id, v_status, v_collects
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'create_cases')) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, v_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_id, label, created_by, patient_enabled,
         department_id, department_other)
      values
        (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(v_collects, false), p_department_id, v_dept_other)
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  for r_slot in
    select position, form_id, title, recommend_when, default_due_days, blocks,
           display_position, result_ruleset, emits_result, allowed_result_ids
    from public.process_template_phases
    where template_id = p_template_id
    order by position
  loop
    v_version := app.published_version_of_form(r_slot.form_id);
    if v_version is null then
      raise exception
        'o formulário da fase % ainda não foi publicado', r_slot.position
        using errcode = 'HC017';
    end if;

    if r_slot.recommend_when is not null then
      perform app.validate_template_recommend_when(
        p_template_id, r_slot.position, r_slot.recommend_when
      );
    end if;

    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position, result_ruleset,
       emits_result, allowed_result_ids)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position), r_slot.result_ruleset,
       r_slot.emits_result, r_slot.allowed_result_ids);
  end loop;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  insert into public.case_phase_offered_results (case_id, result_id)
  select distinct v_case.id, ids.rid
  from public.process_template_phases ph
  cross join lateral (
    select (r ->> 'result_id')::uuid as rid
    from jsonb_array_elements(coalesce(ph.result_ruleset -> 'rules', '[]'::jsonb)) as r
    union
    select (ph.result_ruleset ->> 'default_result_id')::uuid
    union
    select (m #>> '{}')::uuid
    from jsonb_array_elements(coalesce(ph.allowed_result_ids, '[]'::jsonb)) as m
  ) ids
  where ph.template_id = p_template_id
    and ids.rid is not null
  on conflict do nothing;

  if v_narratives_on then
    insert into public.case_narratives
      (case_id, narrative_type_id, type_label, display_position, title,
       instructions, is_expected, created_by)
    select v_case.id, ptn.narrative_type_id,
           coalesce(nullif(btrim(ptn.title), ''), cnt.label),
           ptn.display_position, ptn.title, ptn.instructions, ptn.is_expected,
           auth.uid()
    from public.process_template_narratives ptn
    join public.case_narrative_types cnt on cnt.id = ptn.narrative_type_id
    where ptn.template_id = p_template_id;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;
alter function public.create_case_from_template(uuid, text, uuid, text) owner to postgres;
revoke all on function public.create_case_from_template(uuid, text, uuid, text) from public;
grant execute on function public.create_case_from_template(uuid, text, uuid, text) to authenticated, service_role;

-- G4 · NEW update_case_meta — the SINGLE audited door for label/department edits.
-- Coordinator arm is fully functional (frontend routes ALL meta edits here). The
-- flag assert fires ONLY on the capability arm (zero coordinator behavior change
-- while dark). Updates ONLY label/department_* — never status/outcome/closed/PHI.
create or replace function public.update_case_meta(
  p_case_id uuid, p_label text default null,
  p_department_id uuid default null, p_department_other text default null
) returns public.cases
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
  v_status text;
  v_case public.cases;
  v_dept_other text := nullif(btrim(p_department_other), '');
begin
  perform app.assert_cases_enabled();

  select commission_id, status into v_commission, v_status
  from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  -- Authority: coordinator/commission-admin (flag-independent), OR an Administrativo
  -- with create_cases (flag-gated — the cap arm asserts the feature).
  if app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission) then
    null;
  elsif app.member_can(v_commission, 'create_cases') then
    perform app.assert_administrativo_enabled();
  else
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- A terminal case is frozen (HC025) — no meta edits after conclude/cancel.
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- Department shape + hospital ownership (same rules as create_case).
  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, v_commission) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  update public.cases
  set label = nullif(btrim(p_label), ''),
      department_id = p_department_id,
      department_other = v_dept_other
  where id = p_case_id
  returning * into v_case;

  return v_case;
end;
$$;
alter function public.update_case_meta(uuid, text, uuid, text) owner to postgres;
comment on function public.update_case_meta(uuid, text, uuid, text) is
  'The single audited door for editing a case''s label + department (ADR 0061). '
  'Coordinator/commission-admin OR an Administrativo with create_cases (flag-gated). '
  'Updates ONLY label/department_* — never status/outcome/closed_*/PHI. Blocks a '
  'terminal case (HC025). Frontend routes ALL meta edits through this RPC.';
revoke all on function public.update_case_meta(uuid, text, uuid, text) from public;
grant execute on function public.update_case_meta(uuid, text, uuid, text) to authenticated, service_role;

-- G5 · activate_phase — flip to SECURITY DEFINER; add the assign_case_phases arm;
-- grant the assignee case_access WRITE so they can work the phase (behavior change:
-- assignment now grants working access, for every assignment incl. coordinators).
create or replace function public.activate_phase(
  p_case_phase_id uuid, p_assigned_to uuid, p_due_date date default null
) returns public.case_phases
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_status text;
  v_case_status text;
  v_commission_id uuid;
  v_blocks integer[];
  v_blocking integer;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.status, cp.blocks, c.status, c.commission_id
    into v_case_id, v_status, v_blocks, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  -- Authority (DEFINER now bypasses RLS -> explicit gate): coordinator/commission-
  -- admin OR an Administrativo with assign_case_phases.
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'assign_case_phases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;
  if v_status <> 'pendente' then
    raise exception 'esta fase não está pendente' using errcode = 'HC019';
  end if;

  if v_blocks is not null and cardinality(v_blocks) > 0 then
    select count(*) into v_blocking
    from public.case_phases
    where case_id = v_case_id
      and position = any(v_blocks)
      and status not in ('concluida', 'nao_necessaria');
    if v_blocking > 0 then
      raise exception 'conclua ou marque as fases que bloqueiam esta antes de ativá-la'
        using errcode = 'HC018';
    end if;
  end if;

  if not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'ativa',
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      activated_at = now(),
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  -- Behavior change (ADR 0061): the assignee gets case_access WRITE to work the
  -- phase. Auditable + revocable (ADR 0033 ACL), gated only when the case_access
  -- feature is live (the ACL is inert otherwise).
  if app.feature_enabled('case_access') then
    perform app._grant_case_access_unchecked(v_case_id, p_assigned_to, 'write');
  end if;

  return v_result;
end;
$$;
alter function public.activate_phase(uuid, uuid, date) owner to postgres;
revoke all on function public.activate_phase(uuid, uuid, date) from public;
grant all on function public.activate_phase(uuid, uuid, date) to authenticated, service_role;

-- G6 · reassign_phase — flip to SECURITY DEFINER; add the assign_case_phases arm;
-- grant the NEW assignee case_access WRITE. Least-privilege note (handoff §9): the
-- PREVIOUS assignee's auto-grant is intentionally LEFT AS-IS (simple; revisit if
-- strict least-privilege is required).
create or replace function public.reassign_phase(
  p_case_phase_id uuid, p_new_assignee uuid, p_due_date date default null
) returns public.case_phases
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_case_status text;
  v_commission_id uuid;
  v_has_response boolean;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, c.status, c.commission_id
    into v_case_id, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_commission_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'assign_case_phases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
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

  if app.feature_enabled('case_access') then
    perform app._grant_case_access_unchecked(v_case_id, p_new_assignee, 'write');
  end if;

  return v_result;
end;
$$;
alter function public.reassign_phase(uuid, uuid, date) owner to postgres;
revoke all on function public.reassign_phase(uuid, uuid, date) from public;
grant all on function public.reassign_phase(uuid, uuid, date) to authenticated, service_role;

-- G7 · close_case — add an EXPLICIT coordinator/commission-admin gate (defense in
-- depth; NO member_can — conclusion stays coordinator-only, guardrails 1-2). Keep
-- SECURITY INVOKER; resolve the commission via app.commission_of_case.
create or replace function public.close_case(p_case_id uuid) returns public.cases
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_status text;
  v_outcome_id uuid;
  v_unsettled integer;
  v_offered integer;
  v_commission uuid;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Conclusion is coordinator-only (an Administrativo NEVER concludes/cancels).
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select status, outcome_id into v_status, v_outcome_id
  from public.cases where id = p_case_id;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  select count(*) into v_unsettled
  from public.case_phases
  where case_id = p_case_id and status in ('pendente', 'ativa');
  if v_unsettled > 0 then
    raise exception 'conclua ou marque todas as fases antes de concluir o caso'
      using errcode = 'HC031';
  end if;

  select count(*) into v_offered
  from public.case_offered_outcomes where case_id = p_case_id;
  if v_offered > 0 and v_outcome_id is null then
    raise exception 'selecione um desfecho antes de concluir o caso'
      using errcode = 'HC028';
  end if;

  if app.feature_enabled('case_referrals') and exists (
    select 1 from public.case_referral r
    where r.source_case_id = p_case_id and r.response_expected = true
      and r.status in ('enviada', 'recebida', 'aceita', 'em_analise')
  ) then
    raise exception 'há encaminhamentos aguardando resposta; conclua, recuse ou retire antes de encerrar o caso'
      using errcode = 'HC076';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  update public.cases
  set status = 'concluido', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;
alter function public.close_case(uuid) owner to postgres;
revoke all on function public.close_case(uuid) from public;
grant all on function public.close_case(uuid) to authenticated, service_role;

-- G8 · cancel_case — same explicit coordinator/commission-admin gate. Note: the
-- search_path gains 'app' (the original lacked it but schema-qualified app.* calls,
-- so this is a harmless hardening; the gate/commission resolution are app.*).
create or replace function public.cancel_case(p_case_id uuid) returns public.cases
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_status text;
  v_commission uuid;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select status into v_status from public.cases where id = p_case_id;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  update public.cases
  set status = 'cancelado', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;
alter function public.cancel_case(uuid) owner to postgres;
revoke all on function public.cancel_case(uuid) from public;
grant all on function public.cancel_case(uuid) to authenticated, service_role;

-- G9 · list_signoff_queue — add the view_signoffs capability arm (read-only; the
-- signing path is never touched, guardrail 4). Empty set for anyone else.
create or replace function public.list_signoff_queue(p_commission_id uuid)
  returns table(response_id uuid, form_id uuid, form_title text, version_number integer,
                respondent_id uuid, respondent_name text, section_id uuid, section_title text,
                pending_count integer, started_at timestamptz, updated_at timestamptz)
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  -- Internal gate: coordinator OR an Administrativo with view_signoffs; anyone
  -- else gets an empty set (no leak, no error). Read-only — never a sign action.
  if not (app.is_staff_admin_of(p_commission_id)
          or app.member_can(p_commission_id, 'view_signoffs')) then
    return;
  end if;

  return query
  with candidate as (
    select r.id,
           r.form_version_id,
           r.created_by,
           r.started_at,
           r.updated_at,
           app.answer_map(r.id) as answers
    from public.responses r
    where r.commission_id = p_commission_id
      and r.status = 'in_progress'
  ),
  pending_sections as (
    select c.id as response_id,
           s.id as section_id,
           s.title as section_title,
           s.position
    from candidate c
    join public.form_sections s
      on s.form_version_id = c.form_version_id
     and s.requires_signoff = true
     and s.signoff_role = 'staff_admin'
    where app.eval_condition(s.visible_when, c.answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = c.id
          and so.section_id = s.id
      )
  ),
  ranked as (
    select ps.response_id,
           ps.section_id,
           ps.section_title,
           count(*) over (partition by ps.response_id) as pending_count,
           row_number() over (partition by ps.response_id order by ps.position) as rn
    from pending_sections ps
  )
  select c.id,
         fv.form_id,
         f.title,
         fv.version_number,
         c.created_by,
         p.full_name,
         rk.section_id,
         rk.section_title,
         rk.pending_count::integer,
         c.started_at,
         c.updated_at
  from candidate c
  join ranked rk on rk.response_id = c.id and rk.rn = 1
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  join public.profiles p on p.id = c.created_by
  where app.response_required_complete(c.id)
  order by c.updated_at desc;
end;
$$;
alter function public.list_signoff_queue(uuid) owner to postgres;
revoke all on function public.list_signoff_queue(uuid) from public;
grant all on function public.list_signoff_queue(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- H · Broaden meetings_staff_admin_write — the one policy safe to open (no PHI,
--     no terminal transition). Add the schedule_meetings arm to USING + WITH CHECK.
-- -----------------------------------------------------------------------------
drop policy if exists meetings_staff_admin_write on public.meetings;
create policy meetings_staff_admin_write on public.meetings
  to authenticated
  using (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or app.member_can(commission_id, 'schedule_meetings')
  )
  with check (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or app.member_can(commission_id, 'schedule_meetings')
  );
