-- =============================================================================
-- Phase A · A4 — Appointment RPCs + committee-title CRUD (ADR 0051 Decision 4 & 6)
-- =============================================================================
-- Appointment chain: org_admin (ONLY) grants/revokes hospital_admin +
-- nsp_org_admin, no self-delegation (appointer <> holder). A hospital_admin then
-- manages everything INSIDE its hospital via the A2-swapped commission-scoped
-- policies (create/rename commissions is the two-arm `commissions` policy; invite
-- users / assign staff is the swapped commission_members policies) — no new RLS
-- needed here beyond the RPCs below.
--
-- All appointment RPCs are SECURITY DEFINER (they write organization_members,
-- which the caller's own RLS would allow only via organization_members_write =
-- org_admin; DEFINER + an explicit in-body is_org_admin_of gate keeps the control
-- in one place and lets us enforce the no-self-delegation rule crisply).
-- =============================================================================

-- Helper: the org that owns a hospital (single-hop), for the hospital-scoped
-- appointment RPCs' authz. STABLE, DEFINER, search_path pinned.
create or replace function app.org_of_hospital(p_hospital_id uuid)
  returns uuid language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select organization_id from public.hospitals where id = p_hospital_id;
$$;
alter function app.org_of_hospital(uuid) owner to postgres;
comment on function app.org_of_hospital(uuid) is
  'The organization that owns a hospital (single-hop), for hospital-scoped authz (ADR 0051).';

-- ---------------------------------------------------------------------------
-- hospital_admin appointment
-- ---------------------------------------------------------------------------
create or replace function public.assign_hospital_admin(p_hospital uuid, p_user uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
begin
  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;
  -- Only an org_admin of the hospital's org may appoint.
  if not app.is_org_admin_of(v_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- No self-delegation: the appointer may not appoint themselves.
  if p_user = auth.uid() then
    raise exception 'não é permitido nomear a si mesmo' using errcode = '42501';
  end if;

  -- Idempotent on the (org, user, 'hospital_admin', hospital) identity.
  insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values (v_org, p_user, 'hospital_admin', p_hospital)
  on conflict (organization_id, user_id, role, hospital_id) do nothing;
  -- The hospital-tier audit row is emitted by the A3 trg_audit_hospital_admin_grant
  -- INSERT trigger.
end;
$$;
alter function public.assign_hospital_admin(uuid, uuid) owner to postgres;

create or replace function public.revoke_hospital_admin(p_hospital uuid, p_user uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
begin
  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;
  if not app.is_org_admin_of(v_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.organization_members
  where organization_id = v_org and user_id = p_user
    and role = 'hospital_admin' and hospital_id = p_hospital;
  -- Hospital-tier audit emitted by the A3 DELETE trigger.
end;
$$;
alter function public.revoke_hospital_admin(uuid, uuid) owner to postgres;

-- ---------------------------------------------------------------------------
-- nsp_org_admin appointment (INERT in Phase A — the row exists; behavior in B)
-- ---------------------------------------------------------------------------
create or replace function public.assign_nsp_org_admin(p_org uuid, p_user uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.is_org_admin_of(p_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'não é permitido nomear a si mesmo' using errcode = '42501';
  end if;

  insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values (p_org, p_user, 'nsp_org_admin', null)
  on conflict (organization_id, user_id, role, hospital_id) do nothing;
end;
$$;
alter function public.assign_nsp_org_admin(uuid, uuid) owner to postgres;

create or replace function public.revoke_nsp_org_admin(p_org uuid, p_user uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.is_org_admin_of(p_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.organization_members
  where organization_id = p_org and user_id = p_user
    and role = 'nsp_org_admin' and hospital_id is null;
end;
$$;
alter function public.revoke_nsp_org_admin(uuid, uuid) owner to postgres;

-- Grants for the appointment RPCs.
revoke all on function public.assign_hospital_admin(uuid, uuid) from public;
revoke all on function public.revoke_hospital_admin(uuid, uuid) from public;
revoke all on function public.assign_nsp_org_admin(uuid, uuid) from public;
revoke all on function public.revoke_nsp_org_admin(uuid, uuid) from public;
grant execute on function public.assign_hospital_admin(uuid, uuid) to authenticated;
grant execute on function public.revoke_hospital_admin(uuid, uuid) to authenticated;
grant execute on function public.assign_nsp_org_admin(uuid, uuid) to authenticated;
grant execute on function public.revoke_nsp_org_admin(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Committee-title CRUD (ADR 0051 Decision 6) — staff_admin OR commission_admin.
-- Non-DEFINER RPCs (RLS + the in-body gate is the authority, like meeting_types).
-- DISPLAY-ONLY: none of these touch access.
-- ---------------------------------------------------------------------------
create or replace function public.create_member_title(p_commission_id uuid, p_name text)
  returns public.commission_member_titles language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_position integer;
  v_result public.commission_member_titles;
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome do título' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.commission_member_titles where commission_id = p_commission_id;

  insert into public.commission_member_titles (commission_id, name, position)
  values (p_commission_id, btrim(p_name), v_position)
  returning * into v_result;
  return v_result;
end;
$$;
alter function public.create_member_title(uuid, text) owner to postgres;

create or replace function public.rename_member_title(p_title_id uuid, p_name text)
  returns public.commission_member_titles language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
  v_result public.commission_member_titles;
begin
  select commission_id into v_commission
  from public.commission_member_titles where id = p_title_id;
  if v_commission is null then
    raise exception 'título inexistente' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome do título' using errcode = 'check_violation';
  end if;

  update public.commission_member_titles
  set name = btrim(p_name), updated_at = now()
  where id = p_title_id
  returning * into v_result;
  return v_result;
end;
$$;
alter function public.rename_member_title(uuid, text) owner to postgres;

create or replace function public.reorder_member_titles(p_commission_id uuid, p_ordered_ids uuid[])
  returns void language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- DEFERRABLE unique(commission_id, position) lets the whole shuffle commit atomically.
  update public.commission_member_titles d
  set position = o.ord, updated_at = now()
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;
alter function public.reorder_member_titles(uuid, uuid[]) owner to postgres;

create or replace function public.delete_member_title(p_title_id uuid)
  returns void language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission
  from public.commission_member_titles where id = p_title_id;
  if v_commission is null then
    return;  -- idempotent: already gone
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- ON DELETE SET NULL clears any member's title_id automatically.
  delete from public.commission_member_titles where id = p_title_id;
end;
$$;
alter function public.delete_member_title(uuid) owner to postgres;

-- Assign / clear a member's title. Gated on the member's commission; the same-
-- commission integrity trigger (A1) rejects a cross-commission title_id.
create or replace function public.assign_member_title(p_member_id uuid, p_title_id uuid)
  returns void language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission
  from public.commission_members where id = p_member_id;
  if v_commission is null then
    raise exception 'membro inexistente' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.commission_members set title_id = p_title_id where id = p_member_id;
end;
$$;
alter function public.assign_member_title(uuid, uuid) owner to postgres;

revoke all on function public.create_member_title(uuid, text) from public;
revoke all on function public.rename_member_title(uuid, text) from public;
revoke all on function public.reorder_member_titles(uuid, uuid[]) from public;
revoke all on function public.delete_member_title(uuid) from public;
revoke all on function public.assign_member_title(uuid, uuid) from public;
grant execute on function public.create_member_title(uuid, text) to authenticated;
grant execute on function public.rename_member_title(uuid, text) to authenticated;
grant execute on function public.reorder_member_titles(uuid, uuid[]) to authenticated;
grant execute on function public.delete_member_title(uuid) to authenticated;
grant execute on function public.assign_member_title(uuid, uuid) to authenticated;
