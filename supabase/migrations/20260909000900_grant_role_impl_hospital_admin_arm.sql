-- AFF W2 / T2.5 — `grant_role_impl`: the `hospital_admin` branch gains `is_admin_for`.
--
-- ADR 0097 D17 + the external audit's BLOCKER-1. Verified live before and after: the
-- branch required `app.is_org_admin_of_for(v_org, p_actor)` and NOTHING else, so the
-- provisioning platform admin was denied 42501 and W3/T3.4 (single-hospital tenant
-- provisioning) had no working path through the door at all. The ADR's own finding 8
-- recorded the missing arm; D17 then forgot it, having probed only the self-grant
-- hazard.
--
-- HOW THIS MIGRATION IS BUILT, because it matters more than what it changes:
--   * the body below was regenerated from LIVE `pg_get_functiondef` at build time and
--     rewritten programmatically with a single anchored replacement asserted to match
--     EXACTLY ONCE — this function has been patched at runtime before, so migration
--     text is stale by design (ADR 0078 A28), and hand-transcribing 179 lines is how a
--     rewrite silently reverts an intervening patch;
--   * `CREATE OR REPLACE`, never `DROP`+`CREATE`: a rebuild is a PRIVILEGE RESET, and
--     this kernel's ACL (`{postgres=X}` — callable by its owner alone) is what makes
--     `p_actor` unforgeable;
--   * the parameter list is unchanged (a parameter rename is also a privilege reset);
--   * exactly ONE authority line differs. The anchor deliberately spans through the
--     following `elsif`, because the `technical_director` branch contains a nearly
--     identical line that must NOT be touched — pgTAP `302` keystones that it wasn't.
--
-- This changes a `prosecdef` boolean gate, so it is in scope for the diff-scoped
-- `ARM=policy` door run (Phase Gate step 1).

CREATE OR REPLACE FUNCTION app.grant_role_impl(p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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
