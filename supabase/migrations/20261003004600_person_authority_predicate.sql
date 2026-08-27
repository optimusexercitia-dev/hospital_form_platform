-- AE1.3 (1/3) — app.can_administer_person_for: the SQL twin of `personScopeAllows`
-- plus the `authorizePersonScopedAdmin` preamble.
--
-- Authority chain: ADR 0155 G11 -> docs/plans/authz-evolution.md § AE1.3 ->
-- docs/plans/authz-ae1-person-doors.md (§3, §10.1a) as ruled in its §12 (R0, R2).
-- Semantics: ADR 0133 D1-D4/D9/D10 + Amendments 1 and 3, retired-in-part by ADR 0161
-- (which retires D4's "no SQL twin" prohibition: THIS function is the twin).
--
-- ⭐ WHY IT IS NAMED `can_administer_person_for` AND RETURNS `boolean` — A DOMAIN
-- DECISION, NOT A STYLE ONE (design §10.1a, lead ruling R0).
-- The six doors this predicate serves are `public`, SECURITY DEFINER, return void/uuid
-- and are granted to `service_role` only. That shape is in NO authz sweep arm's domain:
-- out of `census` (not bool, not setof), out of `policy` (not bool), out of `floor` (no
-- `authenticated` EXECUTE), out of `wrapper` (prosecdef = t). So the AUTHORITY DECISION
-- is deliberately lifted OUT of the doors and into this object, which is `app` +
-- prosecdef + `bool` (=> automatically inside `census`'s live set) and carries the
-- `^can_` prefix (=> permanently inside the `policy` arm's PRED_DOMAIN).
--   ⛔ The `^can_` prefix is load-bearing. The identity-body escape hatch
--      (`prosrc ~ 'app\.is_|memberships|principal_id'`) would admit this function today
--      too, but that is a BODY property: a refactor that pushes the `memberships` read
--      into a helper would silently evict it from the sweep. A name prefix cannot be
--      refactored away. Do not rename it to `person_scope_allows`.
--   ⛔ Do NOT "improve" the doors by making them return boolean so they enter the sweeps
--      directly (design §10.4, REJECTED by R0): a command door that returns `true` or
--      raises is a semantic lie, and it would pollute the predicate sweep's population.
--
-- ⭐ STABLE, deliberately. It reads and decides; it writes nothing. That also places it
-- OUTSIDE the ADR 0156 door-SQLSTATE gate (pgTAP 304 §6, whose kernel clause requires
-- `provolatile = 'v'`), so its `HC0T7` raise is keystoned directly in pgTAP 384 instead
-- and must NOT be added to 304 §6.6's declared literal (design §10.3, ruled in R0).
-- Making it VOLATILE purely to enter that gate would be shaping a volatility marker to
-- game a domain, and would block the planner from hoisting it.
--
-- ⛔ OWNER-ONLY. The `app` schema carries NO default ACL for functions, so a new `app`
-- function is created with `proacl = NULL`, which means PUBLIC EXECUTE — the recorded
-- "guards that read right but fail open" class. The `revoke` below is what makes the ACL
-- explicit; it is not tidiness. pgTAP 386 asserts `proacl IS NOT NULL` positively.

create or replace function app.can_administer_person_for(
  p_capability text,
  p_user uuid,
  p_actor uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $fn$
declare
  v_org          uuid;
  v_administered uuid[];
  v_footprint    uuid[];
begin
  -- ⛔ VOCABULARY FIRST. A typo'd capability is a TS<->SQL mirror-drift event and must be
  -- LOUD for every caller, including an org_admin one — the org arm below returns `true`
  -- without ever reaching the dispatch, so a check placed only at the dispatch would be
  -- silent for exactly the callers most likely to exercise a new capability first.
  -- Behaviour for the four real capabilities is byte-identical either way.
  if p_capability is null
     or p_capability not in ('fields', 'credentials', 'cpf_change', 'lifecycle') then
    raise exception 'capacidade de escopo de pessoa desconhecida: %', coalesce(p_capability, '<null>')
      using errcode = 'HC0T7';
  end if;

  -- ── PREAMBLE — mirrors `authorizePersonScopedAdmin` (actions.ts 361-391) ────────────
  -- ⛔ NOT part of `personScopeAllows`, and it must not be pushed into it on either side.
  -- That function's own docstring: "THIS ANSWERS THE FOOTPRINT QUESTION ONLY … The
  -- org_admin arm is handled before this is ever called."
  if p_actor is null or p_user is null then
    return false;
  end if;

  select pr.home_organization_id into v_org
  from public.profiles pr
  where pr.id = p_user;

  -- ⭐ NON-EXISTENCE OF THE TARGET IS FOLDED INTO THE DENIAL (design F-B). A missing
  -- person and an unauthorized caller return the IDENTICAL `42501` at every door. This
  -- is the same thing the TS does (`if (!orgId) return { ok: false }`) and the same
  -- principle `sendPasswordResetForUser` states: "⛔ NOT AN ENUMERATION ORACLE."
  if v_org is null then
    return false;
  end if;

  -- TS: `context.isInactive`.
  if not app.is_active(p_actor) then
    return false;
  end if;

  -- The org_admin arm, NOT footprint-bounded and NOT bounded by D2 below.
  -- ⛔ `platform_admin` is deliberately NOT an arm — `authorizeOrgOps` excludes it
  -- (ADR 0041 noun rule: person records are not platform_admin's). pgTAP 384 §6 asserts
  -- a platform_admin is refused, so an "obviously missing superuser arm" cannot be added
  -- back without reding.
  if app.is_org_admin_of_for(v_org, p_actor) then
    return true;
  end if;

  -- (a) hospital_admin authority must be held IN THE TARGET'S HOME ORG. A hospital
  -- administered in some other organisation is not a claim on this person.
  v_administered := array(
    select h.id
    from public.hospitals h
    where h.organization_id = v_org
      and app.is_hospital_admin_of_for(h.id, p_actor)
  );
  if cardinality(v_administered) = 0 then
    return false;
  end if;

  -- ── DECISION — mirrors `personScopeAllows` (person-scope.ts 107-143), same order ────

  -- D2 (person-scope.ts 113-114) — any org-tier or hospital-tier seat pushes the person
  -- to org_admin-only, for EVERY capability.
  -- ⚠ STRUCTURAL (`commission_id is null`), never a role-name list: the role vocabulary
  -- has widened four times (person-footprint.ts 58-63) and a hardcoded list silently
  -- admits the next one.
  -- ⚠ EXPIRY IS DELIBERATELY NOT APPLIED ON THIS LEG (QA R1 asymmetry,
  -- person-footprint.ts 141-150): expiry is applied to what a membership GRANTS, never
  -- to what it WITHHOLDS. Reading an expired org-tier seat as untiered would WIDEN.
  if exists (
    select 1 from public.memberships m
    where m.principal_id = p_user
      and m.commission_id is null
  ) then
    return false;
  end if;

  -- Footprint (person-scope.ts 58-78 / person-footprint.ts 77-172) — ACTIVE ONLY.
  -- ⛔ ACTIVE-ONLY IS THE POINT AND MUST NOT BE "ALIGNED" WITH THE READ RULE. Since ADR
  -- 0148 the `profiles` / `professional_credentials` SELECT policies test affiliation as
  -- EVER-HELD (the `ended_on` conjunct was removed in 20261003002900) so that
  -- `end_affiliation` does not 404 the admin who performed it. This WRITE predicate keeps
  -- both conjuncts: a hospital_admin may now OPEN an ex-employee's record and must still
  -- not be able to EDIT it. pgTAP 384 §5 reds if `ended_on is null` is dropped.
  -- ⚠ `voided_at is null` on the affiliations leg (AFF4 D7).
  -- ⚠ BOTH LEGS ARE REQUIRED (person-scope.ts 72-77): the org-wide member picker seats
  -- people on commissions of hospitals they hold no affiliation with, so an
  -- affiliations-only footprint would make a multi-hospital person look sole-footprint.
  v_footprint := array(
    select ha.hospital_id
    from public.hospital_affiliations ha
    where ha.principal_id = p_user
      and ha.ended_on is null
      and ha.voided_at is null
      and ha.hospital_id is not null
    union
    select c.hospital_id
    from public.memberships m
    join public.commissions c on c.id = m.commission_id
    where m.principal_id = p_user
      and m.commission_id is not null
      and (m.expires_at is null or m.expires_at > now())
      and c.hospital_id is not null
  );

  -- D2 empty footprint (person-scope.ts 119-128).
  -- ⚠ PINNED EXPLICITLY, NOT DERIVED. For the SUBSET capabilities `∅ ⊆ anything` is TRUE,
  -- so without this statement a zero-footprint person would be MORE manageable than a
  -- sole-hospital one — the classic vacuous-subset inversion. The INTERSECTION
  -- capabilities would deny anyway (∅ ∩ X = ∅), which is exactly why leaving the rule to
  -- the set maths would make half of it correct by accident.
  if cardinality(v_footprint) = 0 then
    return false;
  end if;

  if p_capability in ('fields', 'credentials') then
    -- INTERSECTION (person-scope.ts 130-136) — authority at ANY hospital the person
    -- serves. ADR 0133 Amdt 1 ruling 1: a name fix or a credential update is a LOCAL
    -- correction and the local-knowledge argument holds at every hospital they serve.
    return v_footprint && v_administered;
  elsif p_capability in ('cpf_change', 'lifecycle') then
    -- SUBSET (person-scope.ts 138-142) — the caller must administer the ENTIRE
    -- footprint. A CPF rewrite is a person-key identity event other hospitals depend on;
    -- deactivation is cross-hospital denial of access (`app.is_active` is folded into
    -- every membership predicate, making it a PLATFORM-WIDE kill switch).
    --
    -- ⚠ NULL HAZARD, STATED. `f <> all(v_administered)` evaluates to NULL if either side
    -- carried a NULL and `not exists` over a NULL-filtered row is a SILENT WIDEN. Both
    -- sides are NULL-free by construction (the footprint filters `hospital_id is not
    -- null`; `v_administered` comes from `hospitals.id`), and the form below is the one
    -- that survives if that ever stops being true.
    return not exists (
      select 1 from unnest(v_footprint) f
      where not (f = any (v_administered))
    );
  else
    -- ⛔ NEVER FALLS THROUGH. Falling through to SUBSET would be silently TIGHTER (a
    -- passing test proves nothing); falling through to INTERSECTION would be a WIDEN.
    -- Unreachable today because of the vocabulary check at the top — kept as the
    -- exhaustiveness backstop for a capability added there but not here.
    raise exception 'capacidade de escopo de pessoa desconhecida: %', p_capability
      using errcode = 'HC0T7';
  end if;
end;
$fn$;

-- ⛔ OWNER-ONLY. See the header: `app` has no default function ACL, so without this the
-- ACL is NULL = PUBLIC EXECUTE. No grant to `anon`, `authenticated` or `service_role` —
-- the `service_role = false` half is not tidiness either: it is the ADR 0156 gate's own
-- kernel-domain condition, so a stray grant would evict a kernel from that gate.
revoke all on function app.can_administer_person_for(text, uuid, uuid) from public;

comment on function app.can_administer_person_for(text, uuid, uuid) is
  'ADR 0133 D1-D4 (+Amdt 1 r1, Amdt 3) person-authority predicate; SQL twin of personScopeAllows + the authorizePersonScopedAdmin preamble. Retires ADR 0133 D4 per ADR 0161. Capabilities: fields/credentials = INTERSECTION, cpf_change/lifecycle = SUBSET. Owner-only; consumed by the six app.*_impl person door kernels.';
