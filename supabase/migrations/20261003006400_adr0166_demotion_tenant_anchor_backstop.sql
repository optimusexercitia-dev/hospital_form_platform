-- CNV-5 / R2-m3 — the `is_admin` true->false DEMOTION BACKSTOP.
--
-- THE HOLE, measured against the live catalog before a line of this was written.
-- A signed-in `platform_admin` could run
--     update public.profiles set is_admin = false where id = <an anchorless admin>
-- and the row would INSTANTLY satisfy `app.tenant_orphan_profiles()`, whose predicate
-- is `where not p.is_admin and not exists (<non-voided affiliation>)`.  The demotion is
-- therefore the very act that MANUFACTURES the orphan.  Reproduced on both the self and
-- the non-self path: `UPDATE 1`, orphans 0 -> 1, reason `never_affiliated`.  No trigger,
-- constraint or door fired.
--
-- Reachability, all four layers measured rather than argued: RLS `profiles_admin_update`
-- is USING `app.is_admin()` WITH CHECK `app.is_admin()` (it gates the ACTOR, never the
-- subject); `authenticated` holds column UPDATE on `is_admin`; this guard admits a
-- signed-in admin for `is_admin`/`is_active`; and NO door writes the column, so nothing
-- else could have caught it either.
--
-- ⭐ THIS USED TO BE CAUGHT.  `20260702000000_user_registration.sql` created
-- `profiles_tenant_has_org_trg` AFTER INSERT OR UPDATE OF home_organization_id,
-- is_admin.  `20261003005600` dropped it and re-attached the re-predicated function to
-- `organization_affiliations` ONLY.  Confirmed in the catalog: the `profiles` side has
-- carried no containment arm since.  This restores that arm, in the shape ADR 0166
-- requires.
--
-- ============================================================================
-- WHY THE ARM LIVES INSIDE THIS FUNCTION AND NOT IN A NEW TRIGGER
-- ============================================================================
-- ADR 0166:112-113 is binding: "Needs a DEFINER, pinned-`search_path` backstop -- ⛔ an
-- INVOKER trigger reading affiliations reproduces ADR 0159's failure mode."  That
-- mechanism: an INVOKER function reading a table the caller cannot see returns NO ROWS,
-- and here "no rows" would read as "not anchorless" -- a predicted fail-CLOSED inverted
-- into a silent fail-OPEN.  In this phase that exact inversion already happened once and
-- survived its own mutation.
--
-- `public.guard_profile_privileged_columns` is already BEFORE UPDATE FOR EACH ROW on
-- `public.profiles`, already SECURITY DEFINER with a pinned search_path, already owned by
-- `postgres`, and already computes `new.is_admin is distinct from old.is_admin`.  The arm
-- inherits the whole ADR 0159 shape for free.  Ownership is not incidental:
-- `app.person_is_anchorless` is `postgres=X/postgres` and is NOT granted to
-- `authenticated` (measured -- calling it as `authenticated` raises `permission denied`),
-- so it is callable ONLY from inside a postgres-owned DEFINER.  A new INVOKER trigger
-- could not call it at all.
--
-- ⚠ THE HELPER CALL IS SCHEMA-QUALIFIED, AND THAT IS LOAD-BEARING.  This function's
-- pinned search_path is `public, pg_catalog` and EXCLUDES `app`.  An unqualified call
-- would raise 42883 at demotion time -- a runtime failure on a path nothing exercises,
-- which would read as the backstop working.  Pinned in 400 § 0.3 + § 0.4.
--
-- ⚠ THE PREDICATE IS REUSED, NOT RE-INLINED.  `app.person_is_anchorless` is increment
-- A's named helper.  A second expression of the same predicate is the drift shape this
-- phase has been closing; 400 § 0.4 asserts this body does NOT name
-- `organization_affiliations` itself.
--
-- ⚠ THE SUBJECT IS `new.id`, not `old.id`.  `authenticated` holds column UPDATE on
-- `profiles.id` (measured), and `tenant_orphan_profiles()` scans by `p.id`, so the
-- row-as-it-will-be is the id that would carry the orphan.  Fail-closed in the exotic
-- case; pinned in 400 § 0.5 so a later "tidy" reds instead of silently un-guarding it.
--
-- ============================================================================
-- WHY A DEDICATED SQLSTATE (`HC0RB`) AND NOT `check_violation`
-- ============================================================================
-- ⭐ THE DECISIVE ARGUMENT IS TEST VACUITY, NOT "codes should be specific".  This guard
-- ALREADY raises `check_violation` twice -- once for the identity/lifecycle columns and
-- once for a non-admin actor.  Had this arm raised 23514 as well, a deny cell asserting
-- 23514 could be satisfied by the WRONG ARM ENTIRELY, and the suite would stay green with
-- the backstop deleted.  A distinct code makes the refusal provably the intended one.
-- `HC0RB` is the next free code in the affiliation block (measured: zero occurrences
-- across supabase/migrations + src).
--
-- ⚠ ADR 0156:42-43 EXCLUDES trigger functions from the door-SQLSTATE gate's domain, and
-- line 49 gives the reason: they are "errcode sites that no `toState` mapper is
-- responsible for -- the gate would then demand pt-BR arms".  So minting `HC0RB` here is
-- PERMITTED and its mapper-lessness is the ANTICIPATED COST, not an oversight.  ⛔ Do not
-- "fix" it by adding a mapper arm on spec: measured, NO TypeScript path writes
-- `profiles.is_admin` at all -- the sole `src/` touch of the column against `profiles` is
-- a SELECT (`src/lib/members/invite.ts:118`, `.select('id, is_admin')`).  There is no
-- mapper to owe today.  The only producer of this raise is a direct PostgREST UPDATE,
-- which the column grant and RLS permit; this arm is defence-in-depth against a path the
-- application does not take.  Consequence, stated: triggers are outside pgTAP 304 §6's
-- domain, so `supabase/tests/400` is the ONLY drift protection on this arm.
--
-- The message is pt-BR and says plainly what is wrong.  ⚠ There is deliberately NO
-- oracle concern here and `HC0R0`'s conflation is NOT copied: the actor is already an
-- admin acting on a profile they can already see, so the refusal discloses nothing they
-- could not read directly.
--
-- ============================================================================
-- `is_active` — RULED, AND THE RULING IS "NO ARM"
-- ============================================================================
-- `is_active` sits in the same `v_privilege_changed` computation, so the question is
-- real.  Measured, not reasoned: a 2x2 differential (anchored / anchorless x is_active
-- true / false, plus an anchorless ADMIN both ways) moved orphan membership in ZERO
-- cells.  `app.tenant_orphan_profiles()` carries no `is_active` term at all, so
-- deactivation cannot manufacture an orphan -- it is a genuinely different question (a
-- platform-wide kill switch, ADR 0133).  An arm there would refuse a legitimate
-- deactivation while preventing nothing.
--
-- ⛔ THE TRUSTED-CALLER RETURN IS UNTOUCHED.  `auth.uid() is null -> return new` is
-- preserved verbatim; migrations and seeds demote through it, and
-- `.claude/rules/profiles-guard-never-widened.md` forbids WIDENING it.  This arm
-- NARROWS, which is the permitted direction.  400 § 3 asserts the bypass still works.
-- ============================================================================

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_actor_is_admin boolean;
  v_identity_changed boolean;
  v_privilege_changed boolean;
begin
  v_privilege_changed :=
       new.is_admin is distinct from old.is_admin
    or new.is_active is distinct from old.is_active;

  v_identity_changed :=
       new.suspended_until is distinct from old.suspended_until
    or new.email_confirmed_at is distinct from old.email_confirmed_at
    or new.home_organization_id is distinct from old.home_organization_id
    or new.cpf is distinct from old.cpf
    or new.professional_category_id is distinct from old.professional_category_id
    or new.must_change_password is distinct from old.must_change_password
    -- AFF2 B1 (ADR 0133 D10 / Amdt 1 ruling 6): the two new person columns are
    -- service-role-only, exactly like cpf directly above them.
    or new.date_of_birth is distinct from old.date_of_birth
    or new.phone is distinct from old.phone;

  if not v_privilege_changed and not v_identity_changed then
    return new;
  end if;

  -- service_role / postgres (no auth.uid) are trusted callers — the action path.
  if auth.uid() is null then
    return new;
  end if;

  -- Identity/lifecycle columns are service-role-only: NO signed-in caller edits them.
  if v_identity_changed then
    raise exception 'identity/lifecycle columns are service-role-only'
      using errcode = 'check_violation';
  end if;

  -- is_admin/is_active: admin-only in-session (legacy behavior preserved).
  select is_admin into v_actor_is_admin
  from public.profiles where id = auth.uid();

  if not coalesce(v_actor_is_admin, false) then
    raise exception 'only an admin may change is_admin/is_active'
      using errcode = 'check_violation';
  end if;

  -- ⭐ CNV-5 / R2-m3 — THE DEMOTION BACKSTOP.  Placed LAST, deliberately: it sits BEHIND
  -- the actor check rather than replacing it, so a non-admin caller still gets the
  -- cheaper `check_violation` above and never reaches this read (400 § 4.2 pins that).
  --
  -- Gated on true->false ONLY.  PROMOTION is untouched — an arm keyed on "is_admin
  -- changed" would refuse legitimate promotions of anchorless people, and would pass
  -- every other cell in 400 (§ 2.9 is the opposite-polarity cell that catches it).
  --
  -- `coalesce` is fail-closed rather than decorative: both columns are NOT NULL today,
  -- and if either ever became nullable a NULL `new.is_admin` reads as "no longer an
  -- admin" and is checked, instead of silently skipping the guard.
  if coalesce(old.is_admin, false)
     and not coalesce(new.is_admin, false)
     and app.person_is_anchorless(new.id)
  then
    raise exception
      'não é possível remover a condição de administrador de plataforma sem antes registrar um vínculo organizacional para esta pessoa'
      using errcode = 'HC0RB';
  end if;

  return new;
end;
$function$;
