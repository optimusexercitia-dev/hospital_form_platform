-- AE2 — DROP `public.profiles.home_organization_id`.
--
-- The terminal increment of the AE2 re-predication (ADR 0164). Every authority,
-- roster, picker and containment predicate that once read this column has already
-- moved onto `public.organization_affiliations`, increment by increment, each with
-- its own differential suite (390–396). What remains is the column itself.
--
-- ============================================================================
-- THE CLOSED SET, RE-DERIVED FROM `pg_proc` RATHER THAN FROM THE MIGRATIONS
-- ============================================================================
-- Migration file text is stale by design in this tree (ADR 0078 METHODOLOGY
-- FINDING), so the set of function bodies still reading the column was derived
-- from the live catalog on 2026-08-28:
--
--   select n.nspname, p.proname from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ilike '%home_organization_id%';
--
-- EIGHT functions match on raw `prosrc`; FIVE of those match only inside a `--`
-- comment recording that the column already left them (`app.can_administer_person_for`,
-- `app.update_person_fields_impl`, `app.affiliate_person_to_org_impl`,
-- `public.list_org_people`, `public.list_addable_commission_members`). Those comments
-- are historical notes and are deliberately left alone — rewriting them here would
-- churn five function bodies to change nothing that executes.
--
-- THREE carry a real code reference, and all three are handled below:
--   1. public.handle_new_user                 — the INSERT column list + its value
--   2. public.guard_profile_privileged_columns — one disjunct of v_identity_changed
--   3. test_helpers.bootstrap                  — a fixture UPDATE (supabase/tests/00_setup.sql)
--
-- ⚠ (3) IS NOT ASSERTED BY ANYTHING. Both "which functions still name the column"
--   keystones (394 § 1.5, 395 § 7.2) bound their domain with `nspname in ('app','public')`,
--   and `test_helpers` is in neither. Those two assertions therefore stay GREEN while a
--   `test_helpers.bootstrap` left unedited would fail every suite that calls it at run
--   time. It is edited in the same change as this migration; the gap is recorded here
--   because a reader auditing "what proves the drop is complete?" would otherwise
--   conclude the two keystones cover it.
--
-- ⭐ CLOSED IN THIS SAME INCREMENT, and the note above is kept as the RECORD of why:
--   394 § 1.5 was INVERTED rather than deleted, and its domain widened to the WHOLE
--   CATALOG (no `nspname` filter), asserting `column_present=false|(none)`. The
--   `column_present=false` half is there because `(none)` alone is an empty aggregate a
--   broken probe also satisfies. 395 § 7.2 was DELETED rather than inverted too --
--   two copies of a catalog-absence claim is how one goes stale unnoticed.
--
-- ============================================================================
-- DEPENDENCIES — MEASURED, NOT ASSUMED
-- ============================================================================
-- `pg_depend` over (profiles, attnum of home_organization_id) returns exactly ONE
-- entry: the `profiles_home_organization_id_fkey` FOREIGN KEY, deptype 'a' (auto).
-- A constraint that depends on the dropped column is dropped WITH it, so this needs
-- no explicit DROP CONSTRAINT and no CASCADE — and using CASCADE would be worse than
-- redundant, because it would silently absorb any future dependency this measurement
-- says does not exist today.
--
-- Also measured, all empty: no RLS policy names the column (390 B7 / 392 § 1.1 /
-- 395 § 7.1 already pin this), no index, no view, no generated column, no CHECK
-- constraint, and neither `profiles` trigger carries a column list (both are
-- `<all columns>`, so neither is invalidated by the drop). The column-level ACL
-- entries go with the column.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. public.handle_new_user — the column leaves the INSERT.
--
-- ⚠ TWO STALE COMMENTS CORRECTED, NOT PROPAGATED. The body claimed that a
--   `profiles_tenant_has_org` CHECK "rejects a non-admin insert" and that the
--   admin bootstrap exists so that CHECK "holds immediately". Measured against
--   `pg_constraint` and `pg_trigger` on 2026-08-28: NO such constraint and no such
--   trigger exists — it was dropped by 20261003005600 when containment moved onto
--   the `organization_affiliations` destructive event. Carrying those sentences
--   forward would have re-asserted a control that is not there, which is the
--   tighter-reading-as-care failure mode.
--
-- The `user_metadata.home_organization_id` key that several TypeScript provisioning
-- paths still write becomes INERT rather than an error: nothing reads it after this.
-- Removing those writers is a separate, non-blocking cleanup.
--
-- ⭐ The admin bootstrap arm is UNCHANGED and still load-bearing for its real
--   reason: `is_admin` must be true at profile-creation time so the vendor
--   platform_admin is minted admin in one step. It is read from `raw_app_meta_data`,
--   the service-role-only channel — never from user_metadata, which the user can edit.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  insert into public.profiles (id, full_name, email, is_admin, email_confirmed_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    -- Provisioning-only admin bootstrap. Read from app_metadata (raw_app_meta_data),
    -- which is SERVICE-ROLE-ONLY and NOT user-editable (the skill: never trust
    -- user_metadata for authz; app_metadata is the safe channel). This lets a
    -- provisioning path mint the org-less vendor platform_admin at creation. The
    -- authoritative is_admin claim still derives from the profiles column via
    -- custom_access_token_hook; this only seeds that column. Defaults false for
    -- every ordinary invite.
    coalesce((new.raw_app_meta_data ->> 'bootstrap_admin')::boolean, false),
    new.email_confirmed_at
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. public.guard_profile_privileged_columns — one disjunct removed.
--
-- ⛔ THIS IS A COLUMN REMOVAL, NOT A REWRITE OF THE GUARD. The body below was
--    derived from `pg_get_functiondef` at head 20261003006400 and is reproduced
--    verbatim except for the single `new.home_organization_id is distinct from
--    old.home_organization_id` disjunct of `v_identity_changed`. In particular the
--    ADR 0166 / CNV-5 DEMOTION BACKSTOP added by 20261003006400 is preserved
--    exactly — its placement LAST (behind the actor check) is asserted by
--    400 § 4.2, and its true->false-only gating by 400 § 2.9.
--
-- Removing the disjunct narrows `v_identity_changed` by one column. That is the
-- intended and only behavioural change: there is no longer a column to guard.
-- The other eight identity/lifecycle columns are untouched.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. THE DROP.
--
-- No CASCADE, deliberately (see the dependency measurement in the header): the FK
-- is deptype 'a' on this column and goes with it. If a dependency this migration
-- did not measure ever appears, the bare DROP fails loudly and names it — which is
-- the outcome to want. CASCADE would remove it silently.
-- ---------------------------------------------------------------------------
alter table public.profiles drop column home_organization_id;

-- ---------------------------------------------------------------------------
-- 4. A DATABASE COMMENT THAT WENT FALSE, CORRECTED FORWARD.
--
-- `20261003006100` set a comment on app.person_known_to_org saying the predicate was
-- named so "pgTAP 393 § 5.7 can pin the sibling doors on a NAME rather than on SQL
-- text". That cell is DELETED in this increment: 399 § 3.1 supersedes it with a
-- CAPABILITY-bounded domain (every body that inserts into organization_affiliations)
-- instead of a five-name hand list -- which is the stronger form, and is what caught the
-- fourth door 393 § 5.7's name-bounded list could not see.
--
-- ⛔ CORRECTED FORWARD RATHER THAN BY EDITING 006100. That migration is committed, and a
--   comment is the one artefact that SHIPS INTO THE DATABASE -- an auditor reads
--   `\df+` output, not the migration that produced it. Rewriting applied history would
--   also leave any environment that already ran 006100 carrying the false text with
--   nothing to correct it.
-- ---------------------------------------------------------------------------
comment on function app.person_known_to_org(uuid, uuid) is
  'ADR 0168 § Decision 1. The ORDINARY doors'' whole containment predicate: the person '
  'has at least one NON-VOIDED organisation affiliation in THIS organisation. Named so '
  'the sibling doors can be pinned on a NAME rather than on SQL text -- the pin itself '
  'is pgTAP 399 § 3.1, which bounds its domain by CAPABILITY (every body inserting into '
  'organization_affiliations) rather than by a hand list of names. It superseded '
  '393 § 5.7, which this comment previously cited and which no longer exists.';
