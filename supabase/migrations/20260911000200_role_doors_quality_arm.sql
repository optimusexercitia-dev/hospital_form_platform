-- =============================================================================
-- QO·A M3 — the quality_reviewer grant/revoke arms + the `p_expires_at` setter
-- seam (ADR 0100 D9; buildnotes §6c/§6d).
--
-- BODIES RE-EMITTED FROM THE LIVE CATALOG (pg_get_functiondef, 2026-08-06) with
-- only the intended edits — diffed post-apply per the Stage-B discipline.
--
-- ⛔ SIGNATURE CHANGE = ACL RESET. app.grant_role_impl / public.grant_role /
-- public.grant_role_for gain `p_expires_at timestamptz DEFAULT NULL` (appended
-- LAST so every positional SQL caller — appoint_technical_director, the ten
-- assign_*/revoke_* wrappers — and every named-arg PostgREST caller keeps
-- resolving). A new signature is a NEW pg_proc row with DEFAULT PUBLIC EXECUTE,
-- so each function below is DROPped and re-CREATEd with its captured ACL
-- re-established explicitly. revoke_role_impl keeps its signature (no expiry on
-- the revoke path) and is CREATE OR REPLACEd.
--
-- ⚠ NO `assert_*_enabled` FLAG LINE, DELIBERATELY — do not "fix" this. The
-- technical_director arm this one mirrors opens with a feature-flag assert; the
-- quality-oversight program ships FLAG-LESS BY DESIGN (ADR 0100 — no flag is
-- defined), because it already carries two independent deny-by-default gates:
-- no principal holds the role until an admin grants it through this door, and
-- no commission is visible to the arm until opted in from its 'excluded'
-- default (D8, M2). A third switch would guard nothing.
--
-- `p_expires_at` semantics (D9; pinned executably in pgTAP 306, FUP-QO-1):
--   * validated `> now()` at the door (mirrors grant_case_access verbatim);
--   * written on the INSERT path for ALL roles (enforcement is already
--     universal: has_role/has_role_any/session_context filter expires_at);
--   * NOT written by the commission-tier atomic-replace UPDATE, and a re-grant
--     of an identical existing membership hits the TARGETED ON CONFLICT DO
--     NOTHING and does NOT extend an existing expiry — both deferred seam
--     limits, owned by Phase C / D14 (break-glass rides this seam).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. app.grant_role_impl — DROP (6-arg) + CREATE (7-arg).
-- -----------------------------------------------------------------------------
drop function app.grant_role_impl(uuid, text, uuid, text, uuid, uuid);

create function app.grant_role_impl(p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid default null::uuid, p_expires_at timestamptz default null::timestamptz)
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
    -- AFF T2.5 (ADR 0097 D17, external audit BLOCKER-1): the `is_admin_for` arm,
    -- SYMMETRIC with the org_admin branch above. Without it there is NO working path
    -- to seat the first hospital_admin of a single-hospital tenant: the provisioning
    -- platform admin is denied 42501 right here, and the fallback (seat org_admin,
    -- let them self-grant) hits the self-grant guard below, which D17 rightly refuses
    -- to weaken. Sanctioned by the noun rule (ADR 0078 A35 — memberships are
    -- platform_admin's TENANCY arm). The technical_director branch below keeps its
    -- deliberate no-`is_admin_for` posture: direção técnica is tenant GOVERNANCE.
    if not (app.is_admin_for(p_actor) or app.is_org_admin_of_for(v_org, p_actor)) then
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

  -- ┌─ ADR 0100 D1/D9 — QUALITY REVIEWER (Escritório da Qualidade) ─────────────┐
  elsif p_scope_type = 'hospital' and p_role = 'quality_reviewer' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;

    -- The technical_director authority shape, deliberately: org OR hospital
    -- admin, NO is_admin_for arm (noun rule — the role reaches committee
    -- content, which platform_admin may not administer into existence). No
    -- physician / one-titular checks: a quality office seats any number of
    -- reviewers of any profession. No flag assert — see the header (D8 carries
    -- deny-by-default; do not add one).
    if not (app.is_org_admin_of_for(v_org, p_actor)
            or app.is_hospital_admin_of_for(p_scope_id, p_actor)) then
      raise exception 'apenas o administrador da organização ou do hospital pode designar o revisor da qualidade'
        using errcode = '42501';
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

  -- QO·A (ADR 0100 D9): a past expiry is a grant that never lives — refuse it at
  -- the door (mirrors grant_case_access verbatim). NULL = permanent, unchanged.
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'a data de expiração deve ser futura' using errcode = 'check_violation';
  end if;

  -- W1/T1.0 — atomic role replacement (commission tier only).
  -- QO·A: deliberately does NOT touch expires_at (deferred seam limit — see the
  -- header; pinned by pgTAP 306).
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
    principal_id, organization_id, hospital_id, commission_id, role, title_id, granted_by, expires_at
  ) values (
    p_user,
    case when p_scope_type = 'organization' then p_scope_id else v_org end,
    case when p_scope_type = 'hospital'     then p_scope_id else null  end,
    case when p_scope_type = 'commission'   then p_scope_id else null  end,
    p_role,
    case when p_scope_type = 'commission'   then p_title_id else null  end,
    p_actor,
    p_expires_at
  )
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;
end;
$function$;

-- ACL: the kernel is owner-only (captured live: {postgres=X/postgres}).
revoke all on function app.grant_role_impl(uuid, text, uuid, text, uuid, uuid, timestamptz) from public;

-- -----------------------------------------------------------------------------
-- 2. app.revoke_role_impl — same signature, CREATE OR REPLACE (ACL preserved).
--    Only edit: the quality_reviewer arm (TD authority shape; no flag assert).
-- -----------------------------------------------------------------------------
create or replace function app.revoke_role_impl(p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid)
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

  -- ADR 0100 D9 — quality_reviewer: same authority as the grant arm (org OR
  -- hospital admin, no is_admin_for). No flag assert, no anti-lockout: a
  -- hospital with zero reviewers is a valid (deny-by-default) state.
  elsif p_scope_type = 'hospital' and p_role = 'quality_reviewer' then
    v_org := app.org_of_hospital(p_scope_id);
    if v_org is null then
      raise exception 'hospital inexistente' using errcode = 'check_violation';
    end if;
    if not (app.is_org_admin_of_for(v_org, p_actor)
            or app.is_hospital_admin_of_for(p_scope_id, p_actor)) then
      raise exception 'apenas o administrador da organização ou do hospital pode designar o revisor da qualidade'
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

-- -----------------------------------------------------------------------------
-- 3. public.grant_role — DROP (5-arg) + CREATE (6-arg) + captured ACL.
-- -----------------------------------------------------------------------------
drop function public.grant_role(text, uuid, text, uuid, uuid);

create function public.grant_role(p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid default null::uuid, p_expires_at timestamptz default null::timestamptz)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.grant_role_impl((select auth.uid()), p_scope_type, p_scope_id, p_role, p_user, p_title_id, p_expires_at);
end;
$function$;

revoke all on function public.grant_role(text, uuid, text, uuid, uuid, timestamptz) from public;
grant execute on function public.grant_role(text, uuid, text, uuid, uuid, timestamptz) to service_role;
grant execute on function public.grant_role(text, uuid, text, uuid, uuid, timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. public.grant_role_for — DROP (6-arg) + CREATE (7-arg) + captured ACL.
--    ⛔ service_role ONLY — an authenticated EXECUTE here is a total
--    authorization bypass (pgTAP 293 §1.1 pins it).
-- -----------------------------------------------------------------------------
drop function public.grant_role_for(uuid, text, uuid, text, uuid, uuid);

create function public.grant_role_for(p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid default null::uuid, p_expires_at timestamptz default null::timestamptz)
 returns void
 language plpgsql
 security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.grant_role_impl(p_actor, p_scope_type, p_scope_id, p_role, p_user, p_title_id, p_expires_at);
end;
$function$;

revoke all on function public.grant_role_for(uuid, text, uuid, text, uuid, uuid, timestamptz) from public;
grant execute on function public.grant_role_for(uuid, text, uuid, text, uuid, uuid, timestamptz) to service_role;

-- -----------------------------------------------------------------------------
-- 5. Self-checks: exactly ONE overload of each re-signatured function survives
--    (a leftover old overload = PostgREST ambiguity + an unguarded twin), and
--    the ACL discipline held.
-- -----------------------------------------------------------------------------
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'grant_role_impl') <> 1
  or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'grant_role') <> 1
  or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'grant_role_for') <> 1 then
    raise exception 'M3 postcondition: an old overload survived the re-signature';
  end if;

  if has_function_privilege('authenticated', 'public.grant_role_for(uuid,text,uuid,text,uuid,uuid,timestamptz)', 'EXECUTE') then
    raise exception 'M3 postcondition: grant_role_for leaked EXECUTE to authenticated';
  end if;
  if has_function_privilege('authenticated', 'app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)', 'EXECUTE') then
    raise exception 'M3 postcondition: grant_role_impl leaked EXECUTE to authenticated';
  end if;
  if not has_function_privilege('authenticated', 'public.grant_role(text,uuid,text,uuid,uuid,timestamptz)', 'EXECUTE') then
    raise exception 'M3 postcondition: the session door lost authenticated EXECUTE';
  end if;
end $$;
