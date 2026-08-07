-- =============================================================================
-- QO·FUP F1 — EXTEND-ON-REGRANT: `p_expires_at` becomes a real setter on BOTH
-- write paths of the grant kernel. Closes FUP-QO-1; PO ruling D-FUP-1.
-- ADR 0102 (amends ADR 0100 D9's expiry seam).
--
-- WHAT CHANGES (two lines of behaviour, one function):
--   1. INSERT path — the targeted `on conflict ... do nothing` becomes
--      `do update set expires_at = coalesce(excluded.expires_at, memberships.expires_at)`.
--      An identical (principal, role, org, hospital, commission) re-grant with a new
--      expiry now EXTENDS (or SHORTENS) the existing row instead of silently no-oping.
--   2. Commission-tier atomic replace — the UPDATE now writes
--      `expires_at = coalesce(p_expires_at, expires_at)`. A role change no longer
--      carries the OLD window forward while ignoring the argument it was handed.
--
-- ⭐ NULL SEMANTICS = LEAVE UNCHANGED, NOT "CLEAR" (the case D-FUP-1 left open;
-- lead-ratified 2026-08-07). The decisive fact is the caller sweep, not symmetry:
-- ALL THREE production callers omit the argument —
--   src/lib/admin/actions.ts:285   (promote to staff_admin — the REPLACE path)
--   src/lib/members/actions.ts:235 (add staff)
--   src/lib/org/actions.ts:618     (appoint technical_director_deputy)
-- Under "NULL clears", every ordinary member-add and promotion would silently strip a
-- deliberately-set expiry: a privilege WIDENING shipped by a change whose entire
-- purpose is to make expiry more controllable. `coalesce` makes the argument monotone
-- in effect — pass a value and it sets (either direction, absolutely, never a
-- ratchet); omit it and nothing moves. "Make this permanent" stays revoke + re-grant
-- (a DELETE + INSERT, both audited). A `p_clear_expiry` flag is deliberately NOT added
-- now: it would be a declared parameter no caller passes, which is its own blind spot.
--
-- ⛔ THE CONFLICT TARGET STAYS TARGETED. `memberships` carries three other unique
-- indexes (`memberships_one_commission_role_uq`,
-- `memberships_one_technical_director_uq`, `memberships_pkey`); a bare
-- `on conflict do update` would absorb any of them and turn a refusal into a silent
-- overwrite. `memberships_grant_uq` is NULLS NOT DISTINCT (catalog-verified), which is
-- what makes the targeted clause fire at all on the scope columns that are NULL.
--
-- ⚠ SECOND FUNCTION, AND WHY IT IS NOT SCOPE CREEP. `app.trg_audit_memberships`'s
-- UPDATE branch is if/ELSIF and `role_changed` WINS over `expiry_changed`. Before this
-- migration that was harmless: the replace path never touched `expires_at`. Change 2
-- makes it write one — so, unamended, the replace would move a security control while
-- the only audit row said "role changed" and carried no expiry diff. Rule 11 does not
-- permit that. The fix is metadata-only: `role_changed` now carries
-- `expires_at_before`/`expires_at_after` WHEN (and only when) the expiry also moved.
-- No new verb, no payload, no PHI — the row count per operation is unchanged.
-- Pinned by pgTAP 306 4.13c; falsifiability by supabase/tests/mutation/f1-expiry-seam-audit.sh.
--
-- 292 §2.1 (the singleton "app.grant_role_impl is the ONLY expires_at writer") SURVIVES
-- unrecut: both new writes are inside that same function. Re-verified post-migration.
--
-- Rebuild posture: `create or replace` on an unchanged signature, so ACL / owner /
-- proconfig / prosecdef / volatility are preserved BY CONSTRUCTION rather than by
-- re-granting (a DROP+CREATE silently loses the ACL). Catalog snapshot taken before:
--   app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz)
--   secdef=true owner=postgres cfg=search_path=app, public, pg_catalog
--   acl=postgres=X/postgres vol=v kind=f lang=plpgsql strict=false rettype=void
-- pgTAP re-asserts every one of those after the change.
-- =============================================================================

create or replace function app.grant_role_impl(
  p_actor uuid,
  p_scope_type text,
  p_scope_id uuid,
  p_role text,
  p_user uuid,
  p_title_id uuid default null::uuid,
  p_expires_at timestamp with time zone default null::timestamp with time zone
)
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
  -- the door (mirrors grant_case_access verbatim). NULL = permanent on a NEW row,
  -- and "leave the existing window alone" on a re-grant (F1 / ADR 0102).
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'a data de expiração deve ser futura' using errcode = 'check_violation';
  end if;

  -- W1/T1.0 — atomic role replacement (commission tier only).
  -- QO·FUP F1 (ADR 0102): this path now WRITES the expiry argument. It used to ignore
  -- it entirely, so a role change carried the old window forward silently — pinned as
  -- a deferred seam limit by pgTAP 306 4.13, now recut to the opposite.
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
             granted_at = now(),
             expires_at = coalesce(p_expires_at, expires_at)
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
  -- QO·FUP F1 (ADR 0102): was `do nothing`. The targeted conflict clause is
  -- deliberately unchanged — widening it would absorb the three OTHER unique indexes
  -- on this table and convert their refusals into silent overwrites. Only `expires_at`
  -- is updated: granted_by / granted_at / title_id keep their original values on an
  -- identical re-grant, so a re-grant is an expiry operation and nothing else.
  on conflict (principal_id, role, organization_id, hospital_id, commission_id)
  do update set expires_at = coalesce(excluded.expires_at, memberships.expires_at);
end;
$function$;

-- -----------------------------------------------------------------------------
-- Rule 11 companion — see the header. `role_changed` wins the if/elsif, so the
-- replace path's NEW expiry write would otherwise leave no trace. Metadata only.
-- -----------------------------------------------------------------------------
create or replace function app.trg_audit_memberships()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row      public.memberships;
  v_action   text;
  v_summary  text;
  v_meta     jsonb;
begin
  if tg_op = 'INSERT' then
    v_row := new;
    v_action := 'membership.granted';
    v_summary := 'Função concedida (' || v_row.role || ')';
  elsif tg_op = 'DELETE' then
    v_row := old;
    v_action := 'membership.revoked';
    v_summary := 'Função revogada (' || v_row.role || ')';
  else  -- UPDATE — only a role change or an expiry change is a meaningful grant
        -- event. A title_id-only update (assign_member_title) is NOT a role change
        -- → no audit row (display-only metadata, unaudited by design).
    if new.role is distinct from old.role then
      v_row := new;
      v_action := 'membership.role_changed';
      v_summary := 'Função alterada: ' || old.role || ' → ' || new.role;
    elsif new.expires_at is distinct from old.expires_at then
      -- ADR 0094 W2/T2.3. Timestamps only — PHI-free, and the metadata below adds
      -- the before/after so the trail is self-contained.
      v_row := new;
      v_action := 'membership.expiry_changed';
      v_summary := case
        when new.expires_at is null then 'Validade da função removida (permanente)'
        when old.expires_at is null then 'Validade da função definida'
        else 'Validade da função alterada'
      end;
    else
      return null;
    end if;
  end if;

  -- PHI-free metadata: role + scope ids + principal only (never a name/title/payload).
  v_meta := jsonb_build_object(
    'role', v_row.role,
    'user_id', v_row.principal_id,
    'organization_id', v_row.organization_id,
    'hospital_id', v_row.hospital_id,
    'commission_id', v_row.commission_id
  );

  -- QO·FUP F1 (ADR 0102). The expiry diff rides on `role_changed` TOO, because the
  -- branch above is an if/ELSIF: the commission-tier atomic replace now changes the
  -- role AND the expiry in one UPDATE, and only `role_changed` is emitted for it.
  -- Without this the security-relevant half of that write had no trace at all.
  -- Guarded on `is distinct from` so a role-only change carries no misleading keys.
  if tg_op = 'UPDATE'
     and v_action in ('membership.expiry_changed', 'membership.role_changed')
     and new.expires_at is distinct from old.expires_at then
    v_meta := v_meta || jsonb_build_object(
      'expires_at_before', old.expires_at,
      'expires_at_after',  new.expires_at
    );
  end if;

  if v_row.commission_id is not null then
    -- commission chain: pass p_commission; audit_write derives org + hospital.
    perform app.audit_write(v_action, 'membership', v_row.id, v_row.commission_id, v_summary, v_meta);
  else
    -- org / hospital chain: pass the explicit chain tuple (commission NULL). For an
    -- org-scope row hospital is NULL → org chain; for a hospital-scope row both set →
    -- hospital chain (matches audit_write's precedence).
    perform app.audit_write(v_action, 'membership', v_row.id, null, v_summary, v_meta,
                            v_row.organization_id, v_row.hospital_id);
  end if;

  return null;
end;
$function$;

comment on function app.grant_role_impl(uuid,text,uuid,text,uuid,uuid,timestamptz) is
  'Grant kernel. QO·FUP F1 / ADR 0102: p_expires_at is a real setter on BOTH write '
  'paths — the targeted ON CONFLICT DO UPDATE and the commission-tier atomic replace. '
  'NULL means LEAVE UNCHANGED on an existing row (every production caller omits the '
  'argument; "clear" would be a silent privilege widening) and PERMANENT on a new one. '
  'The only sanctioned writer of memberships.expires_at — pinned by pgTAP 292 §2.1.';
