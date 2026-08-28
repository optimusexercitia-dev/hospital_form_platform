-- AE2 · QA R2-B1 — GOVERNANCE-ROLE PROVISIONING IMPLIES AN ORGANIZATION
-- AFFILIATION.  Ruling: ADR 0166 (eight binding clauses) + its QA-B5 grain
-- correction.  Proof: supabase/tests/396_ae2_provisioning_implies_org_affiliation.sql
-- (59 assertions; observed RED-FIRST at head 20261003005800 — 32 of 59 failing).
--
-- ============================================================================
-- WHAT WAS MEASURED, AND WHY THIS IS A KERNEL CHANGE
-- ============================================================================
-- `assignStaffAdmin` and `assignOrgAdmin` provision a person through
-- `resolveOrInviteUser`, grant a membership through the sanctioned role doors, and
-- NEVER create an affiliation.  Once `profiles.home_organization_id` drops, every
-- person provisioned that way is PERMANENTLY the state ADR 0164 accepted as a
-- transient crash window: refused by all six person-authority doors, absent from
-- every roster and both pickers, and reported forever by
-- `app.tenant_orphan_profiles()` — which cannot tell them from a genuine orphan.
--
-- ⛔ THE SEAM IS THIS FUNCTION, NOT THE TWO TYPESCRIPT CALLERS (ADR 0166
--    § Consequences).  A TypeScript fix leaves `app.grant_role_impl` able to
--    recreate the state, and a second `affiliate_person_to_org_for` call would be a
--    SECOND TRANSACTION — recreating the very partial write it removes.
--
-- ⛔ AND IT IS NOT A PLATFORM-ADMIN ARM ON `app.affiliate_person_to_org_impl`.
--    That door is `is_org_admin_of_for`-only BY DESIGN (the noun rule: platform
--    admin administers tenancy and identity, not employment).  Widening it would
--    broaden affiliation authority far beyond this decision, so the behaviour lands
--    in an OWNER-ONLY internal module that is not a door at all.  396 § 0.8 pins
--    that the ordinary door still has no such arm.
--
-- ============================================================================
-- TWO DECLARED NARROWINGS OF `grant_role_impl`, MEASURED RATHER THAN INHERITED
-- ============================================================================
-- ADR 0166 clause 5 says a person affiliated entirely elsewhere "remains refused".
-- ⚠ MEASURED AT HEAD 20261003005800: they were NOT refused.  `grant_role_impl`'s
--   org_admin / staff_admin arms carried NO tenancy check on the TARGET at all, so
--   an org_admin of A could seat ANY profile on the platform — org C's
--   administrator included — and clause 6's platform-administrator case succeeded
--   the same way.  Both become refusals here.  They are NARROWINGS of an exposed
--   door and are enumerated as such: 396 § 5.2 and § 5.4, each asserting the error
--   AND the absence of both rows.
--
-- ⚠ AND ONE DELIBERATE DEVIATION FROM THE SUPPLIED DESIGN, PINNED AT 396 § 5.5.
--   The design ordered the module's checks inactive-BEFORE-foreign.  This orders
--   them foreign-BEFORE-inactive, mirroring `app.affiliate_person_to_org_impl`
--   byte-for-byte.  The single differing cell is a target who is BOTH inactive and
--   foreign-affiliated: the supplied order answers HC0R4, which tells the caller
--   that an unknown uuid names a real, deactivated person in another tenant.  The
--   ORACLE-KILL that governs this whole door family (20261003003700's header) says
--   "not found" and "not yours" must be byte-identical, so the sibling's order
--   wins.  396 § 5.5 asserts the two answers are identical and is the one cell to
--   flip if the PO rules otherwise.

-- =============================================================================================
-- 1. THE INTERNAL MODULE.  ⛔ NOT A DOOR — it has NO authority check of its own,
--    so REACHABILITY IS THE VULNERABILITY.  EXECUTE is revoked from public, anon,
--    authenticated AND service_role: a service twin would be an unauthenticated
--    affiliation writer, because the actor is an argument.  Callers authorize
--    first; `app` has no default ACL, so a new function here inherits PUBLIC
--    EXECUTE and the revoke below is what removes it.
-- =============================================================================================

create function app.ensure_provisioned_org_affiliation(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date default current_date)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_is_admin  boolean;
  v_is_active boolean;
  v_existing  uuid;
  v_id        uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- ⛔ THE TENANT GATE IS LIFTED FROM `app.affiliate_person_to_org_impl` AND KEPT
  --    IDENTICAL, DELIBERATELY.  The two answer the same question — "may this
  --    person be bound to this organisation?" — so they get the same answer, the
  --    same SQLSTATE and the same pt-BR message.  Splitting identical siblings
  --    across increments is how this phase produced "one axis was swept, its
  --    sibling was not" three times.
  --
  -- ⚠ "NON-VOIDED" AND "ACTIVE" ANSWER DIFFERENT QUESTIONS AND THE DIFFERENCE IS
  --   THE POINT.  The collision check below uses NON-VOIDED rows (ended history
  --   included) because it asks whether the identity is KNOWN to an organisation.
  --   The idempotency check uses ACTIVE rows because provisioning requires a live
  --   relationship.  So an ENDED same-org row permits a NEW ACTIVE row rather than
  --   a mutation of history (clause 4), and a VOIDED-ONLY history counts as known
  --   NOWHERE (ADR 0163 bound 1 — void is "was never true", not "ended").
  select pr.is_admin, pr.is_active into v_is_admin, v_is_active
  from public.profiles pr where pr.id = p_user;

  -- ⛔ ORACLE-KILL.  "No such person", "a platform administrator" and "someone
  --    else's person" raise the SAME code with the SAME message, byte-identical.
  --    Splitting them would turn every provisioning door into a cross-tenant
  --    existence oracle over `profiles.id` for any admin of any tenant.  The
  --    refusals read as redundant precisely because they must not be
  --    distinguishable.  396 § 5.5 asserts the identity.
  if not found then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- Clause 6: a platform administrator's identity cannot be bound into a tenant as
  -- the target person.  `is_admin` is orthogonal to affiliation presence, which is
  -- also why `app.tenant_orphan_profiles()` uses it as its discriminator.
  if coalesce(v_is_admin, false) then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- Clause 5.  ⛔ Do NOT "simplify" this to "no affiliation outside <org>": that
  -- breaks the idempotent path for every legitimately multi-org person, a
  -- narrowing pgTAP 393 § 3 pins as W8 on the sibling door.
  if exists (select 1 from public.organization_affiliations oa
              where oa.principal_id = p_user and oa.voided_at is null)
     and not exists (select 1 from public.organization_affiliations oa
              where oa.principal_id = p_user and oa.voided_at is null
                and oa.organization_id = p_organization) then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- `profiles.is_active`, the MASTER SWITCH — not `app.is_active`, which also folds
  -- `suspended_until`.  A suspension is temporary and reversible; refusing to record
  -- someone's tenancy because they are suspended this week would turn an HR record
  -- into a disciplinary one.
  if not coalesce(v_is_active, false) then
    raise exception 'conta desativada' using errcode = 'HC0R4';
  end if;

  -- Clause 3, idempotence.  Over the ACTIVE row: the partial unique index would
  -- reject a duplicate anyway, and a 23505 surfacing as a generic pt-BR error is a
  -- worse answer than never writing one.
  select oa.id into v_existing
  from public.organization_affiliations oa
  where oa.principal_id = p_user and oa.organization_id = p_organization
    and oa.ended_on is null and oa.voided_at is null;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Clause 7: `created_by` is the REAL provisioning actor.  ⛔ Never the provisioned
  -- person — naming the target as actor to get around an authority check is exactly
  -- what the clause forbids, and this module performs no authority check that could
  -- be got around, which is why it is owner-only.
  -- Clause 8: until a start-date input exists on these two flows, the affiliation
  -- begins on the ROLE PROVISIONING DATE.
  insert into public.organization_affiliations
    (principal_id, organization_id, started_on, created_by)
  values
    (p_user, p_organization, coalesce(p_started_on, current_date), p_actor)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function app.ensure_provisioned_org_affiliation(uuid, uuid, uuid, date) from public;
revoke all on function app.ensure_provisioned_org_affiliation(uuid, uuid, uuid, date) from anon;
revoke all on function app.ensure_provisioned_org_affiliation(uuid, uuid, uuid, date) from authenticated;
revoke all on function app.ensure_provisioned_org_affiliation(uuid, uuid, uuid, date) from service_role;

comment on function app.ensure_provisioned_org_affiliation(uuid, uuid, uuid, date) is
  'ADR 0166: ensures the organization affiliation implied by an org_admin / staff_admin grant. NOT A DOOR — no authority check of its own, explicit actor, owner-only EXECUTE (service_role included). Invoked ONLY from app.grant_role_impl, after authority, in the same transaction as the membership write. Proof: pgTAP 396.';

-- =============================================================================================
-- 2. THE KERNEL.  Reproduced BYTE-FOR-BYTE from `pg_get_functiondef()` at head
--    20261003005800 apart from one declaration and one block — spliced
--    mechanically, then diffed against the pre-change catalog dump so "byte-for-byte"
--    is a measurement and not a claim.
-- =============================================================================================

CREATE OR REPLACE FUNCTION app.grant_role_impl(p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid DEFAULT NULL::uuid, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
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
      if not (app.is_admin_for(p_actor)
              or app.is_staff_admin_of_for(p_scope_id, p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then
        raise exception 'sem permissão' using errcode = '42501';
      end if;
    else
      if not (app.is_admin_for(p_actor)
              or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then
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

      -- Reachable only for a platform admin: every tenant authority arm is already
      -- false for an id that names no commission. Refused with the sibling branches'
      -- shape (`hospital inexistente`) instead of letting a raw 23503 escape from the
      -- membership insert three statements later.
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
      if v_existing_role = 'staff_admin'
         and not (app.is_admin_for(p_actor)
                  or app.is_tenancy_admin_of_for(p_scope_id, p_actor)) then
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
$function$

;

-- =============================================================================================
-- 3. QA B5 / R2-M1 — THE CATALOG COMMENT, CORRECTED FORWARD.
--
--    `20261003005600` says "unreachable by every roster and administrable by
--    platform_admin alone".  The header of that same file was corrected and the
--    `comment on` 185 lines below it was not — the intra-file sibling split — and
--    the false sentence is what a DBA reads beside the function.
--
--    ⛔ FORWARD MIGRATION ONLY.  `20261003005600` is applied everywhere local and is
--       never edited in place (.claude/rules/migrations-forward-only.md).
--
--    ⚠ BOTH earlier sentences are wrong WITHOUT A GRAIN.  "administrable by
--      platform_admin alone" is wrong, and its first correction — "administrable by
--      NOBODY" — is also wrong: QA round 2 measured `profiles_admin_update`
--      (`USING app.is_admin()`) plus the privileged-column guard's admin arm plus
--      `authenticated`'s column grants, and a platform administrator retains live
--      TABLE-LEVEL updates of `full_name`, `email`, `is_admin`, `is_active` on any
--      profile.  ADR 0166 § "The grain correction" supersedes both.  pgTAP 396 § 8
--      pins the new text AND the absence of the retired one, because a comment is an
--      assertion that goes stale silently and no other gate can contradict it.
-- =============================================================================================

comment on function app.tenant_orphan_profiles() is
  'ADR 0164 mitigation, grain corrected by ADR 0166: non-admin profiles with no non-voided organization affiliation — unreachable by every roster and administrable by NOBODY through the six person-authority doors. A platform_admin retains limited direct-table updates on selected profile columns (rename, re-email, deactivate, demote) via profiles_admin_update, and still cannot exercise door-gated capabilities such as CPF and credential changes. ⚠ Since ADR 0166 this population no longer includes admin-provisioned org_admin / staff_admin principals: app.grant_role_impl now establishes their organization affiliation in the same transaction as the membership. Proof it can fire: pgTAP 393 § 1.5/§ 1.6; the grain and the provisioning invariant: pgTAP 396 § 8 and § 1-§ 3.';
