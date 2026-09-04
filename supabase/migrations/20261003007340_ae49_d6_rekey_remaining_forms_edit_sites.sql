-- BUG-AE49-D6-REKEY-INCOMPLETE — `commission.forms.edit` was re-keyed at FOUR of the SIX policy
-- sites that exist for it. This migration re-points the remaining two, so representative 1 of
-- ADR 0176 D6 ("the three representatives, each END TO END") is true of every policy site rather
-- than 4/6 of them.
--
-- door-sweep-targets: public.form_item_options / form_item_options_staff_admin_write
--                     public.form_item_validations / form_item_validations_staff_admin_write
--
-- ============================================================================
-- WHAT THIS IS. 20261003007300 introduced `app.can_edit_commission_forms(uuid, uuid)` — the
-- layer-3 domain authorizer (0176 D2) — and re-pointed `forms`, `form_versions`, `form_sections`
-- and `form_items` onto it. `form_item_options_staff_admin_write` and
-- `form_item_validations_staff_admin_write` were missed. Both still read, VERBATIM, the
-- pre-cutover predicate that migration replaced everywhere else, measured from `pg_policies` at
-- head 20261003007330 immediately before this file was written, in BOTH halves of BOTH policies:
--
--   (app.is_staff_admin_of(app.commission_of_version(form_version_id))
--    OR app.is_tenancy_admin_of(app.commission_of_version(form_version_id)))
--
-- ⛔ THE TWO SITES ARE NOT EQUALLY REACHABLE, AND THE DIFFERENCE IS LOAD-BEARING. Measured from
-- `information_schema.role_table_grants` at the same head:
--
--   public.form_item_options      `authenticated` -> SELECT, INSERT, UPDATE, DELETE   (LIVE door)
--   public.form_item_validations  `authenticated` -> SELECT ONLY                      (BACKSTOP)
--
-- So site 5 is a door a PostgREST write actually passes through, and site 6 is a policy no
-- `authenticated` statement can reach at all — "a correct door nothing can reach". Its writes go
-- through `public.set_item_validations` (SECURITY DEFINER), which gates on
-- `app.is_staff_admin_of(...) OR app.is_tenancy_admin_of(...)` and carries NO permission-code
-- literal, i.e. it is pending-rekey and this migration does NOT move it.
-- ⚠ CONSEQUENCE, STATED SO THE GATE RECORD CANNOT OVERCLAIM: after this file the grant-deletion
-- mutation flips every POLICY site of `commission.forms.edit`, and still does not flip the
-- validations write PATH, because that path is a DEFINER door. 409 § 2.6d/2.6e assert the two
-- grant postures on both polarities and § 2.10c pins the door's layer-1 state as a countdown that
-- must red when AE5 moves it. ⛔ This was found by writing the behavioural probe FIRST: the
-- `lives_ok` baseline died with `42501 permission denied for table form_item_validations` while
-- its `throws_ok` mutated twin PASSED — a probe that would have reported the gate flipping while
-- measuring a missing INSERT grant that never moved.
--
-- ⛔ THIS IS A CONFORMANCE DEFECT, NOT AN EXPOSURE. `is_staff_admin_of` is at least as tight as
-- it ever was, so nothing widened and no principal gained reach. What was false is the D6 gate
-- line: deleting the `staff_admin -> commission.forms.edit` grant stopped that principal editing
-- `forms` / `form_versions` / `form_sections` / `form_items` while leaving option and validation
-- rows writable. The mutation flipped four of the six doors and the gate record said "the
-- production door".
--
-- ⛔ WHY NOTHING RED, WHICH IS THE MORE IMPORTANT HALF. pgTAP 410's set differences ran on the
-- PERMISSION axis; `enforcementSites` completeness was checked in NEITHER direction, so a
-- declared-but-unre-keyed site could not fail and an undeclared enforcing site was invisible.
-- ADR 0176 D5's claim that generation "fails on set difference in either direction" was, on the
-- site axis, false. That gap is FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE and is closed in the
-- same commit by 410 § 8, which was observed RED on these two sites before this file existed and
-- GREEN after — the vacuity proof is recorded in that section's own assertion messages.
--
-- ============================================================================
-- ⛔ THE EQUIVALENCE ARGUMENT — PROVED HERE, NOT INHERITED FROM 20261003007300.
--
-- "It landed at four sibling sites" is not evidence about these two. The substitution is
--
--     app.is_staff_admin_of(C) OR app.is_tenancy_admin_of(C)
--       ==  app.can_edit_commission_forms(C, (select auth.uid()))
--
-- with C = `app.commission_of_version(form_version_id)`, and it is proved arm by arm from the
-- LIVE CATALOG (`pg_get_functiondef`, head 20261003007330), never from migration text:
--
--  ARM B (tenancy) — IDENTICAL BY DEFINITION, not by argument. The catalog body of
--    `app.is_tenancy_admin_of(x)` is literally `select app.is_tenancy_admin_of_for(x, (select
--    auth.uid()))`. The authorizer's preserved arm is `app.is_tenancy_admin_of_for(C, p_uid)`
--    and every call site passes `(select auth.uid())` as p_uid. Same function, same argument.
--    The `_of` -> `_of_for` swap therefore changes NOTHING here; it changes something only where
--    p_uid is a third party, which no policy site is.
--
--  ARM A (staff_admin) — EQUAL, CONDITIONAL ON ONE CATALOG ROW, WHICH IS THE POINT OF D6.
--    `app.is_staff_admin_of(C)` = `authz.holds_role(auth.uid(),'staff_admin','commission',C)`.
--    The authorizer's re-keyed arm is
--    `authz.has_permission(uid,'commission',C,'commission.forms.edit')`. Term by term:
--      · scope-kind validation: `authz.permissions.resolution_scope_kind` for this code is
--        `commission` (measured), so `has_permission`'s fail-closed scope check passes rather
--        than denying.
--      · role set: `has_permission` requires `role_state = 'authoritative'`, and `staff_admin` is
--        the ONLY authoritative role (measured: 11 others are `legacy`). So the two predicates
--        range over the same role.
--      · scope reach: `authz.scope_reaches` with `p_resolution_kind = 'commission'` has NO ascent
--        arm — it reduces to `p_assignment_kind = 'commission' AND p_assignment_id = C`, exactly
--        `holds_role`'s `af.scope_kind/af.scope_id` equality. A hospital- or org-scoped
--        assignment reaches nothing here, on either side.
--      · the HAT: `authz.entailed_grants` carries the §6A asymmetry clause
--        `(p_principal is distinct from (select auth.uid()) or af.role_code is not distinct from
--        app.active_role())` — the SAME clause `holds_role` carries, verbatim. At these sites
--        p_uid IS auth.uid(), so both reduce to `active_role() = 'staff_admin'`.
--      · entitlement: the one term `holds_role` does not have. `staff_admin` holds
--        `commission.forms.edit` in `authz.role_permissions` (measured: exactly one granting
--        role), and `authz.permission_implication_closure` over this code is reflexive-only
--        (1 row). So the extra term is TRUE today — and making that row load-bearing is the
--        entire object of D6. ⛔ It is a dependency, stated, not a hidden assumption.
--      · NULL principal: legacy denies via `assignment_facts`' `app.is_active(NULL) = false`
--        (fail-closed by construction) and via `is_tenancy_admin_of_for`'s own `is_active`; the
--        authorizer additionally short-circuits on `p_uid is not null`. Both sides deny; the new
--        side returns FALSE where the old could return NULL, which RLS treats identically.
--
--  MEASURED, NOT ONLY ARGUED. On a fresh reset at head 20261003007330 the two predicates were
--  evaluated over 6 204 cells — 94 principals (every principal with a membership touching a
--  form-owning commission, plus platform admins, plus deactivated profiles, plus all 36
--  `@test.local` personas) x 11 `active_role` values (NULL + every role in `memberships`) x 6
--  commissions (the 3 that own forms + 3 that do not), with `request.jwt.claims` set per cell so
--  auth.uid() and the hat are the REAL ones — plus the no-JWT case:
--
--     DISAGREEMENTS: 0.   NULL results: 0.
--     Positive population: staff_admin arm TRUE in 5 cells, tenancy arm TRUE in 18.
--
--  ⛔ AND THE HARNESS WAS PROVEN ABLE TO DISAGREE, because "0 disagreements" over an all-false
--  population is the same green as a dead probe. Deleting the single
--  `staff_admin -> commission.forms.edit` grant row in a rolled-back transaction produced exactly
--  5 disagreements, and they were exactly the 5 staff_admin-arm-only cells (0 others). So the
--  agreement above is an observation, and the one term that is NOT shared between the two
--  predicates is the one that moves the answer.
--
-- ⛔ AND NEVER `legacy OR new` FOR THE SAME ARM (0155 D7 / 0176 Consequences). The staff_admin
-- arm is REPLACED, not disjoined with its predecessor; the tenancy arm is a different population
-- and is preserved because `org_admin` / `hospital_admin` are still `legacy` and their catalog
-- grants are inert.
--
-- ============================================================================
-- ⛔ WHAT THIS DELIBERATELY DOES **NOT** DO.
--
--  * It does NOT create a write policy on `public.form_block_library` — the seventh name in
--    matrix row 1. That would WIDEN, not conform. Measured on the live catalog: `authenticated`
--    holds SELECT and nothing else on that table (table-level AND column-level), the table's only
--    policy is `form_block_library_select`, and EVERY write goes through a `SECURITY DEFINER`
--    door owned by `postgres` — `save_block_to_library`, `update_block_library_entry`,
--    `delete_block_library_entry` (plus `insert_block_from_library`, which reads it). It is a
--    `D` site, not an `R` site, so matrix row 1's "(7 ALL)" is stale by one and the correction is
--    a matrix edit filed as review finding F-REC-4, not a migration. All four doors gate on
--    `app.is_staff_admin_of(...) OR app.is_tenancy_admin_of(...)` and carry no permission-code
--    literal: they are pending-rekey, and re-keying them is AE5 work, not this bug's.
--
--  * It does NOT re-key the DEFINER form doors ("D 8 form fns" in matrix row 1). Confirmed
--    against the catalog: ZERO of them carry a permission-code literal — in fact exactly FOUR
--    (function, code) pairs exist in `app` + `public` at this head, and all four are authorizers
--    (`can_edit_commission_forms`, `can_create_professional`, `can_read_professional_profile`,
--    `current_professional_read_organizations`). Twenty-two DEFINER functions gate form-family
--    tables on `is_staff_admin_of`; none is re-keyed. "The production door" for representative 1
--    therefore means the POLICY door, and after this file that door is whole.
--
--  * It does NOT touch `app.can_edit_commission_forms`. The authorizer is re-emitted nowhere —
--    only the two policies move — so 409 § 2.2 and 410 § 3.7 measure the same body as before.
--
--  * It does NOT touch `app.is_staff_admin_of`'s remaining surface, and self-verification (4)
--    below pins that the count fell by exactly the two policies this file takes.
--
-- ============================================================================
-- WHY `alter policy`, WITH NO DROP. Both policies keep their NAMES, so every name-keyed
-- assertion in the suite (401, 409, 410, the door-sweep case list) survives. A drop+create would
-- orphan those verdicts for no gain — "a rename orphans a name-keyed verdict" applies to a
-- re-create just as well. No function is created or replaced here, so no ACL changes and no
-- dependent object is invalidated.
-- ============================================================================

alter policy form_item_options_staff_admin_write on public.form_item_options
  using       (app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid())))
  with check  (app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid())));

alter policy form_item_validations_staff_admin_write on public.form_item_validations
  using       (app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid())))
  with check  (app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid())));


-- ============================================================================
-- SELF-VERIFICATION. Every claim above that a later reader could otherwise only take on trust is
-- re-derived from the CATALOG here, so this migration fails LOUDLY rather than landing a
-- half-applied re-key. Same shape as 20261003007300's, extended to six sites.
-- ============================================================================
do $mig$
declare
  v_bad text;
  v_n   int;
begin
  -- (1) The authorizer this file points at exists, with the house shape. ⛔ Asserted even though
  --     this migration does not create it: an `alter policy` onto a MISSING function fails at
  --     DDL time, but onto a function that has silently lost DEFINER or its pinned search_path it
  --     succeeds and changes the answer.
  if to_regprocedure('app.can_edit_commission_forms(uuid,uuid)') is null then
    raise exception 'AE4.9 D6 (bug fix): app.can_edit_commission_forms(uuid,uuid) is ABSENT.'
      using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'can_edit_commission_forms'
       and (not p.prosecdef
            or p.proconfig is null
            or not ('search_path=app, public, pg_catalog' = any (p.proconfig)))
  ) then
    raise exception 'AE4.9 D6 (bug fix): can_edit_commission_forms is not DEFINER with the pinned search_path.'
      using errcode = 'check_violation';
  end if;

  -- (2) It is reachable from these two policies. A policy expression is evaluated AS THE QUERYING
  --     ROLE, so without EXECUTE every option/validation write would 42501 — a silent deny-all
  --     dressed as a re-key. ⛔ Effective privilege, never `proacl` text (a NULL proacl includes
  --     PUBLIC).
  if not (has_function_privilege('authenticated', 'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE')
      and has_function_privilege('service_role',  'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE')) then
    raise exception 'AE4.9 D6 (bug fix): authenticated/service_role lack EXECUTE — every form write would 42501.'
      using errcode = 'check_violation';
  end if;
  if has_function_privilege('anon', 'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE') then
    raise exception 'AE4.9 D6 (bug fix): anon holds EXECUTE on the authorizer.'
      using errcode = 'check_violation';
  end if;

  -- (3) ALL SIX policies, in BOTH halves, now call layer 3 and neither half still calls the
  --     layer-1 wrapper. `USING` gates WHICH ROWS may be touched, `WITH CHECK` gates the NEW row;
  --     a gate present in only one half is a real hole, so both are asserted separately.
  select string_agg(policyname, ', ')
    into v_bad
    from pg_policies
   where tablename in ('forms','form_versions','form_sections','form_items',
                       'form_item_options','form_item_validations')
     and policyname like '%_staff_admin_write'
     and not (coalesce(qual,'')       ~ 'can_edit_commission_forms'
          and coalesce(with_check,'') ~ 'can_edit_commission_forms'
          and coalesce(qual,'')       !~ 'is_staff_admin_of'
          and coalesce(with_check,'') !~ 'is_staff_admin_of');
  if v_bad is not null then
    raise exception 'AE4.9 D6 (bug fix): these form write policies are not fully re-keyed in both halves: %', v_bad
      using errcode = 'check_violation';
  end if;
  select count(*) into v_n
    from pg_policies
   where tablename in ('forms','form_versions','form_sections','form_items',
                       'form_item_options','form_item_validations')
     and policyname like '%_staff_admin_write';
  if v_n <> 6 then
    raise exception 'AE4.9 D6 (bug fix): expected SIX form write policies, found % — the set moved.', v_n
      using errcode = 'check_violation';
  end if;

  -- (4) `is_staff_admin_of`'s OTHER surface did not move. 20261003007300 asserted 59 after taking
  --     four of the 63 it measured; this file takes exactly two more.
  select count(*) into v_n
    from pg_policies
   where coalesce(qual,'') || coalesce(with_check,'') ~ '\yis_staff_admin_of\y';
  if v_n <> 57 then
    raise exception
      'AE4.9 D6 (bug fix): bare is_staff_admin_of policy count is % — expected 59 - 2 = 57. '
      'Either this migration moved more than its two sites, or the surface changed under it.', v_n
      using errcode = 'check_violation';
  end if;

  -- (5) THE SCOPE EXPRESSION IS UNCHANGED. The whole equivalence argument above is stated for
  --     C = app.commission_of_version(form_version_id); a re-key that also moved the scope
  --     derivation would be a different change wearing this file's justification.
  select string_agg(policyname, ', ')
    into v_bad
    from pg_policies
   where tablename in ('form_item_options','form_item_validations')
     and policyname like '%_staff_admin_write'
     and not (coalesce(qual,'')       ~ 'commission_of_version\(form_version_id\)'
          and coalesce(with_check,'') ~ 'commission_of_version\(form_version_id\)');
  if v_bad is not null then
    raise exception 'AE4.9 D6 (bug fix): the scope expression moved at: %', v_bad
      using errcode = 'check_violation';
  end if;

  -- (6) NO NEW PERMISSION-CODE LITERAL LANDED. This file re-points policies at an EXISTING
  --     authorizer; it must not have created a second carrier for the code. D7's "statically
  --     greppable" is only useful while the code sits at one gate. Measured before: FOUR
  --     (function, code) pairs in app+public — three authorizers plus 20261003007320's second
  --     `org.professionals.read` site.
  select count(*) into v_n
    from (select n.nspname, p.proname,
                 regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') as src
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('app','public')) b
    join authz.permissions pm on b.src like '%' || pm.code || '%';
  if v_n <> 4 then
    raise exception
      'AE4.9 D6 (bug fix): % function/permission-code literal pairs in app+public — expected 4. '
      'This migration adds none; a change here means something else moved under it.', v_n
      using errcode = 'check_violation';
  end if;

  -- (7) The PRESERVED tenancy arm is still inside the authorizer. Dropping it would lock every
  --     org_admin / hospital_admin out of the two tables this file just re-pointed at it, and
  --     that regression is invisible to a staff_admin-keyed differential.
  if (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app' and p.proname = 'can_edit_commission_forms')
     not like '%is_tenancy_admin_of_for%' then
    raise exception 'AE4.9 D6 (bug fix): can_edit_commission_forms lost the tenancy arm.'
      using errcode = 'check_violation';
  end if;

  -- (8) The role states the equivalence argument depends on. `staff_admin` must be
  --     `authoritative` or arm A just lost its whole population at these two sites; the tenancy
  --     roles must still be `legacy` or the preserved arm is no longer the reason they pass.
  if (select state::text from authz.roles where code = 'staff_admin') <> 'authoritative' then
    raise exception 'AE4.9 D6 (bug fix): staff_admin is not `authoritative` — the re-keyed arm grants nothing.'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from authz.roles where code in ('org_admin','hospital_admin','platform_admin')
                                          and state::text <> 'legacy') then
    raise exception 'AE4.9 D6 (bug fix): a tenancy role is no longer `legacy` — re-check the preserved arm.'
      using errcode = 'check_violation';
  end if;

  -- (9) THE ENTITLEMENT ROW THE EQUIVALENCE RESTS ON. Arm A is equal to its predecessor only
  --     while `staff_admin` holds this code, and only while nothing ELSE implies it — a second
  --     implying code would make 409's single-row deletion a no-op and its ⭐ mutations would
  --     read "no flip" as a defect in the re-key rather than in the fixture.
  if (select count(*) from authz.role_permissions
       where permission_code = 'commission.forms.edit') <> 1 then
    raise exception 'AE4.9 D6 (bug fix): `commission.forms.edit` is not granted to exactly one role.'
      using errcode = 'check_violation';
  end if;
  if (select count(*) from authz.permission_implication_closure
       where implied = 'commission.forms.edit') <> 1 then
    raise exception
      'AE4.9 D6 (bug fix): the implication closure over `commission.forms.edit` is no longer '
      'reflexive-only — the D6 grant-deletion mutation would no longer flip the door.'
      using errcode = 'check_violation';
  end if;

  -- (10) `form_block_library` IS STILL WRITE-POLICY-FREE. Stated as an assertion because the
  --      "do not create one" paragraph above is prose, and a later migration adding one would be
  --      a WIDENING (today `authenticated` holds no DML grant at all, so no policy could grant).
  --      ⛔ If this reds, the correct response is to RULE on the change, not to delete this block.
  select count(*) into v_n from pg_policies
   where schemaname = 'public' and tablename = 'form_block_library' and cmd <> 'SELECT';
  if v_n <> 0 then
    raise exception
      'AE4.9 D6 (bug fix): form_block_library acquired % non-SELECT policy/policies. Its writes '
      'go through SECURITY DEFINER doors and `authenticated` holds SELECT only; a write policy '
      'there is a widening that needs a ruling.', v_n
      using errcode = 'check_violation';
  end if;
end $mig$;
