-- AE2.4 INCREMENT 1 — THE CIRCULAR PAIR.
-- Ruling: ADR 0164 (amends 0151 D10 and 0163).  Security context: ADR 0159 D1/D2.
-- Keystone: supabase/tests/393_ae24_containment_on_destructive_event.sql.
-- Phase record: docs/progress/authz-ae2.md § AE2.4 increment 1.  ADR 0165 records the
-- re-expression of the tenant gate and the alternative that was rejected.
--
-- ============================================================================
-- WHY BOTH HALVES MOVE IN ONE MIGRATION
-- ============================================================================
-- Tenant containment ("a non-admin profile must have a tenant anchor") was enforced at
-- CREATION time, by a deferred constraint trigger on `public.profiles` reading
-- `home_organization_id`.  AE2.4 drops that column, so the invariant must be re-predicated
-- onto `organization_affiliations`.  Measured, it CANNOT be re-predicated in place:
--
--   1. TWO TRANSACTIONS, so deferral buys nothing.  `handle_new_user` inserts the profile
--      inside GoTrue's `auth.users` transaction; the affiliation is created later, by a
--      separate PostgREST transaction.  DEFERRABLE INITIALLY DEFERRED defers to the COMMIT
--      of its OWN transaction.  An affiliation predicate on `profiles` INSERT would raise
--      on every signup, unconditionally.
--   2. THE DEPENDENCY IS CIRCULAR.  `app.affiliate_person_to_org_impl` — the door that
--      CREATES the affiliation — was itself gated on the column.  Containment could not
--      move onto affiliations while the affiliation-creating door required the column.
--
-- So: the creation-time arm is DROPPED, containment is re-predicated to "≥ 1 NON-VOIDED
-- organization affiliation", and enforcement moves to the only post-creation event that
-- can destroy it — a deferred constraint trigger on `organization_affiliations`
-- void/delete.  The invariant now means "this person is reachable by someone", which is
-- what it was for.
--
-- ⛔⛔ THE SECURITY CONTEXT CHANGES IN THIS SAME MIGRATION, AND THAT IS NOT OPTIONAL.
--    `public.assert_profile_tenant_has_org` was `prosecdef = f` (INVOKER) and harmless
--    ONLY because its body read no table at all.  Giving it a read of
--    `organization_affiliations` — whose SELECT policy is
--    `principal_id = auth.uid() OR app.is_org_admin_of(organization_id)`, with no hospital
--    tier AND no cross-org arm, by design (ADR 0151 D1) — makes it evaluate an INVARIANT
--    THROUGH A VIEWER'S LENS, which is not an invariant (ADR 0159 D2).  A DEFERRABLE
--    INITIALLY DEFERRED constraint trigger fires at COMMIT, i.e. OUTSIDE the DEFINER door
--    that queued it, with `current_user` back to the session role — that is precisely the
--    mechanism of BUG-D5-REHIRE-HOSPADMIN-001.  Left INVOKER, this trigger would refuse
--    every void of a person who is also affiliated to an organisation the caller cannot
--    see: a FALSE POSITIVE, a rejection where the answer is accept.  393 § 2.5 is the cell.
--
-- ⚠ WHAT THIS MIGRATION GIVES UP, STATED RATHER THAN GLOSSED (ADR 0164 § Consequences).
--   Creation-time containment is GENUINELY LOST.  A half-failed person creation leaves a
--   profile with no affiliation: in no roster, and administrable through the six person
--   doors by NOBODY.
--   ⛔ THIS SENTENCE SAID "administrable by `platform_admin` alone" AND THAT WAS FALSE
--     (QA finding B5).  Measured against the shipped doors: all six gate solely on
--     `app.can_administer_person_for`, that predicate has NO `platform_admin` arm BY
--     DELIBERATE DESIGN (the ADR 0041 noun rule — `…005700:207-210`, asserted by pgTAP
--     `384 § 6`), and it returns false outright on `cardinality(v_orgs) = 0`.  The claim
--     was wrong in the NARROWING direction, which is why it read as care and survived.
--   The ACTUAL recovery path is ADR 0165 D1's widening: any `org_admin` — or, through the
--   hospital sibling, any `hospital_admin` — WHO HOLDS THE PERSON'S UUID may claim them by
--   affiliating them.  ⚠ Note the posture that implies, stated rather than buried: the
--   window is not "only the most privileged actor can reach them", it is "nobody can
--   reach them until somebody with the id takes them".
--   ⛔ That window is inherent to dropping the column, not introduced here — closing it at
--   creation requires `handle_new_user` to create the affiliation, which silently discards
--   the caller's backdated `p_started_on` and `created_by` attribution.  ADR 0164 therefore
--   makes a mitigation REQUIRED: `app.tenant_orphan_profiles()` below, with 393 § 1 proving
--   it can fire rather than asserting that it could.
--
-- ⚠ PRE-DECLARED WIDENING (393 § 3 / § 5 measure it cell by cell).  The re-expressed tenant
--   gate admits three states the column gate refused: a person whose column names another
--   org but who has NO affiliation row; one whose only row is VOIDED; and a true orphan.
--   After the column drops there is NO FACT anchoring such a person anywhere, so refusing
--   every organisation would make them permanently unreachable — and this is the only
--   recovery path for the window above.  Measured 2026-08-28 and recorded in ADR 0165:
--   there is NO enumeration path to such a person for any non-`platform_admin` caller.
--   ⚠ Until the column actually drops, the first of those three states is one where a fact
--   still exists and the new gate ignores it.  Local to this branch, and said plainly.


-- ============================================================================
-- 1. CONTAINMENT — re-predicated, and moved onto the destructive event.
--    ⭐ THE FUNCTION KEEPS ITS NAME DELIBERATELY.  A rename orphans every name-keyed
--    verdict (the door-audit backlog, the invoker findings, docs/backend-state.md), and a
--    verdict that silently stops applying to anything is worse than one that is wrong.
--    The TRIGGER is renamed, because no verdict keys on a trigger name and the old name
--    would have lied about which table it guards.
-- ============================================================================
drop trigger if exists profiles_tenant_has_org_trg on public.profiles;

create or replace function public.assert_profile_tenant_has_org()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $fn$
declare
  v_is_admin boolean;
begin
  -- SECURITY DEFINER — see the header.  This function reads NO caller identity (no
  -- auth.uid(), no app.has_role, no app.active_role()), returns `trigger`, is not callable
  -- as an ordinary function, and its only outcome is to raise or not raise.  DEFINER
  -- grants nobody anything here; it lets an invariant check SEE THE DATA IT ASSERTS OVER
  -- (ADR 0159 D2).
  --
  -- The subject is OLD.principal_id in both arms.  On DELETE there is no NEW; on
  -- `UPDATE OF voided_at` the principal cannot have changed, because a principal change
  -- alone does not name `voided_at` and so does not fire this trigger.  A change that
  -- named both would only ADD a row to the new principal, which cannot break containment.
  select p.is_admin into v_is_admin
  from public.profiles p where p.id = old.principal_id;

  -- ⛔⛔ THERE IS DELIBERATELY NO `if not found then return null` HERE, AND THE REASON WAS
  --    MEASURED, NOT REASONED.  The first draft had one — "no profile, nothing to contain" —
  --    and it made the whole DEFINER change UNTESTABLE, because it converted the blindness
  --    into a SILENT ACCEPT instead of a refusal.
  --
  --    ⭐ THE MECHANISM, AND IT INVERTS WHAT ADR 0159 PREDICTS FOR THIS TRIGGER.  Profile
  --    visibility is ITSELF affiliation-derived since AE2.2
  --    (`profiles_select_self_or_admin` -> `app.can_administer_person_via_affiliation`), so
  --    a caller who cannot see the affiliations cannot see the PROFILE either — the two
  --    blindnesses are CORRELATED, and the profile read is simply the one that happens
  --    first.  Measured under an INVOKER build: `current_user = authenticated`,
  --    `visible non-voided rows = 0`, profile row invisible.  With an early return that is
  --    a fail-OPEN — the void succeeds and the person is orphaned, which is the exact state
  --    this trigger exists to prevent.  ADR 0159's hospital-tier case fails the other way
  --    (a false-positive refusal) because ITS subject row is the one being written.
  --
  --    So: a subject we cannot resolve is treated as NON-ADMIN and falls through to the
  --    containment check, which then refuses.  Fail CLOSED.  Under DEFINER this branch is
  --    unreachable anyway — `guard_profile_no_delete` blocks profile deletes and
  --    `profiles_id_fkey` is ON DELETE RESTRICT, so the subject cannot vanish — which is
  --    what makes fail-closed free here rather than a trade.
  --    Keystone: 393 § 2.5 goes RED under `alter function … security invoker`, and that
  --    mutation is recorded in docs/progress/authz-ae2.md.
  --
  -- THE EXEMPTION, PRESERVED VERBATIM IN INTENT from the outgoing rule
  -- (`... and not new.is_admin`).  A platform_admin is not a tenant person and holds no
  -- organization affiliation by design — which is exactly why the one profile in the seed
  -- with no affiliation is CORRECT and not an orphan, and why the detector below must
  -- discriminate on something more than an absent affiliation.
  if coalesce(v_is_admin, false) then
    return null;
  end if;

  -- ⚠ NON-VOIDED, NOT ACTIVE.  An ENDED, non-voided row satisfies containment: that is
  --   ADR 0163's own derivation domain (bound 1 — void is "was never true" and is excluded
  --   entirely; an ended row still yields a retaining organisation).  Narrowing this to
  --   `ended_on is null` would make every fully-offboarded person a violation and break
  --   ADR 0151 D5's one-step rehire at the same time.  393 § 2.3 / § 2.4 are the two cells
  --   that differ in exactly this one column.
  if not exists (
    select 1
      from public.organization_affiliations oa
     where oa.principal_id = old.principal_id
       and oa.voided_at is null
  ) then
    -- A NAMED condition (`check_violation` -> 23514), matching the
    -- `app.assert_hospital_affiliation_has_org` precedent rather than minting an HC0R* code:
    -- ADR 0156 excludes trigger functions from the door-SQLSTATE domain by construction.
    -- ⚠ Unlike that precedent, THIS raise is reachable by a user action —
    -- `void_org_affiliation` on a person's last non-voided affiliation — so it can surface
    -- as an unmapped error.  Recorded as owed rather than papered over: giving the void
    -- door its own mapped refusal is a separate change with its own `toState` mapping.
    raise exception
      'a non-admin profile must retain at least one non-voided organization affiliation (tenant anchor, ADR 0164): principal %',
      old.principal_id
      using errcode = 'check_violation';
  end if;

  return null;
end;
$fn$;

-- Owner-only EXECUTE, matching `app.assert_hospital_affiliation_has_org` (ADR 0159 D1).
-- ⚠ This REVOKE moves the function out of `ARM=census`'s "public INVOKER plpgsql" clause
--   and out of `ARM=wrapper`'s `prosecdef = f` half in the same change that flips DEFINER.
--   Domain membership is re-derived from the catalog and the compensating control is named
--   in docs/progress/authz-ae2.md — absence of a verdict is absence of coverage.
revoke all on function public.assert_profile_tenant_has_org() from public;
revoke all on function public.assert_profile_tenant_has_org() from authenticated;
revoke all on function public.assert_profile_tenant_has_org() from service_role;

-- ⚠ `UPDATE OF voided_at OR DELETE` — the narrowest event set that covers the invariant.
--   END is deliberately NOT an event: an ended, non-voided row still satisfies containment.
--   The DELETE arm is a backstop that `app.guard_org_affiliation_no_delete` (BEFORE DELETE,
--   raises unconditionally) makes UNREACHABLE; 393 § 2.9 says so rather than claiming
--   coverage for it.
create constraint trigger org_affiliation_tenant_containment_trg
  after update of voided_at or delete on public.organization_affiliations
  deferrable initially deferred
  for each row execute function public.assert_profile_tenant_has_org();

-- ============================================================================
-- 2. THE REQUIRED MITIGATION — orphan detection (ADR 0164: app-side compensation OR an
--    orphan-detection assertion; having neither is not an option).
--
--    ⭐ THE DISCRIMINATOR IS `is_admin`, AND THE CHOICE IS THE WHOLE POINT.  Measured
--    2026-08-27 and re-measured by 393 § 1.3: exactly one profile has no non-voided org
--    affiliation and it is the `platform_admin` — correct by design.  So AN ORPHAN IS
--    SHAPE-IDENTICAL TO A LEGITIMATE ROW.  A detector keyed on absence alone would flag the
--    platform admin forever; one tuned to ignore "no affiliation at all" would ignore
--    exactly the shape it hunts.  `is_admin` is orthogonal to affiliation presence, so it
--    excludes the legitimate row without excluding a mechanism.
-- ============================================================================
create or replace function app.tenant_orphan_profiles()
returns table (profile_id uuid, reason text)
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
  select p.id,
         -- `reason` names the MECHANISM, so the output is actionable rather than a count:
         -- a never-affiliated profile is a half-failed creation and wants an affiliation;
         -- an all-voided one is a data decision someone took and wants a human ruling.
         case when exists (select 1 from public.organization_affiliations oa
                            where oa.principal_id = p.id)
              then 'all_voided'
              else 'never_affiliated'
         end
    from public.profiles p
   where not p.is_admin
     and not exists (
       select 1 from public.organization_affiliations oa
        where oa.principal_id = p.id
          and oa.voided_at is null);
$fn$;

-- `postgres`-only, for the same reason `app.person_authority_orgs` is: a row-returning
-- DEFINER reachable by `authenticated` is an enumeration oracle, and this one returns
-- precisely the ids that no roster shows.
revoke all on function app.tenant_orphan_profiles() from public;
revoke all on function app.tenant_orphan_profiles() from authenticated;
revoke all on function app.tenant_orphan_profiles() from service_role;

comment on function app.tenant_orphan_profiles() is
  'ADR 0164 mitigation: non-admin profiles with no non-voided organization affiliation — unreachable by every roster and administrable by platform_admin alone. Proof it can fire: pgTAP 393 § 1.5/§ 1.6.';

-- ============================================================================
-- 3. THE OTHER HALF OF THE CIRCULAR PAIR — both affiliation-creating doors.
--
--    ⭐ BOTH SIBLINGS MOVE TOGETHER, AND "IDENTICAL" WAS VERIFIED RATHER THAN ASSUMED.
--    Lifted from the live catalog and diffed: the two tenant gates were byte-identical
--    apart from how the organisation is obtained (`p_organization` vs
--    `v_org := app.org_of_hospital(p_hospital)`) — same predicate, same SQLSTATE, same
--    pt-BR message, same conflation rationale.  They answer the same question, so they get
--    the same answer.  Splitting them across increments is how this phase produced
--    "one axis was swept, its sibling was not" three times already.
--    393 § 5.7 re-derives that identity from the catalog so it cannot drift.
--
--    Everything outside the gate — the authority arms, the HC0R4 deactivated check, the
--    idempotency, the org-parent ensure, every comment — is reproduced BYTE-FOR-BYTE from
--    `pg_get_functiondef()` at head 20261003005500.
-- ============================================================================

CREATE OR REPLACE FUNCTION app.affiliate_person_to_org_impl(p_actor uuid, p_user uuid, p_organization uuid, p_started_on date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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

  -- TENANT CHECK (ADR 0151 D11; re-expressed by ADR 0164). ⚠ "not found" and "wrong
  -- organisation" are DELIBERATELY the same error: splitting them makes this door a
  -- cross-tenant existence oracle over `profiles.id` for any admin of any tenant. The
  -- explicit `if not found` below is what KEEPS them conflated, now that the predicate no
  -- longer reads a column that happens to be NULL for a person who does not exist.
  --
  -- ⛔ AE2.4 INCREMENT 1 — THE CIRCULAR PAIR. This was
  -- `v_person_org is null or v_person_org is distinct from <org>`, a read of
  -- `profiles.home_organization_id`. It could not move before the containment trigger and
  -- the containment trigger could not move before it: the door that CREATES an org
  -- affiliation was gated on the column, so an affiliation-derived containment predicate
  -- was UNSATISFIABLE at creation time. Both halves break in one migration (ADR 0164).
  --
  -- THE RE-EXPRESSION, and what each arm exists for:
  --   • a person ALREADY KNOWN to this organisation by any NON-VOIDED tense may be
  --     affiliated — that is one-step rehire (ADR 0151 D5) and the door's own idempotent
  --     path for a person active in more than one organisation;
  --   • a person with NO non-voided tenancy ANYWHERE may be affiliated — that is person
  --     creation (the profile exists before any affiliation does), and it is also the only
  --     recovery path for the orphan window ADR 0164 accepts;
  --   • a person whose non-voided tenancy is entirely ELSEWHERE may not.
  -- ⚠ "known to this organisation" deliberately INCLUDES ended rows and deliberately
  --   EXCLUDES voided ones — ADR 0163 bound 1, void is not end.
  -- ⛔ Do NOT "simplify" this to "no affiliation outside <org>": that breaks the idempotent
  --   path for every multi-org person, a NARROWING pgTAP 393 § 3 pins as W8.
  select is_active into v_person_active
  from public.profiles where id = p_user;

  if not found then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  if exists (select 1 from public.organization_affiliations oa
              where oa.principal_id = p_user and oa.voided_at is null)
     and not exists (select 1 from public.organization_affiliations oa
              where oa.principal_id = p_user and oa.voided_at is null
                and oa.organization_id = p_organization) then
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

CREATE OR REPLACE FUNCTION app.affiliate_person_impl(p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text DEFAULT NULL::text, p_started_on date DEFAULT NULL::date, p_job_title text DEFAULT NULL::text, p_work_email text DEFAULT NULL::text, p_work_phone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
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

  -- TENANT CHECK (ADR 0151 D13; re-expressed by ADR 0164). ⚠ "not found" and "wrong
  -- organisation" are DELIBERATELY the same error: splitting them makes this door a
  -- cross-tenant existence oracle over `profiles.id` for any admin of any tenant. The
  -- explicit `if not found` below is what KEEPS them conflated, now that the predicate no
  -- longer reads a column that happens to be NULL for a person who does not exist.
  --
  -- ⛔ AE2.4 INCREMENT 1 — THE CIRCULAR PAIR. This was
  -- `v_person_org is null or v_person_org is distinct from <org>`, a read of
  -- `profiles.home_organization_id`. It could not move before the containment trigger and
  -- the containment trigger could not move before it: the door that CREATES an org
  -- affiliation was gated on the column, so an affiliation-derived containment predicate
  -- was UNSATISFIABLE at creation time. Both halves break in one migration (ADR 0164).
  --
  -- THE RE-EXPRESSION, and what each arm exists for:
  --   • a person ALREADY KNOWN to this organisation by any NON-VOIDED tense may be
  --     affiliated — that is one-step rehire (ADR 0151 D5) and the door's own idempotent
  --     path for a person active in more than one organisation;
  --   • a person with NO non-voided tenancy ANYWHERE may be affiliated — that is person
  --     creation (the profile exists before any affiliation does), and it is also the only
  --     recovery path for the orphan window ADR 0164 accepts;
  --   • a person whose non-voided tenancy is entirely ELSEWHERE may not.
  -- ⚠ "known to this organisation" deliberately INCLUDES ended rows and deliberately
  --   EXCLUDES voided ones — ADR 0163 bound 1, void is not end.
  -- ⛔ Do NOT "simplify" this to "no affiliation outside <org>": that breaks the idempotent
  --   path for every multi-org person, a NARROWING pgTAP 393 § 3 pins as W8.
  select is_active into v_person_active
  from public.profiles where id = p_user;

  if not found then
    raise exception 'pessoa não pertence a esta organização' using errcode = 'HC0R0';
  end if;

  if exists (select 1 from public.organization_affiliations oa
              where oa.principal_id = p_user and oa.voided_at is null)
     and not exists (select 1 from public.organization_affiliations oa
              where oa.principal_id = p_user and oa.voided_at is null
                and oa.organization_id = v_org) then
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
  -- D4 (an active hospital affiliation implies an active org affiliation in the same
  -- org) is satisfied BY CONSTRUCTION here: after this block the parent exists, so a
  -- separate check would be unreachable code asserting what the lines above just
  -- guaranteed. The STRUCTURAL guarantee is the deferred constraint trigger
  -- `hospital_affiliation_has_org_trg` (20261003004000). It could not land before the
  -- SEED carried org-affiliation rows: B5's backfill matches zero rows on a fresh
  -- reset (migrations run before seed.sql), so B7-seed, not B5, is its precondition.
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
