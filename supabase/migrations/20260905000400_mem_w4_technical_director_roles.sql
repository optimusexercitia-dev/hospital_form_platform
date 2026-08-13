-- W4 (ADR 0094, decisions 7 + 8) — Diretor Técnico: the two roles and their appointment.
--
-- Every Brazilian hospital has a **Diretor Técnico** — an elected physician who is
-- technically responsible for all of the hospital's committees. This migration admits
-- the role to the membership vocabulary with its legal invariants; the referral-plane
-- submission channel (decisions 9-10) is a separate migration.
--
-- The DT is the FIRST CONSUMER of ADR 0094's extensibility posture (decision 6), and
-- it exercises it exactly as intended:
--   * the roles are ordinary `memberships` rows — no new table, no new grant plane;
--   * they inherit W3's kernel, so their authority arms are written ONCE and are
--     reached identically from the session door and the service door;
--   * they surface in `public.session_context()` with NO change to that function,
--     because W2 made it generic over roles;
--   * `supabase/tests/292` §3's completeness grid REDS the moment they are added to
--     `memberships_role_check` and stays red until each has a declared scope, a grant
--     arm and a revoke arm. The checklist is executable, and this migration is what
--     satisfies it.
--
-- ⚠ FLAG-DARK ON PURPOSE. `technical_director` ships DISABLED here; the enable
-- migration is the LAST step of W4 (T4.9), once the referral plane is in place. A
-- dark flag must confer NOTHING — the grant arms below refuse while it is off, so
-- the roles cannot be handed out before the feature they exist for is complete.

-- ── The flag ───────────────────────────────────────────────────────────────────
insert into app.feature_flags (key, enabled, description)
values ('technical_director', false,
        'Diretor Técnico (ADR 0094): hospital-tier technical_director / technical_director_deputy roles and the DT referral target.')
on conflict (key) do nothing;

create or replace function app.assert_technical_director_enabled()
returns void
language plpgsql
stable
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if not app.feature_enabled('technical_director') then
    raise exception 'a direção técnica não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$function$;

-- ── T4.1 — the vocabulary + the scope shape ───────────────────────────────────
--
-- Hospital tier: organization_id AND hospital_id set, commission_id NULL. The DT is
-- responsible for the hospital, not for any one committee — which is precisely why
-- the role must NOT be commission-scoped: a commission-scoped DT would inherit
-- committee content reach, and decision 9 is explicit that the DT gains no standing
-- access to committee or QPS content.
alter table public.memberships drop constraint memberships_role_check;
alter table public.memberships add constraint memberships_role_check
  check (role = any (array[
    'org_admin'::text,
    'nsp_org_admin'::text,
    'hospital_admin'::text,
    'nsp_coordinator'::text,
    'staff_admin'::text,
    'staff'::text,
    'pqs_member'::text,
    'technical_director'::text,
    'technical_director_deputy'::text
  ]));

-- The scope-shape CHECK is re-stated in full (it is a CASE, not a list). Keeping the
-- `else false` terminator is load-bearing: a role admitted to the vocabulary but
-- missing a shape arm is rejected outright rather than silently unconstrained. It is
-- also what makes the W1 composite FKs' MATCH SIMPLE sound (see 20260905000100).
alter table public.memberships drop constraint memberships_scope_shape;
alter table public.memberships add constraint memberships_scope_shape
  check (
    case role
      when 'org_admin'      then ((organization_id is not null) and (hospital_id is null) and (commission_id is null))
      when 'nsp_org_admin'  then ((organization_id is not null) and (hospital_id is null) and (commission_id is null))
      when 'hospital_admin' then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'nsp_coordinator' then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'pqs_member'     then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'technical_director'        then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'technical_director_deputy' then ((organization_id is not null) and (hospital_id is not null) and (commission_id is null))
      when 'staff_admin'    then ((commission_id is not null) and (organization_id is null) and (hospital_id is null))
      when 'staff'          then ((commission_id is not null) and (organization_id is null) and (hospital_id is null))
      else false
    end
  );

-- EXACTLY ONE TITULAR PER HOSPITAL (decision 7). Deputies are unbounded, so the index
-- is partial on the titular role. This is the legal invariant, so it is enforced by
-- the database rather than only by the door — a door-only rule is bypassable by any
-- future service-role writer, and W3's whole lesson is that such writers appear.
create unique index memberships_one_technical_director_uq
  on public.memberships (hospital_id)
  where role = 'technical_director';

comment on index public.memberships_one_technical_director_uq is
  'ADR 0094 W4/T4.1 — a hospital has exactly ONE Diretor Técnico (titular). Deputies (technical_director_deputy) are unbounded and deliberately outside this index.';

-- ── T4.2 — the kernel arms ────────────────────────────────────────────────────
--
-- Added to the W3 kernel, so the session door and the service door inherit them
-- together and cannot drift. Body is otherwise byte-identical to 20260905000300.
--
-- AUTHORITY (decision 8, PO-confirmed 2026-08-04): `org_admin` of the hospital's org
-- OR `hospital_admin` of that hospital. ⛔ `platform_admin` is deliberately ABSENT —
-- the PO ruled that appointing a Diretor Técnico is a tenant governance act with legal
-- weight, not a tenancy-administration act, so the noun rule's tenancy arm does NOT
-- reach it. Note this is the ONLY grant arm in the kernel with no `is_admin_for`
-- branch; that asymmetry is intentional and pgTAP asserts it.
create or replace function app.grant_role_impl(
  p_actor uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_role text,
  p_user uuid,
  p_title_id uuid default null::uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org      uuid;
  v_hospital uuid;
  v_existing_id   uuid;
  v_existing_role text;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if p_scope_type = 'organization' and p_role in ('org_admin', 'nsp_org_admin') then
    if p_role = 'org_admin' then
      if not (app.is_admin_for(p_actor) or app.is_org_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else  -- nsp_org_admin
      if not app.is_org_admin_of_for(p_scope_id, p_actor) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;
    v_org := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'hospital_admin' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_org_admin_of_for(v_org, p_actor) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'nsp_coordinator' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_nsp_org_admin_of_for(v_org, p_actor) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'pqs_member' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not (app.is_nsp_org_admin_of_for(v_org, p_actor)
            or app.is_nsp_coordinator_of_for(p_scope_id, p_actor)) then
      raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe'
        using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  -- ┌─ ADR 0094 W4/T4.2 — DIRETOR TÉCNICO ──────────────────────────────────────┐
  elsif p_scope_type = 'hospital'
        and p_role in ('technical_director', 'technical_director_deputy') then
    -- A dark flag confers NOTHING: refuse before any authority is even considered.
    perform app.assert_technical_director_enabled();

    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;

    -- NO is_admin_for arm — see the header. Tenant governance only.
    if not (app.is_org_admin_of_for(v_org, p_actor)
            or app.is_hospital_admin_of_for(p_scope_id, p_actor)) then
      raise exception 'apenas o administrador da organização ou do hospital pode designar a direção técnica'
        using errcode = '42501';
    end if;

    -- PHYSICIAN REQUIREMENT (decision 8). Resolved against the professional-category
    -- VALUE (`key = 'physician'`), never a label — labels are pt-BR display text and
    -- an administrator can rename them; `key` is the stable identity. `is_active`
    -- guards a retired category.
    if not exists (
      select 1
      from public.profiles pr
      join public.professional_categories pc on pc.id = pr.professional_category_id
      where pr.id = p_user
        and pc.key = 'physician'
        and pc.is_active
    ) then
      raise exception 'o diretor técnico deve ser um profissional médico'
        using errcode = 'HC0G3';
    end if;

    -- ONE TITULAR PER HOSPITAL. Refused at the door with a dedicated code so the UI
    -- can offer the replacement flow (public.appoint_technical_director) instead of
    -- surfacing a raw 23505 from memberships_one_technical_director_uq. The index
    -- remains the real guarantee; this is the readable error in front of it.
    if p_role = 'technical_director'
       and exists (
         select 1 from public.memberships m
         where m.hospital_id = p_scope_id
           and m.role = 'technical_director'
           and m.principal_id is distinct from p_user
       ) then
      raise exception 'este hospital já possui um diretor técnico titular'
        using errcode = 'HC0G4';
    end if;

    v_hospital := p_scope_id;
  -- └───────────────────────────────────────────────────────────────────────────┘

  elsif p_scope_type = 'commission' and p_role in ('staff', 'staff_admin') then
    if p_role = 'staff' then
      if not (app.is_admin_for(p_actor)
              or app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_commission_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else
      if not (app.is_admin_for(p_actor)
              or app.is_commission_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;

  else
    raise exception 'combinação de escopo e função inválida' using errcode = 'HC0G0';
  end if;

  -- Self-grant denied on EVERY path (inlined — app._deny_self_grant reads auth.uid()
  -- and would be a silent no-op on the service path).
  if p_user = p_actor then
    raise exception 'não é permitido conceder acesso a si mesmo' using errcode = '42501';
  end if;

  if p_title_id is not null and p_scope_type <> 'commission' then
    raise exception 'escopo da função inválido' using errcode = 'HC0G2';
  end if;

  -- W1/T1.0 — atomic role replacement (commission tier only).
  if p_scope_type = 'commission' then
    select id, role into v_existing_id, v_existing_role
    from public.memberships
    where principal_id = p_user and commission_id = p_scope_id;

    if found and v_existing_role is distinct from p_role then
      if v_existing_role = 'staff_admin'
         and not (app.is_admin_for(p_actor)
                  or app.is_commission_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão para alterar a função de um administrador da comissão'
          using errcode = '42501';
      end if;

      update public.memberships
         set role       = p_role,
             title_id   = coalesce(p_title_id, title_id),
             granted_by = p_actor,
             granted_at = now()
       where id = v_existing_id;
      return;
    end if;
  end if;

  insert into public.memberships (
    principal_id, organization_id, hospital_id, commission_id, role, title_id, granted_by
  ) values (
    p_user,
    case when p_scope_type = 'organization' then p_scope_id else v_org end,
    case when p_scope_type = 'hospital'     then p_scope_id else null  end,
    case when p_scope_type = 'commission'   then p_scope_id else null  end,
    p_role,
    case when p_scope_type = 'commission'   then p_title_id else null  end,
    p_actor
  )
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;
end;
$function$;

-- Revoke arm. NO physician check and NO titular-uniqueness check: both are
-- preconditions for HOLDING the role, and re-checking them on the way out would make
-- a DT unremovable if their professional category were ever corrected or retired —
-- a guard that locks in the very state it exists to control. The flag check is also
-- deliberately ABSENT here: turning the feature off must never strand an existing
-- appointment beyond the reach of the administrators who granted it.
create or replace function app.revoke_role_impl(
  p_actor uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_role text,
  p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org      uuid;
  v_hospital uuid;
  v_count    integer;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if p_scope_type = 'organization' and p_role in ('org_admin', 'nsp_org_admin') then
    if p_role = 'org_admin' then
      if not (app.is_admin_for(p_actor) or app.is_org_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else
      if not app.is_org_admin_of_for(p_scope_id, p_actor) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;
    v_org := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'hospital_admin' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_org_admin_of_for(v_org, p_actor) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'nsp_coordinator' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not app.is_nsp_org_admin_of_for(v_org, p_actor) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital' and p_role = 'pqs_member' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not (app.is_nsp_org_admin_of_for(v_org, p_actor)
            or app.is_nsp_coordinator_of_for(p_scope_id, p_actor)) then
      raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe'
        using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'hospital'
        and p_role in ('technical_director', 'technical_director_deputy') then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not (app.is_org_admin_of_for(v_org, p_actor)
            or app.is_hospital_admin_of_for(p_scope_id, p_actor)) then
      raise exception 'apenas o administrador da organização ou do hospital pode designar a direção técnica'
        using errcode = '42501';
    end if;
    v_hospital := p_scope_id;

  elsif p_scope_type = 'commission' and p_role in ('staff', 'staff_admin') then
    -- INTENTIONAL asymmetry vs the grant arms (QA m1): no is_admin() here.
    if p_role = 'staff' then
      if not (app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_commission_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else
      if not app.is_commission_admin_of_for(p_scope_id, p_actor) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    end if;

  else
    raise exception 'combinação de escopo e função inválida' using errcode = 'HC0G0';
  end if;

  -- Anti-lockout (HC0G1): never remove the org's LAST org_admin.
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

  delete from public.memberships
  where principal_id = p_user
    and role = p_role
    and organization_id is not distinct from (case when p_scope_type = 'organization' then p_scope_id else v_org end)
    and hospital_id     is not distinct from (case when p_scope_type = 'hospital'     then p_scope_id else null  end)
    and commission_id   is not distinct from (case when p_scope_type = 'commission'   then p_scope_id else null  end);
end;
$function$;

-- ── T4.3 — atomic audited replacement ─────────────────────────────────────────
--
-- Appointing a titular where one exists is refused by the kernel (HC0G4), because a
-- silent replacement of a legally-designated officer is not something a plain grant
-- should do. Replacement is therefore its own EXPLICIT act, and it is atomic: both
-- the revocation of the incumbent and the grant of the appointee land in one
-- transaction, or neither does. `trg_audit_memberships` emits `membership.revoked`
-- then `membership.granted`, so the trail shows the handover as two attributable
-- events rather than one ambiguous mutation.
--
-- Deputies need no wrapper — they are unbounded, so the plain door suffices.
create or replace function public.appoint_technical_director(
  p_hospital uuid,
  p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_actor     uuid := (select auth.uid());
  v_incumbent uuid;
begin
  -- Authority and every precondition (flag, physician, hospital existence) are the
  -- kernel's; this wrapper adds ONLY the atomic handover. Deliberately NOT re-checked
  -- here: a second copy would be a second place to keep in sync, which is the exact
  -- defect W3 exists to remove.
  select principal_id into v_incumbent
  from public.memberships
  where hospital_id = p_hospital and role = 'technical_director';

  if v_incumbent is not distinct from p_user then
    -- Already the titular: idempotent. Still run the grant so authority, the flag and
    -- the physician requirement are all enforced on this call rather than assumed.
    perform app.grant_role_impl(v_actor, 'hospital', p_hospital, 'technical_director', p_user);
    return;
  end if;

  if v_incumbent is not null then
    perform app.revoke_role_impl(v_actor, 'hospital', p_hospital, 'technical_director', v_incumbent);
  end if;

  perform app.grant_role_impl(v_actor, 'hospital', p_hospital, 'technical_director', p_user);
end;
$function$;

comment on function public.appoint_technical_director(uuid,uuid) is
  'ADR 0094 W4/T4.3 — atomic, audited replacement of a hospital''s Diretor Técnico (revoke incumbent + grant appointee in one transaction). Authority, the technical_director flag and the physician requirement are enforced by the kernel, not duplicated here.';

revoke all on function public.appoint_technical_director(uuid,uuid) from public;
revoke all on function public.appoint_technical_director(uuid,uuid) from anon;
grant execute on function public.appoint_technical_director(uuid,uuid) to authenticated;
