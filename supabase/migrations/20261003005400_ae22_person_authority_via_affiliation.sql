-- ============================================================================
-- AE2.2 — person authority re-predicated off `profiles.home_organization_id`
--         onto the `organization_affiliations` substrate.
--
-- Plan: docs/plans/authz-evolution.md § AE2.2 (ADR 0155 D8/D3)
-- Ruling implemented: ADR 0163 — last-org retention, four bounds
--                     ⚠ This line read "SUBSET-bounded" until 2026-08-28. ADR 0163
--                     Amendment 1 § 1 RETIRED that wording: retention is CAPABILITY-BLIND
--                     — `app.person_authority_orgs` takes no capability argument and
--                     cannot be capability-bounded. The label outlived the decision it
--                     named (QA finding M5).
-- Census consumed:   docs/design/authz-ae2-home-org-consumer-census.md (3 RLS legs)
-- Keystone:          supabase/tests/390_ae22_person_authority_via_affiliation.sql
--                    (written first; observed RED — §A could not resolve the
--                     functions, §B7 read 3 policies still naming the column)
--
-- ----------------------------------------------------------------------------
-- PER-LEG CONTRACT — old predicate -> new predicate, verbatim.
-- AE2.3's widening differential consumes this table.  All three are SELECT,
-- all three carry the column in exactly ONE OR-leg, and NO policy in the
-- database carries it in `with_check` (measured, not assumed).
-- ----------------------------------------------------------------------------
--
-- LEG 1 — public.profiles / profiles_admin_select (SELECT)
--   old: ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))
--   new: app.can_administer_person_via_affiliation(profiles.id)
--
-- LEG 2 — public.profiles / profiles_select_self_or_admin (SELECT)
--   old: ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))
--   new: app.can_administer_person_via_affiliation(profiles.id)
--
-- LEG 3 — public.professional_credentials / professional_credentials_select (SELECT)
--   old: (EXISTS ( SELECT 1
--            FROM profiles p
--           WHERE ((p.id = professional_credentials.user_id)
--             AND (p.home_organization_id IS NOT NULL)
--             AND app.is_org_admin_of(p.home_organization_id))))
--   new: app.can_administer_person_via_affiliation(professional_credentials.user_id)
--
-- Every OTHER arm of all three policies is reproduced BYTE-FOR-BYTE from the
-- live catalog below.  The duplication between the two `profiles` policies is
-- deliberate and load-bearing for DETECTION, not authorization: both are
-- permissive and OR'd, so widening either alone makes every ALLOW arm pass, and
-- 371_offboarded_person_visibility.sql § 5 pins the leg in EACH policy BY NAME
-- so a half-applied migration is distinguishable from a fully-applied one.
-- ⛔ Do not "de-duplicate" these two quals — see 387's header (migration
-- 20261003004700, written, measured as identity, and WITHDRAWN for this reason).
--
-- ----------------------------------------------------------------------------
-- WHY TWO FUNCTIONS AND NOT ONE — ADR 0155 D3 made structural
-- ----------------------------------------------------------------------------
-- AE2.5 makes this binding text: "Affiliations (hospital_affiliations,
-- organization_affiliations) are visibility and lifecycle inputs. They NEVER
-- grant capabilities; no policy or door may treat an affiliation row as a
-- positive authorization source."
--
-- Read naively, ADR 0163 looks like a counterexample — an ENDED affiliation row
-- decides who may administer an offboarded person.  It is not one, but only
-- because the predicate is built this way round, and the wrong way round
-- type-checks just as well:
--
--   app.person_authority_orgs(person)  LOCATES.  It resolves WHICH organizations
--       are in scope for this person.  ⭐ Its body contains NO caller term at
--       all — it does not know who is asking, so it cannot grant anything.
--   app.is_org_admin_of(org)           GRANTS.  A MEMBERSHIP check, applied to
--       the organization the affiliation located.
--
-- ⛔ FORBIDDEN SHAPE, stated so it cannot be reintroduced by an edit that looks
--    local: any predicate whose truth follows from the existence or properties
--    of an affiliation row alone — "the caller and the target share an
--    affiliation", or folding the CALLER's own affiliation into the grant.
--    That makes the row a positive authorization source and breaks D3.
--    Keystone: 390 § D10 — a principal sharing an active affiliation with the
--    subject, holding no org_admin membership, must get FALSE.
--
-- ----------------------------------------------------------------------------
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- ----------------------------------------------------------------------------
-- 1. It does not touch `profiles.home_organization_id` — not the column, not
--    `attnotnull`, not its values.  That is AE2.4.
-- 2. It does not re-predicate `public.assert_profile_tenant_has_org` (the tenant
--    containment trigger).  Ruled T3 by the lead, 2026-08-27, because the
--    dependency is CIRCULAR: `app.affiliate_person_to_org_impl` — the door that
--    CREATES an organization affiliation — is itself gated on the column
--    (`if v_person_org is null or v_person_org is distinct from p_organization
--    then raise … HC0R0`), and `handle_new_user` inserts the profile in the
--    `auth.users` transaction while the affiliation is created in a LATER,
--    SEPARATE PostgREST transaction.  A deferred constraint trigger fires at
--    COMMIT of its own transaction; deferral buys nothing across two.  Both
--    halves have to break in one move, and that move is AE2.4.
--    ⚠ CONSEQUENCE, STATED RATHER THAN LEFT AS AN ABSENCE: that trigger body is
--    `prosecdef = f` (SECURITY INVOKER).  It is harmless today ONLY because it
--    reads no table — a pure NULL check on `new`.  The moment it is given a read
--    of `organization_affiliations` it runs under the caller's RLS against a
--    policy that is `principal_id = auth.uid() OR app.is_org_admin_of(...)` with
--    NO hospital tier by design (ADR 0151 D1), and reproduces
--    BUG-D5-REHIRE-HOSPADMIN-001 for every `hospital_admin`, unconditionally.
--    ⛔ Whoever gives it that read MUST change its security context in the SAME
--    migration.  This one gives it no read, so no context change is owed here.
-- 3. It does not add an `expires_at` term.  ADR 0151 D6 ruled it out and
--    FUP-AFF2-ACTIVE-MEANS-TWO-THINGS is open on the PO's call.  "Active" here
--    is `ended_on IS NULL AND voided_at IS NULL` — the uniform convention of all
--    15 function bodies in `app`+`public` that mention `ended_on`, every one of
--    which uses `IS NULL` and none of which uses a date comparison.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1 of 2 — LOCATE.  Which organizations are in scope for this person?
--
-- No caller term.  No grant.  ADR 0163's four bounds live here and nowhere else.
-- ----------------------------------------------------------------------------
create or replace function app.person_authority_orgs(p_person uuid)
returns table (organization_id uuid)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  -- ARM 1 — ACTIVE affiliations.  The ordinary case, and the only one that
  -- exists for a person who is currently employed anywhere.
  select oa.organization_id
    from public.organization_affiliations oa
   where oa.principal_id = p_person
     and oa.ended_on  is null
     and oa.voided_at is null

  union

  -- ARM 2 — ADR 0163 LAST-ORG RETENTION.  Fires ONLY when arm 1 is empty (the
  -- `not exists` below): a person with an active affiliation is administered
  -- through that, and an ended row must not add reach on top of it (bound 3 —
  -- retention grants nothing beyond what an active-affiliation org_admin holds).
  select oa.organization_id
    from public.organization_affiliations oa
   where oa.principal_id = p_person
     -- BOUND 1 — VOID IS NOT END.  A voided row is "was never true" and is
     -- excluded from the derivation ENTIRELY.  ⚠ Note WHERE this sits: it
     -- filters BEFORE the `max()` below is computed, and it is repeated inside
     -- that subquery for the same reason.  Taking max(ended_on) over all ended
     -- rows and filtering voided afterwards yields EMPTY for a person whose
     -- voided row happens to end later than their real one — a silent, total
     -- loss of authority.  Keystone: 390 § C7 constructs exactly that pair.
     and oa.voided_at is null
     and oa.ended_on is not null
     and not exists (
           select 1
             from public.organization_affiliations act
            where act.principal_id = p_person
              and act.ended_on  is null
              and act.voided_at is null)
     -- BOUND 2 — MOST RECENT BY `ended_on`, AND TIES YIELD **ALL** TIED ORGS.
     -- ⛔ This is `= max(...)`, not `order by ended_on desc limit 1`, and the
     -- difference is the whole bound.  Two affiliations ending the same day
     -- yield two retaining organizations; an arbitrary tie-break would pick one
     -- and that is a NARROWING no test would notice, because AE2.3's
     -- differential only pre-declares WIDENINGS.  Do not "simplify" this to a
     -- LIMIT.  Keystone: 390 § C5 / § D9.
     and oa.ended_on = (
           select max(m.ended_on)
             from public.organization_affiliations m
            where m.principal_id = p_person
              and m.voided_at is null
              and m.ended_on is not null);
$$;

comment on function app.person_authority_orgs(uuid) is
  'AE2.2 / ADR 0163 — LOCATES the organizations in scope for a person: active affiliations, or (only when there are none) the most recent ENDED non-voided ones, ALL of them on an ended_on tie. Voided rows are excluded entirely. Carries NO caller term and therefore NO authorization decision: the grant is app.is_org_admin_of, applied separately by app.can_administer_person_via_affiliation (ADR 0155 D3). NOT granted to authenticated on purpose — a row-returning DEFINER would let any caller enumerate any person''s organizations by id.';

-- ----------------------------------------------------------------------------
-- STEP 2 of 2 — GRANT.  Is the CALLER an org_admin of one of those orgs?
--
-- The membership check is a separate, visible conjunct applied to the org the
-- affiliation located.  ⛔ Do not collapse these two steps into one join whose
-- result is the grant, even though it is cheaper: that is the forbidden shape
-- described in the header, and it breaks ADR 0155 D3 the moment AE2.5 lands.
-- ----------------------------------------------------------------------------
create or replace function app.can_administer_person_via_affiliation(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
      from app.person_authority_orgs(p_person) as located
     where app.is_org_admin_of(located.organization_id)
  );
$$;

comment on function app.can_administer_person_via_affiliation(uuid) is
  'AE2.2 / ADR 0163 + ADR 0155 D3 — may the CALLER administer this person at the organization tier? The affiliation LOCATES the organizations (app.person_authority_orgs); the caller''s org_admin MEMBERSHIP GRANTS (app.is_org_admin_of). Replaces the `home_organization_id IS NOT NULL AND app.is_org_admin_of(home_organization_id)` leg of profiles_admin_select, profiles_select_self_or_admin and professional_credentials_select.';

-- ----------------------------------------------------------------------------
-- ACLs.  Asserted positively in 390 § A5/A6/A11/A12 via has_function_privilege,
-- never by reading `proacl` for absence — a NULL `proacl` includes PUBLIC.
-- ----------------------------------------------------------------------------
revoke all on function app.person_authority_orgs(uuid) from public;
revoke all on function app.can_administer_person_via_affiliation(uuid) from public;

-- The locator stays owner-only: it is reached exclusively through the predicate
-- below, which is DEFINER and therefore executes it as the owner regardless of
-- who called.  Granting it would add a row-returning door for no caller.
grant execute on function app.can_administer_person_via_affiliation(uuid)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- LEG 1 — public.profiles / profiles_admin_select
-- ----------------------------------------------------------------------------
alter policy profiles_admin_select on public.profiles
  using (
    app.is_admin()
    -- AE2.2: was ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))
    or app.can_administer_person_via_affiliation(profiles.id)
    or (exists ( select 1
                   from memberships cm
                   join commissions c on c.id = cm.commission_id
                  where cm.commission_id is not null
                    and cm.principal_id = profiles.id
                    and app.is_tenancy_admin_of(c.id)))
    or (exists ( select 1
                   from hospital_affiliations ha
                  where ha.principal_id = profiles.id
                    and ha.voided_at is null
                    and app.is_hospital_admin_of(ha.hospital_id)))
    or (exists ( select 1
                   from memberships hm
                   left join commissions hc on hc.id = hm.commission_id
                  where hm.principal_id = profiles.id
                    and coalesce(hm.hospital_id, hc.hospital_id) is not null
                    and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id))))
  );

-- ----------------------------------------------------------------------------
-- LEG 2 — public.profiles / profiles_select_self_or_admin
--
-- ⚠ `(select auth.uid())` and not `auth.uid()`: AE1.5 (migration
-- 20261003004710) hoisted every `auth.uid()` in this hot subset to an InitPlan.
-- Writing the bare call here would silently un-hoist it.
-- ----------------------------------------------------------------------------
alter policy profiles_select_self_or_admin on public.profiles
  using (
    id = (select auth.uid())
    -- AE2.2: was ((home_organization_id IS NOT NULL) AND app.is_org_admin_of(home_organization_id))
    or app.can_administer_person_via_affiliation(profiles.id)
    or (exists ( select 1
                   from memberships cm
                   join commissions c on c.id = cm.commission_id
                  where cm.commission_id is not null
                    and cm.principal_id = profiles.id
                    and app.is_tenancy_admin_of(c.id)))
    or (app.is_active((select auth.uid()))
        and (exists ( select 1
                        from memberships them
                       where them.commission_id is not null
                         and them.principal_id = profiles.id
                         and app.is_member_of(them.commission_id))))
    or (exists ( select 1
                   from hospital_affiliations ha
                  where ha.principal_id = profiles.id
                    and ha.voided_at is null
                    and app.is_hospital_admin_of(ha.hospital_id)))
    or (exists ( select 1
                   from memberships hm
                   left join commissions hc on hc.id = hm.commission_id
                  where hm.principal_id = profiles.id
                    and coalesce(hm.hospital_id, hc.hospital_id) is not null
                    and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id))))
  );

-- ----------------------------------------------------------------------------
-- LEG 3 — public.professional_credentials / professional_credentials_select
--
-- ⚠ PRE-DECLARED AE2.3 DIFFERENTIAL CELL (lead-accepted 2026-08-27, an argument
-- rather than a measurement): the OLD leg ran its `profiles` sub-select under
-- the CALLER's RLS, so the caller had to be able to SEE the profiles row as
-- well.  The new call is SECURITY DEFINER, which removes that implicit second
-- gate.  The two sets are believed to coincide — anyone the new predicate
-- admits is also admitted by the re-predicated profiles_admin_select, so the
-- profiles row was visible anyway — but AE2.3 carries this as a widening
-- CANDIDATE and measures it.  ⛔ It is not asserted away here.
-- ----------------------------------------------------------------------------
alter policy professional_credentials_select on public.professional_credentials
  using (
    user_id = (select auth.uid())
    or app.is_admin()
    -- AE2.2: was (EXISTS (SELECT 1 FROM profiles p WHERE p.id = professional_credentials.user_id
    --              AND p.home_organization_id IS NOT NULL
    --              AND app.is_org_admin_of(p.home_organization_id)))
    or app.can_administer_person_via_affiliation(professional_credentials.user_id)
    or (exists ( select 1
                   from hospital_affiliations ha
                  where ha.principal_id = professional_credentials.user_id
                    and ha.voided_at is null
                    and app.is_hospital_admin_of(ha.hospital_id)))
    or (exists ( select 1
                   from memberships hm
                   left join commissions hc on hc.id = hm.commission_id
                  where hm.principal_id = professional_credentials.user_id
                    and coalesce(hm.hospital_id, hc.hospital_id) is not null
                    and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id))))
  );
