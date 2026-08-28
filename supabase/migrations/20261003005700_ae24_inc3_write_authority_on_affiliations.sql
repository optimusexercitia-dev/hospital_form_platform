-- AE2.4 INCREMENT 3 — THE WRITE-AUTHORITY PATH MOVES OFF `profiles.home_organization_id`.
--
-- Rulings: ADR 0163 (last-org retention) · ADR 0164 (this increment is a HARD GATE on the
-- column drop, and owes a capability-level differential) · ADR 0155 D3 / Architecture
-- Rule 13 (an affiliation LOCATES, a `memberships` row GRANTS).
-- Keystone: pgTAP `394` (39 assertions), written and observed RED before this file existed.
--
-- ===========================================================================
-- WHAT WAS BROKEN, STATED AS THE ADR STATES IT
-- ===========================================================================
-- ADR 0163's last-org retention has been live on the READ side since AE2.2, and NOT on the
-- write side: `app.can_administer_person_for` — THE person-level capability predicate for
-- `fields` / `credentials` / `cpf_change` / `lifecycle` — still resolved the target's
-- organisation from the column.  Those four capabilities are exactly what the six AE1.3
-- person doors gate, so the ADR was not in force where its own subject matter is enforced.
--
-- ⛔ AND NO SEEDED TEST COULD HAVE SAID SO.  In `seed.sql` a person's `home_organization_id`
--    and their located organisation ALWAYS coincide, so every seeded assertion is true under
--    both predicates.  `394 § 8.2` measures that coincidence over the whole seed roster —
--    five callers, four capabilities, ZERO movement — rather than citing it.
--
-- ===========================================================================
-- ⭐ RULING, 2026-08-28 — RETENTION IS CAPABILITY-BLIND, AND ADR 0163 IS AMENDED
-- ===========================================================================
-- ADR 0163's Decision paragraph reads "bounded to the SUBSET capabilities (lifecycle,
-- cpf_change)".  Taken literally that denies an org_admin of the retaining organisation
-- `fields` and `credentials` over a fully-offboarded person — a NARROWING against today,
-- since the org arm returns `true` BEFORE the capability dispatch is ever reached.
--
-- The PO ruled it a defect in the ADR rather than in the reading: INTERSECTION / SUBSET
-- (ADR 0133 Amdt 1 r1) is a bound on the HOSPITAL_ADMIN arm and has never applied to
-- org_admin, so the Decision paragraph borrowed a hospital-tier label and pinned it to an
-- org-tier rule.  ⛔ The tell is that the ADR contradicts itself: its own bound 3 says
-- retention "grants nothing beyond what an org_admin of an ACTIVE affiliation would hold",
-- and such an admin holds all four.
--
-- Implemented: CAPABILITY-BLIND.  `394 § 6` measures the counterfactual anyway — the
-- literal reading would move exactly 16 cells, creating 12 new narrowings and cancelling
-- 4 declared widenings — because a ruling that a reading was NOT intended is worth more
-- with the alternative measured beside it.
--
-- ===========================================================================
-- ⛔ THE SIX KERNELS' COLUMN READ IS NOT AN AUTHORITY READ — AND IT IS STILL A
--    READ-AUTHORITY DECISION.  THE GRAIN MATTERS IN BOTH DIRECTIONS.
-- ===========================================================================
-- ADR 0163 records that "all six AE1.3 person-door kernels" also resolve the column.  True
-- of the string, false of the grain, measured: in every one of the six the value feeds ONLY
-- `app.audit_write(p_organization => v_org)`.  Authority in all six is
-- `app.can_administer_person_for`, which is why re-predicating THAT is the whole authority
-- change.
--
-- But it is not attribution housekeeping either, and this is the half that matters:
--
--     audit_log_select := … OR ((commission_id IS NULL) AND app.is_org_admin_of(organization_id)) OR …
--
-- and all six kernels write `p_commission => null`.  So `v_org` decides WHO MAY READ THE
-- AUDIT ROW.  It is replaced by `app.person_audit_organization`, and `394 § 7` measures the
-- readership movement as the read-authority differential it is.
--
-- ===========================================================================
-- THE SHAPE OF THE CHANGE (Architecture Rule 13, kept structurally visible)
-- ===========================================================================
--   LOCATE   `app.person_authority_orgs(person)`  — no caller term at all, so it CANNOT
--            grant; implements all four ADR 0163 bounds.
--   GRANT    `app.is_org_admin_of_for(org, actor)` / `app.is_hospital_admin_of_for(...)`
--            — a `memberships` read, in a separate, visibly distinct step.
-- ⛔ The collapsed one-join form type-checks identically.  `394 § 9.2` is the assertion that
--    reds if the two steps are ever fused: a caller who SHARES an active affiliation with
--    the target but holds no membership must be denied for every capability.
--
-- ===========================================================================
-- WHAT IS DELIBERATELY NOT HERE
-- ===========================================================================
--   • The column is NOT dropped.  `public.handle_new_user` and
--     `public.guard_profile_privileged_columns` still name it — they WRITE and GUARD it
--     rather than deriving authority from it, and they belong to the drop increment.
--     `394 § 1.5` pins that residue BY NAME, so a newcomer reds.
--   • `app.person_authority_orgs` is unchanged, and stays `postgres`-only: a row-returning
--     DEFINER is a gate you can walk through, and granting it would let any caller
--     enumerate any person's organisations by id (`394 § 1.6`).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. THE AUDIT-ATTRIBUTION LOCATOR (new).
--
-- Returns the organisation THROUGH WHICH THE ACTOR'S AUTHORITY RESOLVED, which is the
-- affiliation-era equivalent of "the tenant this person belongs to" and is single-valued
-- wherever the two coincide — i.e. everywhere in the seed and in every real installation
-- today (`394 § 7.2`).
--
-- ⚠ THE TIE-BREAK IS BOUNDED-BUT-ARBITRARY, AND SAYING SO IS THE POINT.  Where an actor
--   administers TWO located organisations, `order by organization_id limit 1` picks one and
--   the LOSING organisation's other admins can no longer read that audit row.  Any of the
--   candidates is a defensible attribution; WHICH one is arbitrary — it is chosen for
--   DETERMINISM, and the lowest uuid means nothing.  ⛔ A later reader must not infer that
--   it does.  Pre-declared as a cell in `394 § 7.4`.
--
-- ⚠ Two rejected alternatives, recorded so they are not re-proposed:
--   • `min()` over the person's located organisations regardless of the actor can attribute
--     a row to an organisation that had nothing to do with the act.
--   • NULL-on-ambiguity hides the row from the very admin who caused it.
--
-- FAIL-CLOSED: no located organisation the actor administers ⇒ NULL ⇒ the audit row falls
-- to `audit_log_select`'s platform-admin-only arm.  Reachable only if the caller was not
-- authorized in the first place, since every caller of this function has already passed
-- `app.can_administer_person_for` (`394 § 7.5` asserts both halves).
-- ---------------------------------------------------------------------------
create or replace function app.person_audit_organization(p_actor uuid, p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  -- LOCATE (no caller term inside), then GRANT (the caller's memberships) — Rule 13's two
  -- steps, kept separate here as well so the attribution cannot become an authority source.
  select o.organization_id
    from app.person_authority_orgs(p_user) o
   where app.is_org_admin_of_for(o.organization_id, p_actor)
      or exists (
           select 1
             from public.hospitals h
            where h.organization_id = o.organization_id
              and app.is_hospital_admin_of_for(h.id, p_actor))
   order by o.organization_id
   limit 1;
$$;

revoke all on function app.person_audit_organization(uuid, uuid) from public;

comment on function app.person_audit_organization(uuid, uuid) is
  'AE2.4 inc 3 — the organisation a person-scoped audit row is attributed to, replacing '
  'profiles.home_organization_id. NOT cosmetic: audit_log_select gates commission-less rows '
  'on app.is_org_admin_of(organization_id), so this decides audit-row readership. The '
  'tie-break among several administered organisations is deterministic but ARBITRARY.';

-- ---------------------------------------------------------------------------
-- 2. THE CAPABILITY PREDICATE.
--
-- ⛔ THE NAME IS KEPT.  A rename orphans every name-keyed verdict — the door-audit
--    findings file, the ARM baselines, `authz-unswept-backlog.txt`.
--
-- Reproduced byte-for-byte from `pg_get_functiondef()` at head `20261003005600` except for
-- the organisation resolution: `v_org uuid` becomes `v_orgs uuid[]`, and its three uses
-- (the not-found denial, the org arm, the hospital-scoping) are re-predicated.  Everything
-- from D2 downward — the structural `commission_id is null` rule, the expiry asymmetry, the
-- ACTIVE-ONLY footprint with both legs, the empty-footprint pin, INTERSECTION, SUBSET and
-- the exhaustiveness backstop — is unchanged, and `394 § 9.1` is the control that proves it:
-- an independent reproduction of that downstream logic, fed the same organisation list, must
-- equal this function on all 396 differential cells.
-- ---------------------------------------------------------------------------
create or replace function app.can_administer_person_for(p_capability text, p_user uuid, p_actor uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_orgs         uuid[];
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

  -- ── PREAMBLE — mirrors `authorizePersonScopedAdmin` (actions.ts) ───────────────────
  -- ⛔ NOT part of `personScopeAllows`, and it must not be pushed into it on either side.
  -- That function's own docstring: "THIS ANSWERS THE FOOTPRINT QUESTION ONLY … The
  -- org_admin arm is handled before this is ever called."
  if p_actor is null or p_user is null then
    return false;
  end if;

  -- ── LOCATE (Architecture Rule 13 / ADR 0155 D3) ────────────────────────────────────
  -- AE2.4 inc 3: was `select pr.home_organization_id into v_org from public.profiles pr`.
  -- `app.person_authority_orgs` implements ADR 0163's four bounds — void is NOT end; most
  -- recent by `ended_on` with ties yielding ALL tied organisations; retention only when no
  -- active affiliation exists; no hospital-tier reach. ⛔ Its body contains NO CALLER TERM,
  -- so it locates and cannot grant. The grant is the separate `is_*_admin_of_for` step below.
  v_orgs := array(select organization_id from app.person_authority_orgs(p_user));

  -- ⭐ NON-EXISTENCE OF THE TARGET IS FOLDED INTO THE DENIAL (design F-B). A missing
  -- person and an unauthorized caller return the IDENTICAL `42501` at every door. This
  -- is the same thing the TS does and the same principle `sendPasswordResetForUser`
  -- states: "⛔ NOT AN ENUMERATION ORACLE."
  -- ⚠ COMPOSITION CHECK, DONE RATHER THAN ASSUMED: the empty result of a re-predicated
  -- locator must land on the RESTRICTIVE answer, exactly as the NULL column did. A person
  -- with no non-voided affiliation is now administrable by nobody — an accepted narrowing
  -- (`394 § 5`, cells CA×P9 / CA×P3), not a fail-open.
  if cardinality(v_orgs) = 0 then
    return false;
  end if;

  -- TS: `context.isInactive`.
  if not app.is_active(p_actor) then
    return false;
  end if;

  -- ── GRANT — the org_admin arm, NOT footprint-bounded and NOT bounded by D2 below.
  -- ⛔ `platform_admin` is deliberately NOT an arm — `authorizeOrgOps` excludes it
  -- (ADR 0041 noun rule: person records are not platform_admin's). pgTAP 384 §6 asserts
  -- a platform_admin is refused, so an "obviously missing superuser arm" cannot be added
  -- back without reding.
  -- ⚠ This arm returns BEFORE the capability dispatch, which is why the capability axis is
  -- INERT on the org tier — measured in `394 § 2.2`, not assumed.
  if exists (
    select 1 from unnest(v_orgs) o
    where app.is_org_admin_of_for(o, p_actor)
  ) then
    return true;
  end if;

  -- (a) hospital_admin authority must be held IN AN ORGANISATION THAT LOCATES THIS PERSON.
  -- A hospital administered in some other organisation is not a claim on this person.
  v_administered := array(
    select h.id
    from public.hospitals h
    where h.organization_id = any (v_orgs)
      and app.is_hospital_admin_of_for(h.id, p_actor)
  );
  if cardinality(v_administered) = 0 then
    return false;
  end if;

  -- ── DECISION — mirrors `personScopeAllows` (person-scope.ts), same order ────────────

  -- D2 — any org-tier or hospital-tier seat pushes the person to org_admin-only, for
  -- EVERY capability.
  -- ⚠ STRUCTURAL (`commission_id is null`), never a role-name list: the role vocabulary
  -- has widened four times and a hardcoded list silently admits the next one.
  -- ⚠ EXPIRY IS DELIBERATELY NOT APPLIED ON THIS LEG (QA R1 asymmetry): expiry is applied
  -- to what a membership GRANTS, never to what it WITHHOLDS. Reading an expired org-tier
  -- seat as untiered would WIDEN.
  if exists (
    select 1 from public.memberships m
    where m.principal_id = p_user
      and m.commission_id is null
  ) then
    return false;
  end if;

  -- Footprint — ACTIVE ONLY.
  -- ⛔ ACTIVE-ONLY IS THE POINT AND MUST NOT BE "ALIGNED" WITH THE READ RULE. Since ADR
  -- 0148 the `profiles` / `professional_credentials` SELECT policies test affiliation as
  -- EVER-HELD so that `end_affiliation` does not 404 the admin who performed it. This
  -- WRITE predicate keeps both conjuncts: a hospital_admin may now OPEN an ex-employee's
  -- record and must still not be able to EDIT it. pgTAP 384 §5 reds if `ended_on is null`
  -- is dropped.
  -- ⚠ `voided_at is null` on the affiliations leg (AFF4 D7).
  -- ⚠ BOTH LEGS ARE REQUIRED: the org-wide member picker seats people on commissions of
  -- hospitals they hold no affiliation with, so an affiliations-only footprint would make a
  -- multi-hospital person look sole-footprint. ⭐ That second leg is also the ONLY way a
  -- footprint can outlive the organisation affiliation that created it, which is the state
  -- `394`'s Q2 / Q5 are built from — the hospital-tier half of this increment's differential.
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

  -- D2 empty footprint.
  -- ⚠ PINNED EXPLICITLY, NOT DERIVED. For the SUBSET capabilities `∅ ⊆ anything` is TRUE,
  -- so without this statement a zero-footprint person would be MORE manageable than a
  -- sole-hospital one — the classic vacuous-subset inversion. The INTERSECTION
  -- capabilities would deny anyway (∅ ∩ X = ∅), which is exactly why leaving the rule to
  -- the set maths would make half of it correct by accident.
  -- ⭐ THIS IS ALSO WHAT KEEPS ADR 0163 BOUND 4 ("hospital_admin is unaffected") TRUE AFTER
  -- the re-predication: a retained person has no active affiliation anywhere, so their
  -- footprint is empty and the hospital tier refuses regardless of where retention located
  -- them. Structural, not incidental — `394 § 3.4` measures it.
  if cardinality(v_footprint) = 0 then
    return false;
  end if;

  if p_capability in ('fields', 'credentials') then
    -- INTERSECTION — authority at ANY hospital the person serves. ADR 0133 Amdt 1 ruling 1:
    -- a name fix or a credential update is a LOCAL correction and the local-knowledge
    -- argument holds at every hospital they serve.
    return v_footprint && v_administered;
  elsif p_capability in ('cpf_change', 'lifecycle') then
    -- SUBSET — the caller must administer the ENTIRE footprint. A CPF rewrite is a
    -- person-key identity event other hospitals depend on; deactivation is cross-hospital
    -- denial of access (`app.is_active` is folded into every membership predicate, making
    -- it a PLATFORM-WIDE kill switch).
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
$function$;

-- ---------------------------------------------------------------------------
-- 3. THE SIX AE1.3 PERSON-DOOR KERNELS.
--
-- Each replaces exactly one statement — `select pr.home_organization_id into v_org …` —
-- with `app.person_audit_organization(...)`.  Nothing else in any of the six changes:
-- authority is `app.can_administer_person_for`, already re-predicated above, and the audit
-- action / summary / metadata / write lists are reproduced from `pg_get_functiondef()` at
-- head `20261003005600`.
-- ---------------------------------------------------------------------------

create or replace function app.set_person_active_impl(p_actor uuid, p_user uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_org uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.can_administer_person_for('lifecycle', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- AE2.4 inc 3: audit attribution, and therefore audit-row READERSHIP.
  v_org := app.person_audit_organization(p_actor, p_user);

  update public.profiles
     set is_active       = p_active,
         suspended_until = case when p_active then null else suspended_until end
   where id = p_user;

  perform app.audit_write(
    -- Branch on the direction so the trail reads without decoding metadata.
    p_action        => case when p_active then 'person.reactivated' else 'person.deactivated' end,
    p_entity_type   => 'profile',
    p_entity_id     => p_user,
    p_commission    => null,
    p_summary       => case when p_active then 'Pessoa reativada' else 'Pessoa desativada' end,
    p_metadata      => jsonb_build_object('actor_user_id', p_actor, 'is_active', p_active),
    p_organization  => v_org,
    p_hospital      => null
  );
end;
$function$;

create or replace function app.suspend_person_impl(p_actor uuid, p_user uuid, p_suspended_until timestamp with time zone)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_org uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- Suspension routes through the same `app.is_active` kill switch, so it is `lifecycle`
  -- (SUBSET) too, not a lesser act.
  if not app.can_administer_person_for('lifecycle', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  v_org := app.person_audit_organization(p_actor, p_user);

  update public.profiles
     set suspended_until = p_suspended_until
   where id = p_user;

  perform app.audit_write(
    p_action        => 'person.suspended',
    p_entity_type   => 'profile',
    p_entity_id     => p_user,
    p_commission    => null,
    p_summary       => 'Suspensão de acesso registrada',
    -- A schedule, not PHI.
    p_metadata      => jsonb_build_object('actor_user_id', p_actor, 'until', p_suspended_until),
    p_organization  => v_org,
    p_hospital      => null
  );
end;
$function$;

create or replace function app.update_person_fields_impl(p_actor uuid, p_user uuid, p_full_name text, p_professional_category_id uuid, p_set_cpf boolean, p_cpf text, p_set_date_of_birth boolean, p_date_of_birth date, p_set_phone boolean, p_phone text)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_org         uuid;
  v_cur         record;
  v_cpf_norm    text;
  v_phone_norm  text;
  v_cpf_changed boolean;
  v_fields      text[];
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.can_administer_person_for('fields', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Authority has already been proven over this person, so the row exists.
  -- AE2.4 inc 3: `home_organization_id` left this select list; the audit organisation is
  -- resolved from the affiliation substrate instead.
  select pr.full_name, pr.professional_category_id,
         pr.cpf, pr.date_of_birth, pr.phone
    into v_cur
    from public.profiles pr
   where pr.id = p_user;
  v_org := app.person_audit_organization(p_actor, p_user);

  -- ⛔ NORMALISE ONCE, THEN COMPARE **AND** WRITE THE SAME VALUE. The design specified
  -- digits-only normalisation for the COMPARISON only, and pgTAP 385 §1.5 caught what
  -- that leaves open: a formatted CPF ('111.444.777-35') normalises EQUAL to the stored
  -- one — so it is correctly NOT a change and correctly does not escalate to the SUBSET
  -- arm — and was then stored verbatim, tripping `profiles_cpf_valid` (`^[0-9]{11}$`).
  -- The recorded lesson runs in this direction too: a WRITER that disagrees with its own
  -- comparison is the defect. These two expressions are exactly `normalizeCpf(x) || null`
  -- and `phone.replace(/\D/g,'') || null` from the TS half.
  v_cpf_norm   := nullif(regexp_replace(coalesce(p_cpf, ''),   '\D', '', 'g'), '');
  v_phone_norm := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');

  v_cpf_changed := coalesce(p_set_cpf, false)
    and nullif(regexp_replace(coalesce(v_cur.cpf, ''), '\D', '', 'g'), '')
        is distinct from v_cpf_norm;

  if v_cpf_changed and not app.can_administer_person_for('cpf_change', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  v_fields := array_remove(array[
    case when p_full_name is distinct from v_cur.full_name then 'full_name' end,
    case when p_professional_category_id is distinct from v_cur.professional_category_id
         then 'professional_category_id' end,
    case when coalesce(p_set_cpf, false) and v_cpf_norm is distinct from v_cur.cpf then 'cpf' end,
    case when coalesce(p_set_date_of_birth, false)
          and p_date_of_birth is distinct from v_cur.date_of_birth then 'date_of_birth' end,
    case when coalesce(p_set_phone, false) and v_phone_norm is distinct from v_cur.phone
         then 'phone' end
  ], null);

  update public.profiles
     set full_name                = p_full_name,
         professional_category_id = p_professional_category_id,
         cpf           = case when coalesce(p_set_cpf, false) then v_cpf_norm else cpf end,
         date_of_birth = case when coalesce(p_set_date_of_birth, false)
                              then p_date_of_birth else date_of_birth end,
         phone         = case when coalesce(p_set_phone, false) then v_phone_norm else phone end
   where id = p_user;

  perform app.audit_write(
    p_action        => 'person.fields_updated',
    p_entity_type   => 'profile',
    p_entity_id     => p_user,
    p_commission    => null,
    p_summary       => 'Dados pessoais atualizados',
    -- ⛔ the NAMES of the changed columns, never their values (Rule 11 / Rule 12).
    p_metadata      => jsonb_build_object(
                         'actor_user_id', p_actor,
                         'fields', to_jsonb(coalesce(v_fields, array[]::text[])),
                         'cpf_changed', v_cpf_changed),
    p_organization  => v_org,
    p_hospital      => null
  );
end;
$function$;

create or replace function app.upsert_credential_impl(p_actor uuid, p_user uuid, p_id uuid, p_issuing_country text, p_issuing_state text, p_issuing_authority text, p_registration_number text, p_expires_on date)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_org uuid;
  v_id  uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.can_administer_person_for('credentials', p_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  v_org := app.person_audit_organization(p_actor, p_user);

  if p_id is null then
    insert into public.professional_credentials (
      user_id, issuing_country, issuing_state, issuing_authority,
      registration_number, expires_on
    ) values (
      p_user, p_issuing_country, p_issuing_state, p_issuing_authority,
      p_registration_number, p_expires_on
    )
    returning id into v_id;

    perform app.audit_write(
      p_action       => 'credential.created',
      p_entity_type  => 'credential',
      p_entity_id    => v_id,
      p_commission   => null,
      p_summary      => 'Registro profissional criado',
      p_metadata     => jsonb_build_object(
                          'actor_user_id', p_actor,
                          'credential_id', v_id,
                          'user_id', p_user),
      p_organization => v_org,
      p_hospital     => null
    );
    return v_id;
  end if;

  update public.professional_credentials
     set issuing_country     = p_issuing_country,
         issuing_state       = p_issuing_state,
         issuing_authority   = p_issuing_authority,
         registration_number = p_registration_number,
         expires_on          = p_expires_on,
         verified_at         = null,
         updated_at          = now()
   where id = p_id
     and user_id = p_user
  returning id into v_id;

  if v_id is null then
    -- POST-AUTHORITY (design F-B). Not an oracle: authority over `p_user` is already
    -- proven above, so "that registration is not this person's" tells the caller nothing
    -- they did not already have.
    raise exception 'registro profissional não encontrado para esta pessoa'
      using errcode = 'HC0T6';
  end if;

  perform app.audit_write(
    p_action       => 'credential.updated',
    p_entity_type  => 'credential',
    p_entity_id    => v_id,
    p_commission   => null,
    p_summary      => 'Registro profissional atualizado',
    p_metadata     => jsonb_build_object(
                        'actor_user_id', p_actor,
                        'credential_id', v_id,
                        'user_id', p_user,
                        'changed', to_jsonb(array[
                          'issuing_country', 'issuing_state', 'issuing_authority',
                          'registration_number', 'expires_on', 'verified_at'])),
    p_organization => v_org,
    p_hospital     => null
  );
  return v_id;
end;
$function$;

create or replace function app.delete_credential_impl(p_actor uuid, p_credential uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_user uuid;
  v_org  uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  select pc.user_id into v_user
    from public.professional_credentials pc
   where pc.id = p_credential;

  if v_user is null
     or not app.can_administer_person_for('credentials', v_user, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- The subject is the credential's OWNER, not the actor — attribution follows the person
  -- whose record changed, exactly as the column read it did.
  v_org := app.person_audit_organization(p_actor, v_user);

  delete from public.professional_credentials where id = p_credential;

  perform app.audit_write(
    p_action       => 'credential.deleted',
    p_entity_type  => 'credential',
    p_entity_id    => p_credential,
    p_commission   => null,
    p_summary      => 'Registro profissional removido',
    p_metadata     => jsonb_build_object(
                        'actor_user_id', p_actor,
                        'credential_id', p_credential,
                        'user_id', v_user),
    p_organization => v_org,
    p_hospital     => null
  );
end;
$function$;

create or replace function app.finalize_invited_person_impl(p_actor uuid, p_user uuid, p_full_name text, p_professional_category_id uuid, p_cpf text, p_date_of_birth date, p_phone text, p_must_change_password boolean)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_org uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  if not app.can_administer_person_for('cpf_change', p_user, p_actor) then
    -- Also the not-found answer (design F-B): a missing person and an unauthorized
    -- caller are indistinguishable here, deliberately.
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  v_org := app.person_audit_organization(p_actor, p_user);

  -- ⚠ NORMALISED ON THE WRITE, mirroring `registerUser`'s own coercions
  -- (`normalizeCpf(...) || null`, `phone.replace(/\D/g,'') || null`). See
  -- `app.update_person_fields_impl` for why the WRITER must normalise and not only the
  -- comparison: pgTAP 385 §1.5 found a formatted CPF tripping `profiles_cpf_valid`.
  update public.profiles
     set full_name                = p_full_name,
         professional_category_id = p_professional_category_id,
         cpf                      = nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), ''),
         date_of_birth            = p_date_of_birth,
         phone                    = nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
         must_change_password     = coalesce(p_must_change_password, false)
   where id = p_user;

  perform app.audit_write(
    p_action        => 'person.registered',
    p_entity_type   => 'profile',
    p_entity_id     => p_user,
    p_commission    => null,
    p_summary       => 'Cadastro de pessoa finalizado',
    p_metadata      => jsonb_build_object(
                         'actor_user_id', p_actor,
                         'must_change_password', coalesce(p_must_change_password, false)),
    p_organization  => v_org,
    p_hospital      => null
  );
end;
$function$;
