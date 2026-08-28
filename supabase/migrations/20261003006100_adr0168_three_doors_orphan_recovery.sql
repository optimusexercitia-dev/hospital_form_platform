-- ADR 0168 (+ Amendment 1, PO-ruled 2026-08-28) — ORPHAN RECOVERY IS ITS OWN DOOR.
-- Amends ADR 0165 (its M11 widening is SPLIT, not accepted) and restores ADR 0133's
-- SUBSET bound for the one population where it silently dissolved.
--
-- ============================================================================
-- WHAT THIS MIGRATION DOES, IN ONE PARAGRAPH
-- ============================================================================
-- Today `app.affiliate_person_to_org_impl` and `app.affiliate_person_impl` carry the
-- SAME containment predicate: *"known HERE, or known NOWHERE"*.  The second disjunct is
-- the widening ADR 0168 refuses — an anchorless person has zero non-voided affiliation
-- rows, so the whole check falls through and ANY org or hospital admin holding their
-- uuid may claim them.  Claiming them yields a Class-2 professional-identity read and
-- then `cpf_change` + `lifecycle`, because a freshly-claimed person's footprint is
-- EXACTLY the claiming hospital, so ADR 0133's SUBSET bound and its INTERSECTION bound
-- coincide.  ⚠ Architecture Rule 13 is NOT violated — membership still grants,
-- affiliation still locates.  The defect is a different property: **the locating fact
-- became self-servable by the same actor who then exercises the grant.**
--
-- This migration splits that one predicate across THREE doors:
--
--   1. ORDINARY   (`affiliate_person_to_org_impl` / `affiliate_person_impl`)
--                 NARROWED to *"known here"* only.  Tenant tier, unchanged ACLs.
--   2. CREATION   (`affiliate_new_person_to_org_impl` / `affiliate_new_person_impl`)
--                 NEW.  Today's semantics preserved verbatim, behind a `service_role`
--                 ACL and its own audit verb.  Called by the two registrars.
--   3. RECOVERY   (`recover_orphan_person_to_org_impl`)
--                 NEW.  `platform_admin`-only, STRICTLY anchorless, own audit verb.
--
-- ============================================================================
-- ⭐ WHY THE CREATION DOORS KEEP THE WIDE PREDICATE RATHER THAN REQUIRING ANCHORLESS
--    — LOAD-BEARING, DO NOT "TIGHTEN" THIS LATER WITHOUT READING IT
-- ============================================================================
-- On the org_admin registration path `registerUser` calls the ORG creation door FIRST
-- and the HOSPITAL creation door SECOND.  By the second call the person is ALREADY
-- KNOWN to that organisation — the first call just made them so.  A strict
-- `anchorless`-only creation door would therefore REFUSE the second call and break
-- org_admin registration outright.
--
-- So the creation door's bound is NOT its state predicate.  It is:
--   (a) its **ACL** — `service_role` only, unreachable from PostgREST by any tenant
--       user, which is ADR 0168 Amdt 1's own diagnosis: *"the door's ACL is the only
--       durable discriminator left"*; and
--   (b) its **audit verb** — `…created_on_registration`, which makes the act legible in
--       the trail whether or not anyone later re-reads this comment.
-- Keeping BOTH creation doors on ONE shared predicate is also what lets pgTAP 393's
-- sibling pin stay a 2-doors-1-predicate-set statement per family.
--
-- ============================================================================
-- ⭐ WHY RECOVERY IS ORG TIER ONLY — A MEASURED BOUND, NOT AN OMISSION
-- ============================================================================
-- Recovering an orphan gives them an ORG anchor.  Once anchored,
-- `app.person_known_to_org` is TRUE for that organisation, so the ORDINARY hospital
-- door admits them normally on the very next call.  A hospital-tier recovery door
-- would therefore be a second way to do what the ordinary hospital door already does
-- after recovery — a sibling that adds an ACL surface and no capability.
--
-- ============================================================================
-- ⚖ RULING (lead, 2026-08-28) ON `public.affiliate_person_to_org`
-- ============================================================================
-- ADR 0168 Amdt 1's third cost: it holds `authenticated` EXECUTE with ZERO production
-- TypeScript callers.  **RULED: KEEP the `authenticated` grant.**  Reasons:
--   • it is the org-tier ORDINARY door, symmetric with `public.affiliate_person`;
--   • after this migration it carries the NARROW predicate, so the exposure Amdt 1
--     named is closed BY THE NARROWING rather than by the grant; and
--   • revoking it would delete real exercised coverage of the org-tier authority arm
--     (pgTAP `379 § 2`, `§ 5.1`, `380`, and `303_dominance_grid` names it) in exchange
--     for a surface reduction on a door that is no longer wide.
-- Its ACL is NOT changed here, and pgTAP `398 § 1` PINS the grant so this is recorded
-- as a decision rather than surviving as an accident.
--
-- ============================================================================
-- ⚠ TWO DELIBERATE SECOND EXPRESSIONS OF THE ANCHORLESS PREDICATE — DO NOT UNIFY
-- ============================================================================
-- `app.tenant_orphan_profiles()` already contains the anchorless predicate INLINE, and
-- is deliberately left untouched by this increment.  It is a DIFFERENT QUESTION: it
-- also carries `not p.is_admin`, because the one legitimately-anchorless profile in the
-- estate is the platform_admin, and a detector that flagged it would flag it forever.
-- `app.person_is_anchorless` is the raw state predicate with no `is_admin` arm, because
-- the doors below must refuse a platform_admin's own profile no differently from
-- anyone else's.  Unifying them would silently give the detector a door's semantics or
-- the doors a detector's exemption.  pgTAP `393 § 1.1-1.7` pins the detector's side.
--
-- ============================================================================
-- ⚠ ONE DELIBERATE ADDITION beyond the three doors: the RECOVERY door checks that the
--    target organisation EXISTS (`HC0R5 organização inexistente`).  The ordinary org
--    door gets this for free — `app.is_org_admin_of_for` is false for a non-existent
--    organisation, and the 42501 conflation is correct there.  The recovery door's
--    authority arm is `app.is_admin_for`, which is org-independent, so without this
--    guard a typo'd uuid reaches the caller as a raw 23503 FK violation.  There is no
--    tenancy oracle concern: by the ADR 0041 noun rule a platform_admin ADMINISTERS
--    tenancy and can already enumerate every organisation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- § 1  THE TWO NAMED PREDICATES.
--   Named, rather than inlined, so the sibling pin in pgTAP 393 § 5.7 can key on a
--   NAME instead of on the predicate's SHAPE.  The old pin normalised the SQL text of
--   an inline `if exists (…)` and asserted "2 doors, 1 distinct predicate"; any rewrite
--   of that text — including this one — makes such a needle stop matching, and a needle
--   edited to fit is a pin that has stopped pinning.  A named call is a stable needle.
--
--   Gating MIRRORS `app.person_authority_orgs` / `app.tenant_orphan_profiles`, measured
--   from the catalog: `prosecdef = t`, `proacl = {postgres=X/postgres}`.  DEFINER
--   because they must see affiliation rows no single admin can (the SELECT policy on
--   `organization_affiliations` has no cross-org arm, ADR 0151 D1) and owner-only
--   because a boolean oracle over "does this uuid have tenancy anywhere" reachable by
--   `authenticated` is an enumeration primitive over `profiles.id`.
-- ---------------------------------------------------------------------------
create or replace function app.person_known_to_org(p_user uuid, p_organization uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  -- ⚠ NON-VOIDED, not ACTIVE.  An ENDED, non-voided row still means "known here" —
  -- ADR 0163 bound 1, void is not end.  That is what makes ADR 0151 D5's one-step
  -- rehire work through the ordinary door with no org_admin ticket first.
  select exists (
    select 1
      from public.organization_affiliations oa
     where oa.principal_id = p_user
       and oa.voided_at is null
       and oa.organization_id = p_organization
  );
$$;

create or replace function app.person_is_anchorless(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  -- The raw state predicate: ZERO non-voided organisation affiliations of ANY tense.
  -- ⛔ NO `is_admin` arm — see the header.  This asks about affiliation state and
  -- nothing else, so a platform_admin's own profile answers TRUE here and that is
  -- correct: the doors below must not treat it specially.
  select not exists (
    select 1
      from public.organization_affiliations oa
     where oa.principal_id = p_user
       and oa.voided_at is null
  );
$$;

revoke all on function app.person_known_to_org(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function app.person_is_anchorless(uuid)
  from public, anon, authenticated, service_role;

comment on function app.person_known_to_org(uuid, uuid) is
  'ADR 0168 § Decision 1. The ORDINARY doors'' whole containment predicate: the person '
  'has at least one NON-VOIDED organisation affiliation in THIS organisation. Named so '
  'pgTAP 393 § 5.7 can pin the sibling doors on a NAME rather than on SQL text.';
comment on function app.person_is_anchorless(uuid) is
  'ADR 0168. Zero non-voided organisation affiliations anywhere. Used by the CREATION '
  'doors (in disjunction with person_known_to_org) and, ALONE, by the RECOVERY door. '
  '⚠ Deliberately distinct from app.tenant_orphan_profiles(), which asks a different '
  'question by also excluding is_admin — see this migration''s header.';

-- ---------------------------------------------------------------------------
-- § 2  THE ORDINARY DOORS — NARROWED.  ADR 0168 § Decision 1.
--   ⛔ EVERYTHING ELSE IN THESE BODIES IS UNCHANGED: the `if not found` on `profiles`
--      stays and still conflates not-found with wrong-org, the `is_active` HC0R4 check
--      stays, the idempotent branches stay, D5's org-parent ensure stays.
-- ---------------------------------------------------------------------------
create or replace function app.affiliate_person_to_org_impl(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date default null)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_person_active boolean;
  v_existing      uuid;
  v_id            uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- AUTHORITY (D2). org_admin of THAT organisation, and nothing else: no platform_admin
  -- arm (the noun rule — platform_admin administers tenancy and identity, not employment)
  -- and no hospital_admin arm (a hospital admin has no claim at the organisation tier).
  -- A non-existent organisation also fails here, which is correct: it is indistinguishable
  -- from one the caller does not administer.
  if not app.is_org_admin_of_for(p_organization, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- TENANT CHECK (ADR 0151 D11; re-expressed by ADR 0164; NARROWED by ADR 0168 D1).
  -- ⚠ "not found" and "wrong organisation" are DELIBERATELY the same error: splitting
  -- them makes this door a cross-tenant existence oracle over `profiles.id` for any
  -- admin of any tenant. The explicit `if not found` below is what KEEPS them
  -- conflated, now that the predicate no longer reads a column that happens to be NULL
  -- for a person who does not exist.
  --
  -- ⛔ ADR 0168 — THE BRANCH THAT USED TO LIVE HERE IS GONE, NOT MOVED IN PLACE. The
  -- predicate was `known HERE, or known NOWHERE`. The second disjunct admitted an
  -- ANCHORLESS person — zero non-voided rows, so the EXISTS was false and the whole
  -- check fell through — to ANY org admin holding their uuid. That is the widening ADR
  -- 0165 § M11 recorded as unaccepted and ADR 0168 SPLIT rather than accepted:
  --   • a just-created person is now the CREATION door's business
  --     (`app.affiliate_new_person_to_org_impl`, `service_role`-only), and
  --   • a pre-existing orphan is now the RECOVERY door's
  --     (`app.recover_orphan_person_to_org_impl`, `platform_admin`-only).
  -- ⚠ After ADR 0164 drops `home_organization_id` no predicate over DB STATE can
  -- separate those two populations — which is exactly why the split had to be over
  -- DOORS. Do NOT "restore" the disjunct here; it would re-dissolve ADR 0133's SUBSET
  -- bound for every freshly-claimed person.
  --
  -- WHAT SURVIVES, and what each arm exists for:
  --   • a person ALREADY KNOWN to this organisation by any NON-VOIDED tense may be
  --     affiliated — that is one-step rehire (ADR 0151 D5) and the door's own idempotent
  --     path for a person active in more than one organisation;
  --   • everyone else is refused, INCLUDING a person with no tenancy at all.
  -- ⚠ "known to this organisation" deliberately INCLUDES ended rows and deliberately
  --   EXCLUDES voided ones — ADR 0163 bound 1, void is not end.
  -- ⛔ Do NOT "simplify" this to "no affiliation outside <org>": that breaks the
  --   idempotent path for every multi-org person, a NARROWING pgTAP 393 § 3 pins as W8.
  select is_active into v_person_active
  from public.profiles where id = p_user;

  if not found then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  if not app.person_known_to_org(p_user, p_organization) then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- `profiles.is_active`, the MASTER SWITCH — not `app.is_active`, which also folds
  -- `suspended_until`. A suspension is temporary and reversible; refusing to record
  -- someone's employment because they are suspended this week would turn an HR record
  -- into a disciplinary one.
  if not coalesce(v_person_active, false) then
    raise exception 'conta desativada' using errcode = 'HC0R4';
  end if;

  -- Idempotent over the ACTIVE row (D6). The partial unique would reject a duplicate
  -- anyway, and a 23505 surfacing as a generic pt-BR error is a worse answer.
  select id into v_existing
  from public.organization_affiliations
  where principal_id = p_user and organization_id = p_organization
    and ended_on is null and voided_at is null;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.organization_affiliations
    (principal_id, organization_id, started_on, created_by)
  values
    (p_user, p_organization, coalesce(p_started_on, current_date), p_actor)
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function app.affiliate_person_impl(
  p_actor uuid, p_user uuid, p_hospital uuid,
  p_employee_id text default null, p_started_on date default null,
  p_job_title text default null, p_work_email text default null, p_work_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_org        uuid;
  v_existing   uuid;
  v_id         uuid;
  v_person_active boolean;
  v_emp        text := nullif(btrim(coalesce(p_employee_id, '')), '');
  -- D9 staff data, normalised exactly as `v_emp` is: blank means "the box was empty",
  -- which is not a fact, and the not-blank CHECKs would reject it anyway.
  --
  -- text, NOT extensions.citext, and deliberately: the COLUMN stays citext so
  -- comparison semantics are unchanged, but a citext PARAMETER would have to resolve at
  -- CREATE time against the session search_path — the exact 42704 that bit
  -- 20260911000600 on the remote db-push role. A text parameter assigned to a citext
  -- column casts implicitly and loses nothing.
  v_job        text := nullif(btrim(coalesce(p_job_title, '')), '');
  v_wemail     text := nullif(btrim(coalesce(p_work_email, '')), '');
  v_wphone     text := nullif(btrim(coalesce(p_work_phone, '')), '');
  v_org_aff    uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'HC0R5';
  end if;

  -- AUTHORITY (D13). No `is_admin_for` arm: platform_admin administers tenancy and
  -- identity, but no decision of record extends that to employment rows.
  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- TENANT CHECK (ADR 0151 D13; re-expressed by ADR 0164; NARROWED by ADR 0168 D1).
  -- ⚠ "not found" and "wrong organisation" are DELIBERATELY the same error: splitting
  -- them makes this door a cross-tenant existence oracle over `profiles.id` for any
  -- admin of any tenant. The explicit `if not found` below is what KEEPS them conflated.
  --
  -- ⛔ ADR 0168 — SAME NARROWING AS THE ORG SIBLING, IN THE SAME MIGRATION. The
  -- anchorless disjunct is gone from BOTH bodies; splitting identical siblings across
  -- increments is exactly how this phase produced "one axis was swept, its sibling was
  -- not" three times. ⭐ AND AT THIS TIER THE DISJUNCT WAS THE WHOLE EXPOSURE: ADR 0168
  -- Amdt 1's TypeScript closure found ONE client-supplied call site —
  -- `src/lib/affiliations/actions.ts:214`, on the `authenticated` client, with zero
  -- TypeScript authorization BY EXPLICIT DESIGN — and it lands here.
  -- The replacements are `app.affiliate_new_person_impl` (`service_role`, registration)
  -- and `app.recover_orphan_person_to_org_impl` (`platform_admin`, org tier only —
  -- once anchored, THIS door admits the person normally).
  --
  -- WHAT SURVIVES: a person already known to this hospital's organisation by any
  -- NON-VOIDED tense. That keeps ADR 0151 D5 one-step rehire and the idempotent path.
  -- ⚠ NON-VOIDED includes ENDED and excludes VOIDED — ADR 0163 bound 1.
  -- ⛔ Do NOT "simplify" this to "no affiliation outside <org>": that breaks the
  --   idempotent path for every multi-org person (pgTAP 393 § 3, W8).
  select is_active into v_person_active
  from public.profiles where id = p_user;

  if not found then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  if not app.person_known_to_org(p_user, v_org) then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- AFF W3/T3.1 (ADR 0098 §W3.3). A DEACTIVATED account cannot be affiliated. The
  -- identifier-first flow (D12) surfaces `is_active` from `list_org_people` so the UI
  -- can say so, but Rule 1 forbids relying on that: the UI is not the boundary.
  --
  -- ⚠ `profiles.is_active` — the MASTER SWITCH — NOT `app.is_active(p_user)`, which
  -- also folds `suspended_until`. A suspension is temporary and reversible; refusing to
  -- record someone's employment because they are suspended this week would be wrong,
  -- and would quietly turn an HR record into a disciplinary one.
  if not coalesce(v_person_active, false) then
    raise exception 'conta desativada' using errcode = 'HC0R4';
  end if;

  -- D5 — THE ORG-PARENT ENSURE, and it is what makes rehire ONE STEP. A hospital admin
  -- may not create org affiliations (that door is org_admin-only), so without this a
  -- rehire would stall waiting for an org_admin ticket for someone the hospital is
  -- actively trying to re-employ. The ensure is audited as its own
  -- `org_affiliation.created` row naming this actor, by the trigger on that table.
  --
  -- ⚠ AFTER ADR 0168 THIS BRANCH IS NARROW BY CONSTRUCTION: the gate above already
  -- required a non-voided row in `v_org`, so the only state that reaches it is a person
  -- whose rows in this organisation are all ENDED — the rehire. It can no longer create
  -- a first-ever anchor for an unanchored person; that is the creation door's job.
  --
  -- D4 (an active hospital affiliation implies an active org affiliation in the same
  -- org) is satisfied BY CONSTRUCTION here: after this block the parent exists, so a
  -- separate check would be unreachable code asserting what the lines above just
  -- guaranteed. The STRUCTURAL guarantee is the deferred constraint trigger
  -- `hospital_affiliation_has_org_trg` (20261003004000).
  select id into v_org_aff
  from public.organization_affiliations
  where principal_id = p_user and organization_id = v_org
    and ended_on is null and voided_at is null;

  if v_org_aff is null then
    insert into public.organization_affiliations
      (principal_id, organization_id, started_on, created_by)
    values (p_user, v_org, coalesce(p_started_on, current_date), p_actor);
  end if;

  -- Idempotent by (person, hospital) over the ACTIVE row: the partial unique index
  -- would reject a duplicate anyway, and a 23505 reaching the caller as a generic
  -- pt-BR error is a worse answer than the intended one.
  select id into v_existing
  from public.hospital_affiliations
  where principal_id = p_user and hospital_id = p_hospital
    and ended_on is null and voided_at is null;

  if v_existing is not null then
    -- ⚠ `p_started_on` IS DELIBERATELY IGNORED ON THIS PATH — the path where an ACTIVE
    -- hospital affiliation already exists. It applies to the hospital INSERT below, and
    -- (since 20261003004200) to the org-parent ensure above: this is the idempotent
    -- CREATE door, and a create door
    -- that quietly acquires a date-mutation capability is how doors grow undeclared
    -- powers. Changing an existing employment's dates is `update_affiliation`
    -- (20260909001100), which emits `affiliation.updated` — routing a date change
    -- through here would mutate a row with no audit arm to record it (Rule 11).
    -- Pinned by pgTAP `304`, so this comment cannot rot into a lie.
    update public.hospital_affiliations
       set hospital_employee_id = coalesce(v_emp, hospital_employee_id),
           job_title            = coalesce(v_job, job_title),
           work_email           = coalesce(v_wemail, work_email),
           work_phone           = coalesce(v_wphone, work_phone)
     where id = v_existing;
    return v_existing;
  end if;

  insert into public.hospital_affiliations
    (principal_id, organization_id, hospital_id, hospital_employee_id, started_on, created_by,
     job_title, work_email, work_phone)
  values
    (p_user, v_org, p_hospital, v_emp, coalesce(p_started_on, current_date), p_actor,
     v_job, v_wemail, v_wphone)
  returning id into v_id;

  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- § 3  THE CREATION DOORS — NEW.  ADR 0168 Amdt 1 § Decision 3.
--   Each is its ORDINARY sibling's body with EXACTLY TWO differences:
--     (a) the containment predicate is `anchorless OR known here` — TODAY'S SEMANTICS,
--         PRESERVED, for the reason in this file's header; and
--     (b) after a successful INSERT — and NOT on the idempotent return path — it emits
--         its own `app.audit_write` naming the ACT.
--   Authority arms are IDENTICAL to the ordinary siblings. The door does not widen WHO
--   may act; it widens WHICH STATE is admissible, and only for a caller reaching it
--   through a `service_role` wrapper.
--
--   ⚠ THE EXTRA AUDIT ROW IS IN ADDITION TO THE TABLE TRIGGER'S, NOT INSTEAD OF IT.
--     `app.trg_audit_organization_affiliations` / `trg_audit_hospital_affiliations` are
--     keyed on `tg_op` and CANNOT know which door inserted, so they still emit their
--     `…created` row. The trail therefore carries the ROW FACT (from the trigger) AND
--     the ACT (from the door). A distinct verb was not optional — ADR 0168
--     § Consequences: "recovery must be distinguishable in the trail from an ordinary
--     affiliation", and the same applies to creation.
-- ---------------------------------------------------------------------------
create or replace function app.affiliate_new_person_to_org_impl(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date default null)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_person_active boolean;
  v_existing      uuid;
  v_id            uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- AUTHORITY — IDENTICAL to `app.affiliate_person_to_org_impl` (D2): org_admin of THAT
  -- organisation, and nothing else.
  if not app.is_org_admin_of_for(p_organization, p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select is_active into v_person_active
  from public.profiles where id = p_user;

  if not found then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- CONTAINMENT — the pre-ADR-0168 semantics, kept HERE and only here. The `anchorless`
  -- disjunct is what admits a profile that exists but has no affiliation yet, i.e. a
  -- person being created. ⭐ `known_to_org` is NOT redundant beside it: see the header —
  -- `registerUser` calls this door and then the hospital creation door, and by the
  -- second call the person is no longer anchorless.
  if not (app.person_is_anchorless(p_user)
          or app.person_known_to_org(p_user, p_organization)) then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  if not coalesce(v_person_active, false) then
    raise exception 'conta desativada' using errcode = 'HC0R4';
  end if;

  select id into v_existing
  from public.organization_affiliations
  where principal_id = p_user and organization_id = p_organization
    and ended_on is null and voided_at is null;

  if v_existing is not null then
    -- ⛔ NO AUDIT ROW ON THIS PATH, deliberately: nothing was created. An idempotent
    -- re-call emitting `…created_on_registration` would put an act in the trail that
    -- never happened, and would make the verb uncountable.
    return v_existing;
  end if;

  insert into public.organization_affiliations
    (principal_id, organization_id, started_on, created_by)
  values
    (p_user, p_organization, coalesce(p_started_on, current_date), p_actor)
  returning id into v_id;

  perform app.audit_write(
    'org_affiliation.created_on_registration',
    'organization_affiliation',
    v_id,
    null,
    'Vínculo organizacional criado no cadastro da pessoa',
    jsonb_build_object('user_id', p_user, 'actor_user_id', p_actor),
    p_organization,
    null);

  return v_id;
end;
$function$;

create or replace function app.affiliate_new_person_impl(
  p_actor uuid, p_user uuid, p_hospital uuid,
  p_employee_id text default null, p_started_on date default null,
  p_job_title text default null, p_work_email text default null, p_work_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_org        uuid;
  v_existing   uuid;
  v_id         uuid;
  v_person_active boolean;
  v_emp        text := nullif(btrim(coalesce(p_employee_id, '')), '');
  v_job        text := nullif(btrim(coalesce(p_job_title, '')), '');
  v_wemail     text := nullif(btrim(coalesce(p_work_email, '')), '');
  v_wphone     text := nullif(btrim(coalesce(p_work_phone, '')), '');
  v_org_aff    uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'HC0R5';
  end if;

  -- AUTHORITY — IDENTICAL to `app.affiliate_person_impl` (D13).
  if not (app.is_org_admin_of_for(v_org, p_actor)
          or app.is_hospital_admin_of_for(p_hospital, p_actor)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select is_active into v_person_active
  from public.profiles where id = p_user;

  if not found then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- CONTAINMENT — the pre-ADR-0168 semantics, kept HERE and only here. See the org
  -- sibling above; the two creation doors share ONE predicate on purpose, which is what
  -- keeps pgTAP 393 § 5.7 a 2-doors-1-predicate-set statement per family.
  if not (app.person_is_anchorless(p_user)
          or app.person_known_to_org(p_user, v_org)) then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  if not coalesce(v_person_active, false) then
    raise exception 'conta desativada' using errcode = 'HC0R4';
  end if;

  -- D5 org-parent ensure, unchanged. On the registration path this branch is normally
  -- a no-op because `registerUser` calls the ORG creation door first; it still exists
  -- because `ensureActiveAffiliation` (the hospital_admin registrar) does not.
  select id into v_org_aff
  from public.organization_affiliations
  where principal_id = p_user and organization_id = v_org
    and ended_on is null and voided_at is null;

  if v_org_aff is null then
    insert into public.organization_affiliations
      (principal_id, organization_id, started_on, created_by)
    values (p_user, v_org, coalesce(p_started_on, current_date), p_actor);
  end if;

  select id into v_existing
  from public.hospital_affiliations
  where principal_id = p_user and hospital_id = p_hospital
    and ended_on is null and voided_at is null;

  if v_existing is not null then
    -- ⛔ NO AUDIT ROW ON THIS PATH — nothing was created. Same reasoning as the org
    -- sibling's idempotent branch.
    update public.hospital_affiliations
       set hospital_employee_id = coalesce(v_emp, hospital_employee_id),
           job_title            = coalesce(v_job, job_title),
           work_email           = coalesce(v_wemail, work_email),
           work_phone           = coalesce(v_wphone, work_phone)
     where id = v_existing;
    return v_existing;
  end if;

  insert into public.hospital_affiliations
    (principal_id, organization_id, hospital_id, hospital_employee_id, started_on, created_by,
     job_title, work_email, work_phone)
  values
    (p_user, v_org, p_hospital, v_emp, coalesce(p_started_on, current_date), p_actor,
     v_job, v_wemail, v_wphone)
  returning id into v_id;

  perform app.audit_write(
    'affiliation.created_on_registration',
    'hospital_affiliation',
    v_id,
    null,
    'Vínculo criado no cadastro da pessoa',
    jsonb_build_object('user_id', p_user, 'actor_user_id', p_actor),
    v_org,
    p_hospital);

  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- § 4  THE RECOVERY DOOR — NEW.  ADR 0168 § Decision 2.  ORG TIER ONLY (header).
--   ⭐ STRICT, and this is the difference that makes it a recovery door rather than a
--     second creation door: the person must be ANCHORLESS. A person already anchored
--     somewhere is administered through the ordinary door by their OWN tenant's admin —
--     routing them through here would let a platform_admin move employment records,
--     which the ADR 0041 noun rule forbids (platform_admin administers tenancy and
--     identity, NOT commission content or employment).
-- ---------------------------------------------------------------------------
create or replace function app.recover_orphan_person_to_org_impl(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date default null)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $function$
declare
  v_person_active boolean;
  v_id            uuid;
begin
  if p_actor is null then
    raise exception 'ator não identificado' using errcode = '42501';
  end if;

  -- AUTHORITY — platform_admin ONLY. ⚠ `app.is_admin_for` carries the ACT caller-hat
  -- clause (ADR 0106 D11): when the question is about the CALLER the platform_admin hat
  -- must be ACTIVE, so a platform_admin acting under another role is refused here.
  if not app.is_admin_for(p_actor) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- ⚠ THE ORG-EXISTENCE CHECK IS DELIBERATE AND NEW — see this migration's header. The
  -- ordinary door gets it free from `is_org_admin_of_for`; `is_admin_for` is
  -- org-independent, so without this a typo'd uuid surfaces as a raw 23503.
  if not exists (select 1 from public.organizations o where o.id = p_organization) then
    raise exception 'organização inexistente' using errcode = 'HC0R5';
  end if;

  -- EXISTENCE + CONFLATION, exactly as the siblings. ⚠ Kept even though the caller is a
  -- platform_admin who could enumerate `profiles` anyway: the value of the conflation is
  -- that the DOOR has one refusal shape, so a future ACL widening cannot turn this into
  -- an oracle by accident.
  select is_active into v_person_active
  from public.profiles where id = p_user;

  if not found then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  -- CONTAINMENT — STRICTLY ANCHORLESS. This is the ONE door in the family whose
  -- predicate is `person_is_anchorless` alone.
  if not app.person_is_anchorless(p_user) then
    raise exception 'pessoa não é órfã' using errcode = 'HC0R0';
  end if;

  if not coalesce(v_person_active, false) then
    raise exception 'conta desativada' using errcode = 'HC0R4';
  end if;

  -- ⛔ NO IDEMPOTENT BRANCH, and its absence is a CONSEQUENCE rather than an omission:
  -- an anchorless person has ZERO non-voided rows of any tense, so the siblings'
  -- `ended_on is null and voided_at is null` probe cannot match by construction. Adding
  -- it would be unreachable code asserting what the gate above just guaranteed.
  insert into public.organization_affiliations
    (principal_id, organization_id, started_on, created_by)
  values
    (p_user, p_organization, coalesce(p_started_on, current_date), p_actor)
  returning id into v_id;

  perform app.audit_write(
    'org_affiliation.recovered',
    'organization_affiliation',
    v_id,
    null,
    'Vínculo organizacional recuperado (pessoa órfã)',
    jsonb_build_object('user_id', p_user, 'actor_user_id', p_actor),
    p_organization,
    null);

  return v_id;
end;
$function$;

revoke all on function app.affiliate_new_person_to_org_impl(uuid, uuid, uuid, date)
  from public, anon, authenticated, service_role;
revoke all on function app.affiliate_new_person_impl(uuid, uuid, uuid, text, date, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function app.recover_orphan_person_to_org_impl(uuid, uuid, uuid, date)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- § 5  THE WRAPPERS.
--   Shaped exactly like the existing `public.affiliate_person_for` /
--   `public.affiliate_person_to_org_for` pair, read out of `pg_proc` and matched:
--   `language sql`, `security definer`, pinned `search_path`, one `select` of the impl.
--
--   ⛔ THE ACL IS THE BOUND. The creation wrappers take `p_actor` explicitly and are
--      `service_role` ONLY — unreachable from PostgREST by any tenant user, which is
--      what ADR 0168 Amdt 1 means by "the door's ACL is the only durable discriminator
--      left". The recovery wrapper takes NO actor and derives it from `auth.uid()`,
--      because its caller IS a signed-in platform_admin.
-- ---------------------------------------------------------------------------
create or replace function public.affiliate_new_person_to_org_for(
  p_actor uuid, p_user uuid, p_organization uuid, p_started_on date default null)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $function$
  select app.affiliate_new_person_to_org_impl(p_actor, p_user, p_organization, p_started_on);
$function$;

create or replace function public.affiliate_new_person_for(
  p_actor uuid, p_user uuid, p_hospital uuid,
  p_employee_id text default null, p_started_on date default null,
  p_job_title text default null, p_work_email text default null, p_work_phone text default null)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $function$
  select app.affiliate_new_person_impl(p_actor, p_user, p_hospital, p_employee_id, p_started_on,
                                       p_job_title, p_work_email, p_work_phone);
$function$;

create or replace function public.recover_orphan_person_to_org(
  p_user uuid, p_organization uuid, p_started_on date default null)
returns uuid
language sql
security definer
set search_path = app, public, pg_catalog
as $function$
  select app.recover_orphan_person_to_org_impl((select auth.uid()), p_user, p_organization, p_started_on);
$function$;

revoke all on function public.affiliate_new_person_to_org_for(uuid, uuid, uuid, date)
  from public, anon, authenticated;
revoke all on function public.affiliate_new_person_for(uuid, uuid, uuid, text, date, text, text, text)
  from public, anon, authenticated;
grant execute on function public.affiliate_new_person_to_org_for(uuid, uuid, uuid, date)
  to service_role;
grant execute on function public.affiliate_new_person_for(uuid, uuid, uuid, text, date, text, text, text)
  to service_role;

revoke all on function public.recover_orphan_person_to_org(uuid, uuid, date)
  from public, anon, service_role;
grant execute on function public.recover_orphan_person_to_org(uuid, uuid, date)
  to authenticated;

comment on function public.affiliate_new_person_to_org_for(uuid, uuid, uuid, date) is
  'ADR 0168 Amdt 1 door 3 (org tier). CREATION door: admits an anchorless person. '
  'service_role ONLY — the ACL is the bound. Emits org_affiliation.created_on_registration.';
comment on function public.affiliate_new_person_for(uuid, uuid, uuid, text, date, text, text, text) is
  'ADR 0168 Amdt 1 door 3 (hospital tier). CREATION door: admits an anchorless person. '
  'service_role ONLY — the ACL is the bound. Emits affiliation.created_on_registration.';
comment on function public.recover_orphan_person_to_org(uuid, uuid, date) is
  'ADR 0168 Decision 2. RECOVERY door: platform_admin only, STRICTLY anchorless, org '
  'tier only (once anchored the ordinary hospital door admits normally). Emits '
  'org_affiliation.recovered.';
