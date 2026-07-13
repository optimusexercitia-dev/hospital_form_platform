-- ============================================================================
-- MEM-4 · The write door: grant_role / revoke_role (SECURITY DEFINER, the SOLE
--          write path into public.memberships) + the ~10 appointment-RPC shims.
--
-- Per-role authority arms reuse the INCUMBENT RPC authority VERBATIM (no privilege
-- widening — each mapped against the current assign_*/add_pqs_member/addStaff
-- authority). Carries the WS-1 contracts verbatim: app._deny_self_grant (stays
-- 42501), HC0G1 anti-lockout (re-homed HC081, last org_admin). Audit is by TRIGGER
-- (MEM-5), never in the RPC.
--
-- SQLSTATE block HC0G0–HC0G9 (S0 §B; block was free — verified):
--   HC0G0 invalidScopeRole · HC0G1 lastOrgAdmin · HC0G2 invalidShape
--   HC0G3 reserved (staff self-escalation stays 42501 per lead D3) · HC0G4-9 reserved
--
-- Spec: docs/plans/memberships-collapse-s6-1.md §2.3 / §4. Binding: Rules 1/11; t19.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- grant_role — authority (per role, incumbent-verbatim) → deny-self-grant →
--              shape-coherent insert (on conflict do nothing).
-- ----------------------------------------------------------------------------
create or replace function public.grant_role(
  p_scope_type text,
  p_scope_id   uuid,
  p_role       text,
  p_user       uuid,
  p_title_id   uuid default null
) returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org      uuid;
  v_hospital uuid;
begin
  -- Authority + scope-column resolution, dispatched on (scope_type, role). Each arm
  -- reuses the incumbent RPC's authority check verbatim (no widening).
  if p_scope_type = 'organization' and p_role in ('org_admin', 'nsp_org_admin') then
    -- assign_org_admin: is_admin() OR is_org_admin_of; assign_nsp_org_admin: is_org_admin_of.
    if p_role = 'org_admin' then
      if not (app.is_admin() or app.is_org_admin_of(p_scope_id)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else  -- nsp_org_admin
      if not app.is_org_admin_of(p_scope_id) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;
    v_org := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'hospital_admin' then
    -- assign_hospital_admin: is_org_admin_of(org_of_hospital).
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_org_admin_of(v_org) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'nsp_coordinator' then
    -- assign_nsp_coordinator: is_nsp_org_admin_of(org_of_hospital) ONLY (decision 3).
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_nsp_org_admin_of(v_org) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'pqs_member' then
    -- add_pqs_member: is_nsp_org_admin_of(org_of_hospital) OR is_nsp_coordinator_of.
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not (app.is_nsp_org_admin_of(v_org) or app.is_nsp_coordinator_of(p_scope_id)) then
      raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe'
        using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'commission' and p_role in ('staff', 'staff_admin') then
    -- addStaff / commission_members write policies: staff_admin manages ONLY 'staff'
    -- rows; org/hospital admin (is_commission_admin_of) manages ALL roles. A staff_admin
    -- CANNOT grant staff_admin (the role-pin — staff self-escalation stays 42501, D3).
    if p_role = 'staff' then
      if not (app.is_admin() or app.is_staff_admin_of(p_scope_id) or app.is_commission_admin_of(p_scope_id)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else  -- staff_admin: is_admin OR commission-admin (NOT a plain staff_admin — no self-escalation).
          -- Mirrors commission_members_admin_all (is_admin() OR is_commission_admin_of).
      if not (app.is_admin() or app.is_commission_admin_of(p_scope_id)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;

  else
    raise exception 'combinação de escopo e função inválida' using errcode = 'HC0G0';
  end if;

  -- Self-grant denied on EVERY path (WS-1 helper, verbatim; stays 42501).
  perform app._deny_self_grant(p_user);

  -- title_id is legal only on the commission shape (defensive; CHECK also enforces).
  if p_title_id is not null and p_scope_type <> 'commission' then
    raise exception 'escopo da função inválido' using errcode = 'HC0G2';
  end if;

  -- Shape-coherent insert. Map (scope_type, scope_id) to the right columns; the
  -- hospital tier also fills organization_id (v_org resolved above) for the audit
  -- chain + org rollups. on conflict do nothing → idempotent grant.
  insert into public.memberships (
    principal_id, organization_id, hospital_id, commission_id, role, title_id, granted_by
  ) values (
    p_user,
    case when p_scope_type = 'organization' then p_scope_id else v_org end,
    case when p_scope_type = 'hospital'     then p_scope_id else null  end,
    case when p_scope_type = 'commission'   then p_scope_id else null  end,
    p_role,
    case when p_scope_type = 'commission'   then p_title_id else null  end,
    (select auth.uid())
  )
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;
  -- Audit row emitted by trg_audit_memberships (MEM-5).
end;
$$;

-- ----------------------------------------------------------------------------
-- revoke_role — same authority arms; HC0G1 anti-lockout on the last org_admin.
-- ----------------------------------------------------------------------------
create or replace function public.revoke_role(
  p_scope_type text,
  p_scope_id   uuid,
  p_role       text,
  p_user       uuid
) returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org      uuid;
  v_hospital uuid;
  v_count    integer;
begin
  -- Authority (identical arms to grant_role; no self-grant/self-escalation checks on
  -- revoke — revoking is not a self-grant).
  if p_scope_type = 'organization' and p_role in ('org_admin', 'nsp_org_admin') then
    if p_role = 'org_admin' then
      if not (app.is_admin() or app.is_org_admin_of(p_scope_id)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else
      if not app.is_org_admin_of(p_scope_id) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;
    v_org := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'hospital_admin' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_org_admin_of(v_org) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'nsp_coordinator' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_nsp_org_admin_of(v_org) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'pqs_member' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not (app.is_nsp_org_admin_of(v_org) or app.is_nsp_coordinator_of(p_scope_id)) then
      raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe'
        using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'commission' and p_role in ('staff', 'staff_admin') then
    -- INTENTIONAL asymmetry vs grant_role (QA m1): the grant arms admit is_admin(),
    -- these revoke arms do NOT. This is a deliberate NARROWING on revoke (the safe
    -- direction) — a platform_admin, which is walled off from all tenant data
    -- (CLAUDE.md §1), has no reason to revoke a commission membership through the door;
    -- the sanctioned removers (removeStaff/removeStaffAdmin) are org-admin-gated in TS.
    -- No live caller exercises an is_admin() revoke, so there is no functional
    -- regression. Kept narrow rather than symmetric to avoid granting platform_admin a
    -- tenant-data write path it does not need.
    if p_role = 'staff' then
      if not (app.is_staff_admin_of(p_scope_id) or app.is_commission_admin_of(p_scope_id)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else
      if not app.is_commission_admin_of(p_scope_id) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;

  else
    raise exception 'combinação de escopo e função inválida' using errcode = 'HC0G0';
  end if;

  -- Anti-lockout (HC0G1, re-homed HC081): never remove the org's LAST org_admin.
  if p_scope_type = 'organization' and p_role = 'org_admin' then
    select count(*) into v_count
    from public.memberships
    where organization_id = p_scope_id and role = 'org_admin';
    if v_count <= 1
       and exists (
         select 1 from public.memberships
         where organization_id = p_scope_id and principal_id = p_user and role = 'org_admin'
       ) then
      raise exception 'não é permitido remover o último administrador da organização'
        using errcode = 'HC0G1';
    end if;
  end if;

  -- Shape-coherent delete of the exact-scope row.
  delete from public.memberships
  where principal_id = p_user
    and role = p_role
    and organization_id is not distinct from (case when p_scope_type = 'organization' then p_scope_id else v_org end)
    and hospital_id     is not distinct from (case when p_scope_type = 'hospital'     then p_scope_id else null  end)
    and commission_id   is not distinct from (case when p_scope_type = 'commission'   then p_scope_id else null  end);
  -- Audit row emitted by trg_audit_memberships (MEM-5).
end;
$$;

revoke all on function public.grant_role(text, uuid, text, uuid, uuid) from public;
revoke all on function public.revoke_role(text, uuid, text, uuid)      from public;
grant execute on function public.grant_role(text, uuid, text, uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_role(text, uuid, text, uuid)      to authenticated, service_role;

-- ============================================================================
-- Appointment-RPC shims — thin wrappers over the door, EXACT incumbent signatures
-- preserved so callers + pgTAP fixtures don't churn. Authority now lives in the
-- door (the shim just maps scope → grant_role/revoke_role).
-- ============================================================================

create or replace function public.assign_org_admin(p_org uuid, p_user uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.grant_role('organization', p_org, 'org_admin', p_user);
$$;
create or replace function public.revoke_org_admin(p_org uuid, p_user uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.revoke_role('organization', p_org, 'org_admin', p_user);
$$;

create or replace function public.assign_hospital_admin(p_hospital uuid, p_user uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.grant_role('hospital', p_hospital, 'hospital_admin', p_user);
$$;
create or replace function public.revoke_hospital_admin(p_hospital uuid, p_user uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.revoke_role('hospital', p_hospital, 'hospital_admin', p_user);
$$;

create or replace function public.assign_nsp_org_admin(p_org uuid, p_user uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.grant_role('organization', p_org, 'nsp_org_admin', p_user);
$$;
create or replace function public.revoke_nsp_org_admin(p_org uuid, p_user uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.revoke_role('organization', p_org, 'nsp_org_admin', p_user);
$$;

create or replace function public.assign_nsp_coordinator(p_hospital uuid, p_user uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.grant_role('hospital', p_hospital, 'nsp_coordinator', p_user);
$$;
create or replace function public.revoke_nsp_coordinator(p_hospital uuid, p_user uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.revoke_role('hospital', p_hospital, 'nsp_coordinator', p_user);
$$;

-- add_pqs_member: incumbent RETURNS pqs_members (a table being dropped). O-5: no TS
-- caller reads the return (verified). Change to RETURNS void; the two pgTAP sites
-- that did `select * from add_pqs_member(...)` are updated in MEM-5 fixtures to
-- assert enrollment via has_role instead. DROP first — return-type change.
drop function if exists public.add_pqs_member(uuid, uuid);
create or replace function public.add_pqs_member(p_hospital_id uuid, p_user_id uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.grant_role('hospital', p_hospital_id, 'pqs_member', p_user_id);
$$;
create or replace function public.remove_pqs_member(p_hospital_id uuid, p_user_id uuid)
returns void language sql security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select public.revoke_role('hospital', p_hospital_id, 'pqs_member', p_user_id);
$$;

-- t19 re-issue on every recreated shim (DROP+recreate resets grants).
revoke all on function public.assign_org_admin(uuid, uuid)        from public;
revoke all on function public.revoke_org_admin(uuid, uuid)        from public;
revoke all on function public.assign_hospital_admin(uuid, uuid)   from public;
revoke all on function public.revoke_hospital_admin(uuid, uuid)   from public;
revoke all on function public.assign_nsp_org_admin(uuid, uuid)    from public;
revoke all on function public.revoke_nsp_org_admin(uuid, uuid)    from public;
revoke all on function public.assign_nsp_coordinator(uuid, uuid)  from public;
revoke all on function public.revoke_nsp_coordinator(uuid, uuid)  from public;
revoke all on function public.add_pqs_member(uuid, uuid)          from public;
revoke all on function public.remove_pqs_member(uuid, uuid)       from public;
grant execute on function public.assign_org_admin(uuid, uuid)       to authenticated, service_role;
grant execute on function public.revoke_org_admin(uuid, uuid)       to authenticated, service_role;
grant execute on function public.assign_hospital_admin(uuid, uuid)  to authenticated, service_role;
grant execute on function public.revoke_hospital_admin(uuid, uuid)  to authenticated, service_role;
grant execute on function public.assign_nsp_org_admin(uuid, uuid)   to authenticated, service_role;
grant execute on function public.revoke_nsp_org_admin(uuid, uuid)   to authenticated, service_role;
grant execute on function public.assign_nsp_coordinator(uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_nsp_coordinator(uuid, uuid) to authenticated, service_role;
grant execute on function public.add_pqs_member(uuid, uuid)         to authenticated, service_role;
grant execute on function public.remove_pqs_member(uuid, uuid)      to authenticated, service_role;
