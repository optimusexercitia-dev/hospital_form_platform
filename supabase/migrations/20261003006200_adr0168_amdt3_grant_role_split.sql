-- ADR 0168 Amendment 3 (PO-ruled 2026-08-28) — THE FOURTH TENANT-REACHABLE DOOR.
--
-- ============================================================================
-- ⛔ WHY THIS MIGRATION EXISTS, AND WHY IT IS NOT A SECOND OPINION ON 006100
-- ============================================================================
-- Migration 20261003006100 split the anchorless-admitting branch out of the two
-- `affiliate_person*` doors.  A live probe on a fresh reset then found a THIRD
-- tenant-reachable door carrying the SAME predicate under a different name:
--
--     public.grant_role  (authenticated)
--       -> app.grant_role_impl
--         -> app.ensure_provisioned_org_affiliation
--
-- Measured, rolled back: an `org_admin` of Rede A passing a bare orphan uuid to
-- `public.grant_role('organization', A, 'org_admin', <orphan>)` was ACCEPTED, and
-- the orphan gained an ACTIVE org-A affiliation **and** an `org_admin` membership
-- — strictly more than the two doors 006100 closed.  A commission `staff_admin`
-- was refused 42501, so the exposure is bounded to the `(organization, org_admin)`
-- arm.
--
-- ⛔ THE PREDICATE BELOW WAS A VERBATIM COPY, AND THIS FUNCTION'S OWN HEADER
--    FORBADE EXACTLY WHAT NEARLY HAPPENED.  It said the gate was "LIFTED FROM
--    app.affiliate_person_to_org_impl AND KEPT IDENTICAL, DELIBERATELY … Splitting
--    identical siblings across increments is how this phase produced 'one axis was
--    swept, its sibling was not' three times."  Narrowing the two `affiliate_person*`
--    impls and leaving this one IS that split.  This migration closes it in the
--    increment immediately after, and pgTAP 399 § 3 replaces the name-bounded
--    sibling pin with a CAPABILITY-bounded one so the next such door cannot hide.
--
-- ============================================================================
-- ⭐ WHY THE OBVIOUS FIX IS WRONG — the one case Amendment 1's diagnosis misses
-- ============================================================================
-- `ensure_provisioned_org_affiliation` exists to anchor a JUST-INVITED person:
-- `resolveOrInviteUser` invites, then the role grant anchors.  Narrowing it to
-- "known here" outright would refuse EVERY first-time provisioning — ADR 0166's
-- entire purpose.  Amendment 1 ruled that "the door's ACL is the only durable
-- discriminator left"; that holds only where a door's ACL already matches its job,
-- and here it does not:
--
--     this door is CREATION-BY-FUNCTION but ORDINARY-BY-ACL.
--
-- So the ACL is made to match, by splitting the two wrappers that were previously
-- identical in every respect except where the actor comes from:
--
--   • `public.grant_role`     (authenticated) passes p_allow_anchorless => FALSE
--   • `public.grant_role_for` (service_role)  passes p_allow_anchorless => TRUE
--
-- ⚠ THAT IS THE FIRST BEHAVIOURAL ASYMMETRY BETWEEN THE TWO TWINS, and an
--   unpinned asymmetry gets "tidied back to symmetry" by the next reader.  It is
--   PINNED by pgTAP 399 § 1, derived from `pg_proc` in both directions, with a
--   behavioural twin (399 § 2) so the pin is not merely textual.
--
-- ⛔ NEITHER WRAPPER'S ACL CHANGES.  This narrows the TARGET-TENANCY predicate,
--    not the door's audience; `public.grant_role` stays reachable by
--    `authenticated` (pgTAP 396 § 0.4 / § 0.5 assert both, and stay green).
--
-- ⚠ SIGNATURE CHANGE, SO THE OLD OVERLOAD IS DROPPED EXPLICITLY.  Adding a
--   DEFAULTED parameter creates a NEW function rather than replacing the old one;
--   a surviving 4-arg / 7-arg twin would be (a) an ambiguous overload for the
--   existing 3-arg and 5-arg call sites and (b) a door that still admits the
--   widening.  pgTAP 399 § 0.1 / § 0.2 assert that exactly one of each survives.
--   ⚠ Dropping also drops the function's ACL; `pg_default_acl` for functions is
--   `{postgres=X/postgres}` estate-wide (migration …005300), so both bodies come
--   back owner-only.  399 § 0.3 asserts that POSITIVELY per role rather than
--   trusting the default — a NULL proacl includes PUBLIC.
-- ============================================================================

drop function if exists app.ensure_provisioned_org_affiliation(uuid, uuid, uuid, date);

create or replace function app.ensure_provisioned_org_affiliation(
  p_actor            uuid,
  p_user             uuid,
  p_organization     uuid,
  p_started_on       date    default current_date,
  p_allow_anchorless boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_is_admin  boolean;
  v_is_active boolean;
  v_existing  uuid;
  v_id        uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- ⛔ THE TENANT GATE IS THE SIBLING DOORS' GATE, EXPRESSED THROUGH THE SAME TWO
  --    NAMED HELPERS — `app.person_known_to_org` and `app.person_is_anchorless`,
  --    which ADR 0168 extracted precisely so the family can be pinned by NAME
  --    instead of by SQL shape.  The two answer the same question the ordinary
  --    affiliation doors answer — "may this person be bound to this organisation?"
  --    — and give the same SQLSTATE and the same pt-BR message.
  --
  -- ⚠ THE SENTENCE THIS COMMENT USED TO CARRY WAS "KEPT IDENTICAL, DELIBERATELY",
  --   AND ADR 0168 Amdt 3 MADE IT FALSE.  The anchorless arm now lives behind a
  --   PARAMETER, and the WRAPPER decides its value: `public.grant_role` passes
  --   false, `public.grant_role_for` passes true.  The identity that survives is
  --   with the CREATION doors (`known OR anchorless`), not with the ordinary ones —
  --   this door is creation-by-function, and it is the wrapper's ACL, not this
  --   body, that says who may use the wide arm.
  --
  -- ⚠ "NON-VOIDED" AND "ACTIVE" ANSWER DIFFERENT QUESTIONS AND THE DIFFERENCE IS
  --   THE POINT.  Both helpers read NON-VOIDED rows (ended history included)
  --   because they ask whether the identity is KNOWN to an organisation.  The
  --   idempotency check below uses ACTIVE rows because provisioning requires a live
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
  -- ⛔ IT STAYS ABOVE CLAUSE 5 AND OUTSIDE `p_allow_anchorless`.  A platform admin's
  --    own profile is ANCHORLESS by construction (`app.person_is_anchorless` has no
  --    `is_admin` arm, deliberately), so folding this refusal into the widened arm
  --    would let the service door bind a platform administrator into a tenant.
  if coalesce(v_is_admin, false) then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- Clause 5.  ⛔ Do NOT "simplify" this to "no affiliation outside <org>": that
  -- breaks the idempotent path for every legitimately multi-org person, a
  -- narrowing pgTAP 393 § 3 pins as W8 on the sibling door.
  --
  -- ⭐ THE ONE LINE ADR 0168 Amdt 3 CHANGES.  `p_allow_anchorless` is FALSE by
  --    default, so every caller that does not opt in gets the ORDINARY doors'
  --    predicate — "known here" — and an anchorless uuid is refused.
  if not (app.person_known_to_org(p_user, p_organization)
          or (p_allow_anchorless and app.person_is_anchorless(p_user))) then
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
$function$;

revoke execute on function app.ensure_provisioned_org_affiliation(uuid, uuid, uuid, date, boolean) from public;

comment on function app.ensure_provisioned_org_affiliation(uuid, uuid, uuid, date, boolean) is
  'ADR 0166 + ADR 0168 Amdt 3. Anchors a provisioned person to an organisation. The '
  'tenancy gate is "known here", widened to "or anchorless" ONLY when the caller '
  'passes p_allow_anchorless — which public.grant_role_for (service_role) does and '
  'public.grant_role (authenticated) does not. Owner-only: it takes an explicit '
  'actor and performs no authority check of its own.';

-- ---------------------------------------------------------------------------
-- `app.grant_role_impl` — the pass-through, and NOTHING else.
--
-- ⚠ The catalog says this is the ONLY caller of the ensure (verified from
--   `pg_proc.prosrc` over both schemas, not from migration text), so the parameter
--   has exactly one consumer.  Its own other callers —
--   `public.appoint_technical_director` and the two wrappers below — are unchanged;
--   `appoint_technical_director` grants at the HOSPITAL tier with
--   `technical_director`, a (scope, role) pair the ADR 0166 block does not cover,
--   so the default FALSE is inert for it rather than a narrowing it did not ask for.
--   pgTAP 399 § 4 measures that bound instead of asserting it in prose.
-- ---------------------------------------------------------------------------
drop function if exists app.grant_role_impl(uuid, text, uuid, text, uuid, uuid, timestamptz);

create or replace function app.grant_role_impl(
  p_actor            uuid,
  p_scope_type       text,
  p_scope_id         uuid,
  p_role             text,
  p_user             uuid,
  p_title_id         uuid        default null,
  p_expires_at       timestamptz default null,
  p_allow_anchorless boolean     default false
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
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
  -- ⭐ ADR 0168 Amdt 3: `p_allow_anchorless` FLOWS THROUGH HERE UNCHANGED and is
  --   consumed nowhere else. This kernel does not decide the tenancy question; it
  --   carries the WRAPPER's answer to the module that does. Reading the value out of
  --   the session, the actor, or `app.is_admin_for` would put the discriminator back
  --   inside a shared body — which is the exact shape ADR 0168 Amdt 1 ruled cannot
  --   work once an anchorless person and a just-created person are the same DB state.
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

    perform app.ensure_provisioned_org_affiliation(
      p_actor, p_user, v_aff_org, current_date, p_allow_anchorless);
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

revoke execute on function app.grant_role_impl(uuid, text, uuid, text, uuid, uuid, timestamptz, boolean) from public;

-- ---------------------------------------------------------------------------
-- ⭐⭐ THE ASYMMETRY.  These two wrappers have been deliberately IDENTICAL in
--     every respect except where the actor comes from.  This is the FIRST
--     behavioural difference between them, and it is the whole of ADR 0168
--     Amdt 3's decision expressed in two literals.
--
-- ⛔ DO NOT "RESTORE SYMMETRY" HERE IN EITHER DIRECTION.
--     • `grant_role` => true  re-opens the widening this migration closes: any
--       org_admin holding a bare uuid could anchor it AND seat a governance role.
--     • `grant_role_for` => false breaks first-time provisioning outright —
--       `resolveOrInviteUser` invites, then the role grant anchors, and the person
--       is anchorless at exactly that moment.  ADR 0166's entire purpose.
--     pgTAP 399 § 1 derives BOTH literals from `pg_proc` and asserts them as a
--     PAIR, so either edit reds; 399 § 2 is its behavioural twin.
--
-- ⛔ NEITHER ACL CHANGES.  `create or replace` on an unchanged signature preserves
--     `proacl`; 396 § 0.4 / § 0.5 and 399 § 0.3 assert both, positively per role.
-- ---------------------------------------------------------------------------
create or replace function public.grant_role(
  p_scope_type text,
  p_scope_id   uuid,
  p_role       text,
  p_user       uuid,
  p_title_id   uuid        default null,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
begin
  -- ADR 0168 Amdt 3: the SESSION door passes p_allow_anchorless => FALSE.
  perform app.grant_role_impl((select auth.uid()), p_scope_type, p_scope_id, p_role, p_user, p_title_id, p_expires_at, false);
end;
$function$;

create or replace function public.grant_role_for(
  p_actor      uuid,
  p_scope_type text,
  p_scope_id   uuid,
  p_role       text,
  p_user       uuid,
  p_title_id   uuid        default null,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
begin
  -- ADR 0168 Amdt 3: the SERVICE door passes p_allow_anchorless => TRUE.
  perform app.grant_role_impl(p_actor, p_scope_type, p_scope_id, p_role, p_user, p_title_id, p_expires_at, true);
end;
$function$;

comment on function public.grant_role(text, uuid, text, uuid, uuid, timestamptz) is
  'Session door for role grants; actor is auth.uid(). ADR 0168 Amdt 3: passes '
  'p_allow_anchorless => FALSE, so an anchorless target is refused HC0R0. '
  'ASYMMETRIC with public.grant_role_for by design — pinned by pgTAP 399 § 1.';

comment on function public.grant_role_for(uuid, text, uuid, text, uuid, uuid, timestamptz) is
  'Service door for role grants; explicit actor, service_role only. ADR 0168 Amdt 3: '
  'passes p_allow_anchorless => TRUE, because it is the provisioning path and a '
  'just-invited person is anchorless at exactly that moment. ASYMMETRIC with '
  'public.grant_role by design — pinned by pgTAP 399 § 1.';
