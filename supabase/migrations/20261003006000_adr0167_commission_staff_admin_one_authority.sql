-- ADR 0167 — commission `staff_admin` has ONE authority, on both sides.
--
-- `app.is_tenancy_admin_of_for` becomes the SINGLE authority for the commission
-- `staff_admin` role on the GRANT side as well as the REVOKE side, by dropping
-- `app.is_admin_for(p_actor)` from the TWO sites in `app.grant_role_impl` that
-- gate it:
--   (a) the `p_role = 'staff_admin'` sub-arm of the commission branch, and
--   (b) the T1.0 atomic-replacement branch's OUTGOING-role guard
--       (`v_existing_role = 'staff_admin'`), which decides who may change the
--       role of an EXISTING coordinator.
-- Fixing (a) alone would leave the one-way door standing for every DEMOTION.
--
-- ⛔ THE SITE SET WAS DERIVED FROM `pg_proc`, NOT FROM MIGRATION TEXT. At head
--    20261003005900 `app.grant_role_impl` carries FIVE `is_admin_for(` sites
--    (comment-stripped `prosrc`) and `app.revoke_role_impl` carries ONE. Exactly
--    two move here; the other three are PRESERVED and each is out of scope for a
--    named reason:
--      · organization/`org_admin` — the bootstrap ADR 0167 checked and kept.
--      · hospital/`hospital_admin` — AFF T2.5 / ADR 0097 D17 / audit BLOCKER-1.
--      · commission/`staff` — a DIFFERENT (scope, role) pair. ADR 0167
--        § Consequences: "the other `grant_role_impl` arms keep their own actor
--        grids; nothing here rules on them."
--    pgTAP 397 § 0.3 pins the surviving three by name, so a later change that
--    removes all five cannot pass by satisfying only the two cells above.
--
-- ⚠ THIS IS A NARROWING and it is REAL. `public.grant_role` is EXECUTE-able by
--   `authenticated`, so a signed-in platform admin could call this door directly
--   over PostgREST — even though `authorizeStaffAdminOps` has no `isAdmin` arm
--   and `/o/[org]/manage` 404s them. The door and the TypeScript gate DISAGREED
--   and the DOOR WAS WIDER; that disagreement is the subject of the ADR.
--
-- ⚠ ONE CONSEQUENCE THE ADR DID NOT NAME, RECORDED HERE. The
--   `'comissão inexistente'` guard in the ADR 0166 provisioning block below is
--   annotated "Reachable only for a platform admin". After this migration NO
--   actor reaches it on the commission tier: every surviving arm is already
--   false for an id that names no commission. ⛔ IT IS KEPT DELIBERATELY. That
--   unreachability is the enumeration-oracle kill working as designed —
--   authority-before-existence — and the guard remains as defence-in-depth for
--   any future arm. Deleting it as "dead code" would silently restore an
--   existence oracle over `commissions.id` the moment another arm is added.
--   pgTAP 396 § 5.6 was re-cut to assert the 42501 that now precedes it.
--
-- Bodies are re-emitted in full from the LIVE catalog at head 20261003005900
-- (`pg_get_functiondef`), byte-for-byte apart from the two predicates and the
-- comments named above. Forward-only: no applied migration is edited in place.

create or replace function app.grant_role_impl(
  p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid,
  p_title_id uuid default null::uuid,
  p_expires_at timestamp with time zone default null::timestamp with time zone)
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
  v_aff_org  uuid;
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
      -- ⚠ THIS SUB-ARM KEEPS ITS `is_admin_for`, AND THAT IS NOT AN ENDORSEMENT.
      --   `revoke_role_impl`'s 'staff' sub-arm has never had one, so the SAME
      --   one-way door ADR 0167 closes for `staff_admin` survives here: a
      --   platform admin may SEAT a commission `staff` and may not REMOVE one.
      --   ADR 0167 § Consequences bounds itself to the `staff_admin` arm, so
      --   closing this would be an unruled authorization change. It awaits its
      --   own PO ruling and is MEASURED by pgTAP 397 § 6 rather than described.
      if not (app.is_admin_for(p_actor)
              or app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else
      -- ⭐ ADR 0167 clause 1, SITE (a). `app.is_admin_for(p_actor)` was DROPPED:
      --    a commission coordinator builds forms and manages the commission
      --    roster, which is commission CONTENT, and the noun rule (ADR 0078 A35)
      --    puts that outside platform_admin's reach. The kernel already rules
      --    this way twice — technical_director / technical_director_deputy and
      --    quality_reviewer both gate on org-or-hospital admin with no
      --    `is_admin_for` arm at all — so this arm was the odd one out, and the
      --    odd one out in a second way: the hospital arm's identical clause
      --    cites AFF T2.5 / ADR 0097 D17 / BLOCKER-1 by name, this one cited
      --    nothing.
      --
      -- ⛔ SITE (b) IS THE OTHER HALF OF THIS CLAUSE — see the T1.0 replacement
      --    block below. Dropping the arm HERE alone leaves a platform admin able
      --    to DEMOTE an existing coordinator, which is the same one-way door
      --    inverted.
      if not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then
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

  -- ┌─ ADR 0166 — GOVERNANCE-ROLE PROVISIONING IMPLIES AN ORG AFFILIATION ──────┐
  -- Assigning `org_admin` or `staff_admin` to a tenant person also ESTABLISHES an
  -- active organisation affiliation with the organisation that owns the granted
  -- scope. The affiliation is an organisation-level TENANT RELATIONSHIP, not a
  -- hospital-employment assertion: it locates the person for visibility and
  -- lifecycle administration, while the membership remains the sole source of role
  -- capability. Architecture Rule 13 is untouched — affiliation still confers no
  -- role; provisioning merely creates BOTH facts.
  --
  -- ⛔ IT LIVES HERE, IN THE SHARED KERNEL, AND NOT IN THE TWO TYPESCRIPT CALLERS.
  --    A fix in `assignOrgAdmin` / `assignStaffAdmin` would leave this function able
  --    to recreate the state, and a second `affiliate_person_to_org_for` call from
  --    TypeScript would be a SECOND TRANSACTION — recreating the
  --    membership-without-affiliation partial write the rule exists to remove.
  --
  -- ⛔ AND IT SITS **ABOVE** THE T1.0 REPLACEMENT BLOCK, WHICH `return`s EARLY.
  --    Placed beside the final INSERT it would be dead code for every
  --    `staff` → `staff_admin` PROMOTION — the very path `assignStaffAdmin`
  --    documents as its purpose. pgTAP 396 § 3.3 is the behavioural keystone for
  --    that; § 0.7 pins the ordering structurally.
  --
  -- ⚠ SCOPE BOUND (ADR 0166 § Scope bound): EXACTLY these two (scope, role) pairs.
  --   Technical-director, NSP, quality and ordinary `staff` appointments have their
  --   own semantics and need their own ruling. 396 § 6.1–§ 6.3 pin the absence.
  --
  -- Everything the invariant needs happens BEFORE the membership write and inside
  -- THIS transaction, so clause 2 ("both rows, or neither") is a property of the
  -- RPC rather than of a caller's discipline. 396 § 5.8/§ 5.9 measure both
  -- directions with forced failures; § 5.9b is § 5.9's differential.
  if (p_scope_type = 'organization' and p_role = 'org_admin')
     or (p_scope_type = 'commission' and p_role = 'staff_admin') then
    if p_scope_type = 'organization' then
      v_aff_org := p_scope_id;
    else
      -- ⚠ NOT `v_org`. The commission tier deliberately leaves `v_org` NULL so the
      --   membership row keeps `organization_id IS NULL` (memberships_scope_shape —
      --   a scope-exclusivity CHECK). Writing the org into `v_org` here would
      --   silently re-shape every commission-tier membership row.
      select c.organization_id into v_aff_org
      from public.commissions c where c.id = p_scope_id;

      -- ⛔ UNREACHABLE SINCE ADR 0167, AND KEPT DELIBERATELY. This branch used to be
      -- reachable only for a platform admin; ADR 0167 removed that arm, and every
      -- surviving arm is already false for an id that names no commission. Its
      -- unreachability IS the enumeration-oracle kill working as designed
      -- (authority BEFORE existence), and it stays as defence-in-depth for any arm
      -- added later. ⛔ Deleting it as "dead code" would silently restore an
      -- existence oracle over `commissions.id`. pgTAP 396 § 5.6 asserts the 42501
      -- that now precedes it, and says why.
      if v_aff_org is null then
        raise exception 'comissão inexistente' using errcode = 'check_violation';
      end if;
    end if;

    perform app.ensure_provisioned_org_affiliation(p_actor, p_user, v_aff_org);
  end if;
  -- └───────────────────────────────────────────────────────────────────────────┘

  -- W1/T1.0 — atomic role replacement (commission tier only).
  -- QO·FUP F1 (ADR 0102): this path now WRITES the expiry argument. It used to ignore
  -- it entirely, so a role change carried the old window forward silently — pinned as
  -- a deferred seam limit by pgTAP 306 4.13, now recut to the opposite.
  if p_scope_type = 'commission' then
    select id, role into v_existing_id, v_existing_role
    from public.memberships
    where principal_id = p_user and commission_id = p_scope_id;

    if found and v_existing_role is distinct from p_role then
      -- ⭐ ADR 0167 clause 1, SITE (b) — the OUTGOING-role guard, and the half a
      --    fix that reads "the commission arm" as ONE place leaves standing.
      --    `app.is_admin_for(p_actor)` was DROPPED here too: changing an existing
      --    coordinator's role is administering the same commission content that
      --    seating one is, so the two must answer to the same authority.
      --
      -- ⚠ THE 'staff' SUB-ARM ABOVE ADMITS A PLATFORM ADMIN, so on a DEMOTION
      --   (`staff_admin` → `staff`) the actor is not refused earlier — it is
      --   ADMITTED earlier, and this guard is the only thing that stops it.
      --   pgTAP 397 § 5.3 discriminates by MESSAGE for exactly that reason: a
      --   SQLSTATE-only assertion would pass with this line reverted.
      if v_existing_role = 'staff_admin'
         and not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then
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

-- ---------------------------------------------------------------------------
-- `app.revoke_role_impl` — NO PREDICATE CHANGES. The only edit is the retired
-- QA m1 note. ADR 0167 aligns GRANT DOWN TO REVOKE; moving revoke up would be
-- the opposite decision, and pgTAP 397 § 0.4 pins that this function still
-- carries exactly ONE `is_admin_for`, in its organization/`org_admin` arm.
-- ---------------------------------------------------------------------------
create or replace function app.revoke_role_impl(
  p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid)
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
    -- ⭐ ADR 0167. THE QA m1 NOTE THAT USED TO SIT HERE IS RETIRED. It observed
    --    that this arm carries no `is_admin_for` while the grant arms do, and
    --    judged that deliberate. The observation was right and the judgement was
    --    wrong: a platform admin could SEAT a commission coordinator and could
    --    not REMOVE one — escalation with no matching de-escalation by the same
    --    actor. ADR 0167 aligns GRANT DOWN TO THIS, so the `staff_admin` halves
    --    of the two functions now read the same predicate and the note's subject
    --    is gone.
    --
    -- ⚠ THE NOTE'S SUBJECT IS GONE FOR `staff_admin` ONLY, AND THE REST IS NOT
    --   ENDORSED. `grant_role_impl`'s 'staff' sub-arm still carries
    --   `app.is_admin_for`; this one never has. So the SAME one-way door
    --   survives ONE ROLE OVER: a platform admin may SEAT a commission `staff`
    --   and may not remove one. ADR 0167 § Consequences bounds itself to the
    --   `staff_admin` arm ("the other `grant_role_impl` arms keep their own
    --   actor grids"), so closing it here would be an unruled authorization
    --   change. It is awaiting its own PO ruling, and pgTAP 397 § 6 MEASURES it
    --   as a known gap instead of describing it — which is why 397 § 4's
    --   grant/revoke agreement property is scoped to `staff_admin`.
    if p_role = 'staff' then
      if not (app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else
      if not app.is_tenancy_admin_of_for(p_scope_id, p_actor) then
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
