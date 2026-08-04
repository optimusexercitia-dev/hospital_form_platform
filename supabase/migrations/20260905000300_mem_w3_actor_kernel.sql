-- W3 / Package B (ADR 0094, decision 4) — one real mutation door.
--
-- ADR 0075 documented a deliberate split: RLS-scoped paths call the `grant_role` /
-- `revoke_role` doors, while service-role paths write `memberships` directly, because
-- the doors resolve authority from `auth.uid()` and the admin client has none. The
-- internal analysis found the consequence: `grant_role` had **zero TypeScript
-- callers**. Every commission-tier grant in the product was raw service-role DML, and
-- the door's carefully-built authority arms — the role-pin, the self-grant denial, the
-- anti-lockout — governed nothing a user could actually reach.
--
-- The split existed because the door's authority was tied to the SESSION. Untie it:
-- the body moves to a kernel taking the actor as a PARAMETER, and two thin wrappers
-- supply that actor from the two places it can legitimately come from —
-- `auth.uid()` for cookie-authenticated callers, an explicit argument for
-- service-role callers that authorized the actor in TypeScript.
--
--   public.grant_role(...)          -> app.grant_role_impl(auth.uid(), ...)
--   public.grant_role_for(actor,...)-> app.grant_role_impl(actor, ...)   [service_role]
--
-- Authority is re-derived from the LIVE DATABASE for the actor either way. The
-- service door does NOT trust its caller's claim about what the actor may do — it
-- only trusts the claim about WHO the actor is, which is exactly the trust a
-- service-role key already implies.
--
-- ⚠ TWO BEHAVIOUR CHANGES ON THE SERVICE PATH, both narrowings, both intended:
--   1. self-grant denial now binds service-role callers (raw DML never checked it);
--   2. the org anti-lockout (HC0G1, "never remove the org's last org_admin") now
--      binds them too. Previously a service-role delete could empty an organization
--      of its administrators. The plan flags this as a behaviour improvement to call
--      out rather than a silent fix.
--
-- The kernel is a MECHANISM SWAP, not a semantic one: every authority predicate has
-- an actor-parameterized `_for` sibling already in the catalog, so each arm is
-- rewritten by substitution and nothing else moves.
--   app.is_admin()                 -> app.is_admin_for(p_actor)
--   app.is_org_admin_of(x)         -> app.is_org_admin_of_for(x, p_actor)
--   app.is_nsp_org_admin_of(x)     -> app.is_nsp_org_admin_of_for(x, p_actor)
--   app.is_nsp_coordinator_of(x)   -> app.is_nsp_coordinator_of_for(x, p_actor)
--   app.is_staff_admin_of(x)       -> app.is_staff_admin_of_for(x, p_actor)
--   app.is_commission_admin_of(x)  -> app.is_commission_admin_of_for(x, p_actor)
--   app._deny_self_grant(u)        -> inlined (its own check reads auth.uid())
--   granted_by = (select auth.uid())-> p_actor
-- supabase/tests/293 walks the full (scope, role, actor) grid through BOTH entry
-- points and asserts identical verdicts, so the swap is proven rather than asserted.

-- ── T3.1a — the grant kernel ───────────────────────────────────────────────────
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

  -- Authority + scope-column resolution, dispatched on (scope_type, role). Each arm
  -- reuses the incumbent RPC's authority check verbatim (no widening).
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

  elsif p_scope_type = 'commission' and p_role in ('staff', 'staff_admin') then
    -- staff_admin manages ONLY 'staff' rows; org/hospital admin manages ALL roles.
    -- A staff_admin CANNOT grant staff_admin (the role-pin — no self-escalation).
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

  -- Self-grant denied on EVERY path. Inlined rather than delegating to
  -- app._deny_self_grant, whose own check reads auth.uid() and would therefore be a
  -- silent no-op on the service path (the actor is a parameter there, not a session).
  if p_user = p_actor then
    raise exception 'não é permitido conceder acesso a si mesmo' using errcode = '42501';
  end if;

  -- title_id is legal only on the commission shape (defensive; CHECK also enforces).
  if p_title_id is not null and p_scope_type <> 'commission' then
    raise exception 'escopo da função inválido' using errcode = 'HC0G2';
  end if;

  -- ADR 0094 W1/T1.0 — atomic role replacement (commission tier only).
  if p_scope_type = 'commission' then
    select id, role into v_existing_id, v_existing_role
    from public.memberships
    where principal_id = p_user and commission_id = p_scope_id;

    if found and v_existing_role is distinct from p_role then
      -- Authority over the OUTGOING role, not just the incoming one.
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

comment on function app.grant_role_impl(uuid,text,uuid,text,uuid,uuid) is
  'ADR 0094 W3/T3.1 — the single grant kernel. Authority is re-derived from the live database for p_actor; both public.grant_role (auth.uid()) and public.grant_role_for (service_role) delegate here so an arm is written once.';

-- ── T3.1b — the revoke kernel ─────────────────────────────────────────────────
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

  elsif p_scope_type = 'commission' and p_role in ('staff', 'staff_admin') then
    -- INTENTIONAL asymmetry vs the grant arms (QA m1): these revoke arms do NOT
    -- admit is_admin(). A deliberate NARROWING on revoke (the safe direction) —
    -- platform_admin has no reason to revoke a commission membership through the
    -- door, and the sanctioned removers are org-admin-gated in TypeScript. Preserved
    -- verbatim through the kernel swap.
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

  -- Anti-lockout (HC0G1): never remove the org's LAST org_admin. Now binding on the
  -- service path too (see the header) — raw DML bypassed it entirely.
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

comment on function app.revoke_role_impl(uuid,text,uuid,text,uuid) is
  'ADR 0094 W3/T3.1 — the single revoke kernel. Both public.revoke_role and public.revoke_role_for delegate here.';

-- ── T3.1c — the incumbent doors become auth.uid() wrappers ────────────────────
-- `create or replace` preserves the existing ACL (authenticated + service_role), and
-- the signatures are unchanged, so generated types and every existing caller are
-- unaffected.
create or replace function public.grant_role(p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid default null::uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.grant_role_impl((select auth.uid()), p_scope_type, p_scope_id, p_role, p_user, p_title_id);
end;
$function$;

create or replace function public.revoke_role(p_scope_type text, p_scope_id uuid, p_role text, p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  perform app.revoke_role_impl((select auth.uid()), p_scope_type, p_scope_id, p_role, p_user);
end;
$function$;

-- ── T3.2 — the service doors ──────────────────────────────────────────────────
-- Identical semantics, actor supplied explicitly. EXECUTE is service_role-only:
-- `authenticated` must NEVER reach these, because holding them would let any signed-in
-- user name an arbitrary actor and inherit that actor's authority — a complete
-- authorization bypass. supabase/tests/293 asserts the ACL directly, and the
-- mutation audit proves that assertion can fail.
create or replace function public.grant_role_for(
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
begin
  perform app.grant_role_impl(p_actor, p_scope_type, p_scope_id, p_role, p_user, p_title_id);
end;
$function$;

create or replace function public.revoke_role_for(
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
begin
  perform app.revoke_role_impl(p_actor, p_scope_type, p_scope_id, p_role, p_user);
end;
$function$;

revoke all on function public.grant_role_for(uuid,text,uuid,text,uuid,uuid) from public;
revoke all on function public.grant_role_for(uuid,text,uuid,text,uuid,uuid) from anon;
revoke all on function public.grant_role_for(uuid,text,uuid,text,uuid,uuid) from authenticated;
grant execute on function public.grant_role_for(uuid,text,uuid,text,uuid,uuid) to service_role;

revoke all on function public.revoke_role_for(uuid,text,uuid,text,uuid) from public;
revoke all on function public.revoke_role_for(uuid,text,uuid,text,uuid) from anon;
revoke all on function public.revoke_role_for(uuid,text,uuid,text,uuid) from authenticated;
grant execute on function public.revoke_role_for(uuid,text,uuid,text,uuid) to service_role;

comment on function public.grant_role_for(uuid,text,uuid,text,uuid,uuid) is
  'ADR 0094 W3/T3.2 — service-role entry to the grant kernel for paths that authorized an actor in TypeScript but hold no auth.uid(). EXECUTE is service_role-only: authenticated access would be a full authorization bypass.';
comment on function public.revoke_role_for(uuid,text,uuid,text,uuid) is
  'ADR 0094 W3/T3.2 — service-role entry to the revoke kernel. EXECUTE is service_role-only.';

-- The kernels are internal; nothing outside app.* may call them directly.
revoke all on function app.grant_role_impl(uuid,text,uuid,text,uuid,uuid) from public;
revoke all on function app.grant_role_impl(uuid,text,uuid,text,uuid,uuid) from anon;
revoke all on function app.grant_role_impl(uuid,text,uuid,text,uuid,uuid) from authenticated;
revoke all on function app.revoke_role_impl(uuid,text,uuid,text,uuid) from public;
revoke all on function app.revoke_role_impl(uuid,text,uuid,text,uuid) from anon;
revoke all on function app.revoke_role_impl(uuid,text,uuid,text,uuid) from authenticated;
