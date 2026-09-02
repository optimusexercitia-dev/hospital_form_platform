-- AE4.9 (3/3) — ADR 0176 D6: the THREE DIFFERENTIAL REPRESENTATIVES are re-keyed
-- end-to-end, from the enforcement site down through layer 2. Plan § AE4.9; the gate line is
-- 0176 D6 ("✅ CONFIRMED 2026-09-02 (PO) … This is a gate line, not a proposal").
--
-- door-sweep-targets: app.can_edit_commission_forms(uuid, uuid)
--                     app.can_create_professional(uuid, uuid)
--                     app.can_read_professional_profile(uuid, uuid)
--
-- ============================================================================
-- WHAT THIS IS. 0176 D2 defines THREE interfaces. Layer 1 (`authz.holds_role`) answers a ROLE
-- question; layer 2 (`authz.has_permission`) answers a PERMISSION question and is NOT final
-- authorization; layer 3 is an `app.can_*` DOMAIN AUTHORIZER that carries the permission code
-- as a STRING LITERAL (D7's "statically greppable"), composes every non-entitlement rule, and
-- is the only thing an RLS policy or a command door may call for a permission decision.
--
-- Before this migration NO layer-3 authorizer existed. Measured on the live catalog at head
-- 20261003007260, immediately before writing this file, on a fresh `supabase db reset --local`:
--
--   with b as (select n.nspname, p.proname,
--                     regexp_replace(p.prosrc,'--[^'||chr(10)||']*','','g') src
--                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--               where n.nspname in ('app','public'))
--   select b.nspname, b.proname, pm.code
--     from b join authz.permissions pm on b.src like '%'||pm.code||'%';   ->  ZERO ROWS
--
-- So *no* function in `app` or `public` carried *any* of the 43 permission codes. That zero is
-- the baseline this migration moves to exactly THREE — one code at exactly one site each.
--
-- ============================================================================
-- THE F1 CONFORMANCE DEFECT, REPRODUCED HERE BEFORE THE FIX. For each representative, in a
-- rolled-back transaction at head 20261003007260, principal `chefe.ccih@test.local`
-- (staff_admin @ CCIH, active_role = staff_admin), the resolver measured as `postgres` and the
-- door under `set local role authenticated`:
--
--                                    grant present            grant DELETED
--   commission.forms.edit            resolver t / door t      resolver f / door **t**
--   org.professionals.create         resolver t / door t      resolver f / door **t**
--   org.professionals.read           resolver t / door t      resolver f / door **t**
--
-- The approved matrix was not the oracle of anything a user could observe (0176 Context). After
-- this migration the mutation must flip the DOOR, and pgTAP `409` is where that is asserted on
-- both polarities.
--
-- ============================================================================
-- ⛔ THE CORRECTNESS CONSTRAINT — WHY THIS IS NOT A ONE-LINE SUBSTITUTION.
--
-- `authz.has_permission` requires `authz.roles.state = 'authoritative'` and FAILS CLOSED
-- otherwise (0176 D4; 0177 D1). Exactly ONE role is authoritative — `staff_admin`. The other
-- ELEVEN are `legacy` and their `authz.role_permissions` rows are INERT (0177 D6, pinned by
-- pgTAP 401 §16.9b). So replacing a site's whole body with a bare `has_permission` call DENIES
-- every non-`staff_admin` principal the site legitimately passes today — a live authorization
-- regression that the AE4 differential CANNOT see, because the differential is keyed on
-- `staff_admin`.
--
-- Therefore, at every one of the three sites: ONLY the `staff_admin` arm is sourced from the
-- catalog. Every other arm is preserved VERBATIM. The arm inventory, measured from the live
-- catalog (`pg_policies`, `pg_get_functiondef`), is recorded per site below.
--
-- ⛔ AND NEVER `legacy OR new` FOR THE SAME ARM (0155 D7, restated in 0176 Consequences). The
-- sanctioned mixed state is per-SITE between layers 1 and 3, never per-caller and never a
-- disjunction of the old gate with the new one over the same population. Each preserved arm
-- below covers a population the re-keyed arm never covered.
--
-- ============================================================================
-- ⛔ WHAT THIS DELIBERATELY DOES **NOT** DO.
--
--  * It does NOT re-key `app.is_staff_admin_of`. That wrapper's `ELSE` class in 401 §19.2 covers
--    38 of the 43 codes, and it sits in 63 policies + 151 function bodies (0176 Context,
--    re-measured here: bare-name policy count = 63, prefix-matched function bodies = 179 for the
--    `_of` + `_for` pair together). Re-pointing it would cut over all 38 codes at once — the
--    exact opposite of D6, which requires everything but these three to enter the gate as
--    `pending-rekey`. Its remaining surface is asserted UNCHANGED by 409 §6.
--
--  * It does NOT touch `app.is_org_commission_staff_admin`. That helper keeps its two other
--    callers (`app.can_manage_external_participant`, `app.can_manage_case_vocabulary`) — rows 31
--    and 32, which stay `pending-rekey`.
--    ⚠ CONSEQUENCE, STATED HERE BECAUSE IT IS EXPECTED AND NOT A DEFECT: 401 §19.2b asserts that
--    the comment-stripped bodies of `can_create_professional`, `can_manage_external_participant`
--    and `can_manage_case_vocabulary` are IDENTICAL (count distinct = 1). After this migration
--    they are NOT — count distinct = 2. That assertion exists precisely to red when one of the
--    three moves and the other two do not, which is what has just happened. 401 is owned by
--    another agent this phase; the red is reported, not silenced here.
--
--  * It does NOT build the enforcement manifest (0176 D5), it does NOT touch `platform_role`
--    (0176 D8), and it measures NO performance. Performance acceptance is measured on the FINAL
--    path (0176 Consequences; plan IA-F9) and this migration is what first makes that path
--    exist — a policy body now runs layers 3 -> 2 -> 1 rather than 3 -> 1. That measurement is
--    owed and is not made here.
--
-- ============================================================================
-- WHY `create or replace` AND `alter policy`, WITH NO DROP ANYWHERE.
--
-- Both re-keyed functions keep their exact signature AND return type, so `create or replace` is
-- sufficient and no dependent policy is invalidated. `app.can_read_professional_profile(uuid,uuid)`
-- is referenced by the `USING` half of `professional_profiles_select` and
-- `professional_participants_select`; `app.can_create_professional(uuid,uuid)` is referenced by
-- four `SECURITY DEFINER` bodies. A DROP would silently invalidate those; a replace cannot.
-- The four policies are `ALTER`ed in place so their NAMES survive — a drop+create would break
-- every name-keyed census assertion in the suite for no gain.
-- ============================================================================


-- ============================================================================
-- SITE 1 — `commission.forms.edit`
--
-- ARM INVENTORY, measured from `pg_policies` (BOTH halves of all four policies were identical,
-- and both are rewritten — `USING` gates WHICH ROWS may be touched, `WITH CHECK` gates the NEW
-- row, and a gate present in only one half is a real hole):
--
--   arm A  app.is_staff_admin_of(<cid>)   -> authz.holds_role(auth.uid(),'staff_admin',
--                                            'commission',<cid>)                [LAYER 1]
--          ⇒ RE-KEYED to layer 3 below.
--   arm B  app.is_tenancy_admin_of(<cid>) -> app.is_active(uid)
--                                            AND (org_admin @ c.organization_id
--                                                 OR hospital_admin @ c.hospital_id)
--          ⇒ PRESERVED VERBATIM. `org_admin` and `hospital_admin` are BOTH `legacy`, so their
--            catalog grants are inert and `has_permission` fails closed for them. Measured on
--            this stack before the change: `orgadmin.a@test.local` and
--            `hospitaladmin.a1@test.local` each pass the door (UPDATE 1). Dropping this arm
--            would have logged out every tenancy admin from form editing.
--          ⚠ Note it carries NO `platform_admin` arm, consistent with the noun rule (ADR 0078
--            A35) — platform_admin may not touch commission content. That stays true.
--
-- The four sites (all `FOR ALL` PERMISSIVE to `authenticated`):
--   public.forms          / forms_staff_admin_write          cid = commission_id
--   public.form_versions  / form_versions_staff_admin_write  cid = (select f.commission_id from forms f where f.id = form_id)
--   public.form_sections  / form_sections_staff_admin_write  cid = app.commission_of_version(form_version_id)
--   public.form_items     / form_items_staff_admin_write     cid = app.commission_of_version(form_version_id)
--
-- ⛔ A NOTE FOR WHOEVER TESTS THIS: each of these four tables ALSO carries a permissive SELECT
-- policy (`*_select`, gated on `app.is_member_of`). A staff_admin is a member, so a SELECT-based
-- row assertion stays GREEN with this write policy entirely revoked — the permissive-sibling
-- shape (authz-handoff §7.1 shape 6). The door must be measured on a WRITE. 409 §2 does.
-- ============================================================================

create or replace function app.can_edit_commission_forms(p_commission_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
  -- LAYER 3 (ADR 0176 D2). The permission code is a STRING LITERAL so the enforcement site is
  -- statically greppable (D7), and it is the ONLY place `commission.forms.edit` appears in the
  -- catalog. There are no hard-deny classes on form editing, so the two arms are a plain
  -- disjunction and their ORDER carries no semantics (Postgres does not guarantee OR evaluation
  -- order in any case).
  select p_uid is not null and (
    -- RE-KEYED ARM — was `app.is_staff_admin_of(p_commission_id)` in all four policies.
    authz.has_permission(p_uid, 'commission', p_commission_id, 'commission.forms.edit')
    -- PRESERVED ARM — the tenancy admins (org_admin / hospital_admin), both `legacy` roles whose
    -- catalog grants are inert. This is the legacy-equivalence half; deleting it is the
    -- regression this migration exists to avoid. `_for` rather than the bare wrapper because
    -- layer 3 is given its principal explicitly; at every call site p_uid IS auth.uid(), so the
    -- two are the same answer (`is_tenancy_admin_of(x)` is literally
    -- `is_tenancy_admin_of_for(x, (select auth.uid()))`).
    or app.is_tenancy_admin_of_for(p_commission_id, p_uid)
  );
$fn$;

comment on function app.can_edit_commission_forms(uuid, uuid) is
  'Layer-3 domain authorizer (ADR 0176 D2/D6) for permission `commission.forms.edit`. Sole gate '
  'of the four form-table write policies. Arm 1 is the catalog permission; arm 2 is the '
  'preserved legacy tenancy-admin arm (org_admin / hospital_admin), which is NOT permission-keyed '
  'because both roles are still `legacy` and their grants are inert. Do NOT collapse arm 2 into '
  'the permission call until those roles flip to `authoritative` in AE5.';

-- Mirror the ACL of the wrapper this replaces at the four sites, exactly. `app.is_staff_admin_of`
-- and `app.is_tenancy_admin_of` both hold `{postgres, authenticated, service_role}` and NOT
-- `anon`; a policy expression is evaluated as the querying role, so without these grants every
-- form write would fail 42501. (`ALTER DEFAULT PRIVILEGES` in this database already strips the
-- PUBLIC EXECUTE Postgres would otherwise add — verified via `pg_default_acl`, and re-asserted
-- from effective privilege at the foot of this file, never from `proacl` text.)
grant execute on function app.can_edit_commission_forms(uuid, uuid) to authenticated, service_role;

alter policy forms_staff_admin_write on public.forms
  using       (app.can_edit_commission_forms(commission_id, (select auth.uid())))
  with check  (app.can_edit_commission_forms(commission_id, (select auth.uid())));

alter policy form_versions_staff_admin_write on public.form_versions
  using       (app.can_edit_commission_forms(
                 (select f.commission_id from public.forms f where f.id = form_versions.form_id),
                 (select auth.uid())))
  with check  (app.can_edit_commission_forms(
                 (select f.commission_id from public.forms f where f.id = form_versions.form_id),
                 (select auth.uid())));

alter policy form_sections_staff_admin_write on public.form_sections
  using       (app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid())))
  with check  (app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid())));

alter policy form_items_staff_admin_write on public.form_items
  using       (app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid())))
  with check  (app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid())));


-- ============================================================================
-- SITE 2 — `org.professionals.create`   (`app.can_create_professional`, row 43)
--
-- ARM INVENTORY, from `pg_get_functiondef` before the change:
--     select app.can_manage_professional(p_org, p_uid)
--         or app.is_org_commission_staff_admin(p_org, p_uid);
--
--   arm 1  app.can_manage_professional(p_org, p_uid)
--            = p_uid is not null AND (app.is_admin() OR app.is_org_admin_of(p_org))
--          ⇒ PRESERVED VERBATIM, call unchanged. Covers `platform_admin` (via `is_admin()`, which
--            also requires the platform_admin hat) and `org_admin` — both `legacy`.
--          ⚠ Its own header records FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM: `is_admin()` and
--            `is_org_admin_of()` read the CALLER's auth.uid(), not `p_uid`. That is a KNOWN,
--            NARROWED defect of arm 1 and this migration does not touch it — moving it would move
--            an answer, and this file's claim is that only the staff_admin arm moves.
--   arm 2  app.is_org_commission_staff_admin(p_org, p_uid)
--            = p_uid is not null AND exists (a commission in p_org where
--                                            app.is_active(p_uid) AND is_staff_admin_of_for(c.id, p_uid))
--          ⇒ RE-KEYED. Its population is exactly "holds `staff_admin` at some commission that
--            reaches p_org", which is what `authz.scope_reaches` computes for a commission-scoped
--            assignment against an organization-scoped permission (401 §16.8 pins that ascent).
--            The hat semantics are identical on both sides: `holds_role` and
--            `authz.entailed_grants` carry the SAME §6A asymmetry clause verbatim
--            (`p_principal is distinct from auth.uid() OR role_code = app.active_role()`), so a
--            self-check applies the hat before and after, and a third-party check ignores it
--            before and after.
--
-- ⚠ The helper `app.is_org_commission_staff_admin` is NOT dropped — it keeps two other callers.
-- ============================================================================

create or replace function app.can_create_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
  -- LAYER 3 (ADR 0176 D2/D6). `org.professionals.create` resolves at `organization` scope, which
  -- `authz.has_permission` validates against `authz.permissions.resolution_scope_kind` and denies
  -- on mismatch (0176 D4) — so the scope kind below is enforced, not decorative.
  select
    -- PRESERVED ARM — org authority (platform_admin via is_admin(), org_admin). Both `legacy`.
    app.can_manage_professional(p_org, p_uid)
    -- RE-KEYED ARM — was `app.is_org_commission_staff_admin(p_org, p_uid)`.
    or authz.has_permission(p_uid, 'organization', p_org, 'org.professionals.create');
$fn$;

comment on function app.can_create_professional(uuid, uuid) is
  'Layer-3 domain authorizer (ADR 0176 D2/D6) for permission `org.professionals.create` (catalog '
  'row 43). Arm 1 preserves the legacy org authority (platform_admin / org_admin); arm 2 is the '
  'catalog permission and replaces the former `is_org_commission_staff_admin` ascent. ⚠ Its body '
  'no longer matches `can_manage_external_participant` / `can_manage_case_vocabulary` (rows 31 and '
  '32, still pending-rekey) — 401 §19.2b asserts that identity and is EXPECTED to red here.';


-- ============================================================================
-- SITE 3 — `org.professionals.read`   (`app.can_read_professional_profile`, row 33)
--
-- ARM INVENTORY, from `pg_get_functiondef` before the change:
--   guard  p_uid is null                              -> false     ⇒ PRESERVED
--   arm 1  app.is_admin()                             -> true      ⇒ PRESERVED VERBATIM
--            (reads the CALLER's auth.uid() and requires the platform_admin hat, not p_uid;
--             403 §7.2 bounds it as structurally silent in the differential fixture)
--   arm 2  v_org := the profile's organization_id;
--          app.can_create_professional(v_org, p_uid)  -> true      ⇒ SPLIT, see below
--   arm 3  professional_participants -> case_participants(live)
--          -> app.can_read_case_committee(cp.case_id, p_uid)       ⇒ PRESERVED VERBATIM
--
-- ARM 2 IS SPLIT, AND THIS IS THE ONLY SEMANTIC CHANGE IN THIS SITE. It called
-- `can_create_professional`, i.e. the row-43 gate, for a row-33 READ. 401 §19.3 records why —
-- *"row 33 is a code staff_admin KEEPS, so the read arm had to follow the POPULATION, not the
-- gate name"*. That workaround is now unnecessary AND actively wrong: if this site kept calling
-- `can_create_professional`, deleting the `org.professionals.read` grant would not flip it, and
-- the D6 mutation for row 33 would be measuring row 43's code. So arm 2 becomes:
--     app.can_manage_professional(v_org, p_uid)                    [the preserved legacy half]
--  OR authz.has_permission(p_uid,'organization',v_org,'org.professionals.read')   [re-keyed]
-- The POPULATION is unchanged: `staff_admin` holds BOTH row 33 and row 43 (401 §19.4 measures
-- all 43 codes resolving TRUE for a staff_admin except the AE4.7c-revoked
-- `org.professionals.manage`), and the legacy half is the same call it already made.
--
-- ⛔ A NOTE FOR WHOEVER TESTS THIS: arm 3 MASKS arm 2 whenever the subject professional sits in a
-- case the caller can read. Measured on this stack: the ONE seeded `professional_profiles` row
-- (`fb…e1`) HAS a `professional_participants` row and
-- `app.can_read_case_committee(ca…e1, chefe.ccih)` is TRUE — so a mutation aimed at arm 2 reads
-- green-after-mutation on that subject for a reason unrelated to the re-key ("a mutation's effect
-- can be MASKED by a legitimately-open arm"). 403 §7.3's "arm 3 cannot grant in this fixture" is
-- true of 403's OWN fixture, not of the seed. 409 §4 builds a participation-free subject and
-- ASSERTS the mask closed before mutating.
-- ============================================================================

create or replace function app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
declare
  v_org uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  -- ETH·E4 (ADR 0108 D5) — the org-manager arm. See the header for the exposure
  -- argument and the two accepted adjacent exposures.
  select organization_id into v_org
  from public.professional_profiles
  where id = p_profile_id;

  -- LAYER 3 (ADR 0176 D2/D6). `org.professionals.read` is resolved at the org DERIVED from the
  -- profile above — 401 §19.3 pins that second-order derivation as this row's known exception to
  -- the gate-signature cross-check, and it is why the scope id below is `v_org` and not a
  -- parameter.
  if v_org is not null and (
       -- PRESERVED ARM — the legacy org authority half of the former can_create_professional call.
       app.can_manage_professional(v_org, p_uid)
       -- RE-KEYED ARM — was the `is_org_commission_staff_admin` ascent inside
       -- can_create_professional, i.e. row 43's code standing in for row 33's.
       or authz.has_permission(p_uid, 'organization', v_org, 'org.professionals.read')
     ) then
    return true;
  end if;

  -- DEFINER traversal over BASE tables (bypasses RLS ⇒ no case_participants recursion,
  -- ADR 0064 R6): professional → professional_participants → case_participants(live)
  -- → case, gated by the broad can_read_case. PRESERVED VERBATIM — this arm grants with NO org
  -- term at all and its cells are exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3).
  return exists (
    select 1
    from public.professional_participants pp
    join public.case_participants cp
      on cp.participant_id = pp.participant_id
     and cp.removed_at is null
    where pp.professional_profile_id = p_profile_id
      and app.can_read_case_committee(cp.case_id, p_uid)
  );
end;
$fn$;

comment on function app.can_read_professional_profile(uuid, uuid) is
  'Layer-3 domain authorizer (ADR 0176 D2/D6) for permission `org.professionals.read` (catalog '
  'row 33). Arms: platform_admin (is_admin, caller-bound) · the org arm, now = legacy '
  'can_manage_professional OR the catalog permission at the org DERIVED from the profile (401 '
  '§19.3) · the case-committee traversal, which grants with no org term and MASKS the org arm '
  'for any professional seated in a readable case.';


-- ============================================================================
-- SELF-VERIFICATION. Every claim above that a later reader could only otherwise take on trust is
-- re-derived from the CATALOG here, so this migration fails LOUDLY rather than landing a
-- half-applied re-key. ⛔ Effective privilege via has_function_privilege, never `proacl` text
-- (a NULL proacl includes PUBLIC).
-- ============================================================================
do $mig$
declare
  v_bad text;
  v_n   int;
begin
  -- (1) The new authorizer exists with the house shape.
  if to_regprocedure('app.can_edit_commission_forms(uuid,uuid)') is null then
    raise exception 'AE4.9 D6: app.can_edit_commission_forms(uuid,uuid) is ABSENT after the DDL.'
      using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'app' and p.proname = 'can_edit_commission_forms'
       and (not p.prosecdef
            or p.proconfig is null
            or not ('search_path=app, public, pg_catalog' = any (p.proconfig)))
  ) then
    raise exception 'AE4.9 D6: can_edit_commission_forms is not DEFINER with the pinned search_path.'
      using errcode = 'check_violation';
  end if;

  -- (2) It inherits its predecessors' ACL EXACTLY: authenticated + service_role, never anon.
  if not (has_function_privilege('authenticated', 'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE')
      and has_function_privilege('service_role',  'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE')) then
    raise exception 'AE4.9 D6: authenticated/service_role lack EXECUTE — every form write would 42501.'
      using errcode = 'check_violation';
  end if;
  if has_function_privilege('anon', 'app.can_edit_commission_forms(uuid,uuid)', 'EXECUTE') then
    raise exception 'AE4.9 D6: anon holds EXECUTE on the new authorizer.'
      using errcode = 'check_violation';
  end if;

  -- (3) ALL FOUR policies, in BOTH halves, now call layer 3 and no longer call the wrapper.
  --     `USING` gates WHICH ROWS may be touched; `WITH CHECK` gates the NEW row. A gate present
  --     in only one half is a real hole, so both are asserted separately.
  select string_agg(policyname, ', ')
    into v_bad
    from pg_policies
   where tablename in ('forms','form_versions','form_sections','form_items')
     and policyname like '%_staff_admin_write'
     and not (coalesce(qual,'')       ~ 'can_edit_commission_forms'
          and coalesce(with_check,'') ~ 'can_edit_commission_forms'
          and coalesce(qual,'')       !~ 'is_staff_admin_of'
          and coalesce(with_check,'') !~ 'is_staff_admin_of');
  if v_bad is not null then
    raise exception 'AE4.9 D6: these form write policies were not fully re-keyed in both halves: %', v_bad
      using errcode = 'check_violation';
  end if;
  select count(*) into v_n
    from pg_policies
   where tablename in ('forms','form_versions','form_sections','form_items')
     and policyname like '%_staff_admin_write';
  if v_n <> 4 then
    raise exception 'AE4.9 D6: expected FOUR form write policies, found % — the set moved.', v_n
      using errcode = 'check_violation';
  end if;

  -- (4) `is_staff_admin_of`'s OTHER surface did not move. Measured at head 20261003007260:
  --     63 policies matched the bare name; this migration takes exactly the four above.
  select count(*) into v_n
    from pg_policies
   where coalesce(qual,'') || coalesce(with_check,'') ~ '\yis_staff_admin_of\y';
  if v_n <> 59 then
    raise exception
      'AE4.9 D6: bare is_staff_admin_of policy count is % — expected 63 - 4 = 59. Either this '
      'migration moved more than its four sites, or the surface changed under it.', v_n
      using errcode = 'check_violation';
  end if;

  -- (5) D7 "statically greppable": exactly THREE (function, permission-code) pairs exist in
  --     `app` + `public`, one per re-keyed site. The baseline was ZERO.
  select count(*) into v_n
    from (select n.nspname, p.proname,
                 regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') as src
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('app','public')) b
    join authz.permissions pm on b.src like '%' || pm.code || '%';
  if v_n <> 3 then
    raise exception
      'AE4.9 D6: % function/permission-code literal pairs in app+public — expected exactly 3 '
      '(the three re-keyed representatives; baseline was 0).', v_n
      using errcode = 'check_violation';
  end if;

  -- (6) Each code sits at ITS OWN site and nowhere else.
  select string_agg(t.what, '; ')
    into v_bad
    from (
      select 'commission.forms.edit not in app.can_edit_commission_forms' as what
       where (select regexp_replace(prosrc, '--[^' || chr(10) || ']*', '', 'g')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'can_edit_commission_forms')
             not like '%commission.forms.edit%'
      union all
      select 'org.professionals.create not in app.can_create_professional'
       where (select regexp_replace(prosrc, '--[^' || chr(10) || ']*', '', 'g')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'can_create_professional')
             not like '%org.professionals.create%'
      union all
      select 'org.professionals.read not in app.can_read_professional_profile'
       where (select regexp_replace(prosrc, '--[^' || chr(10) || ']*', '', 'g')
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'can_read_professional_profile')
             not like '%org.professionals.read%'
    ) t;
  if v_bad is not null then
    raise exception 'AE4.9 D6: a permission code is missing from its own site: %', v_bad
      using errcode = 'check_violation';
  end if;

  -- (7) The preserved arms are still PRESENT. A re-key that silently dropped a legacy arm is the
  --     regression this whole file is shaped around, so it is asserted, not argued.
  select string_agg(t.what, '; ')
    into v_bad
    from (
      select 'can_edit_commission_forms lost the tenancy arm' as what
       where (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'can_edit_commission_forms')
             not like '%is_tenancy_admin_of_for%'
      union all
      select 'can_create_professional lost the can_manage_professional arm'
       where (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'can_create_professional')
             not like '%can_manage_professional%'
      union all
      select 'can_read_professional_profile lost the case-committee arm'
       where (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'can_read_professional_profile')
             not like '%can_read_case_committee%'
      union all
      select 'can_read_professional_profile lost the is_admin arm'
       where (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'app' and p.proname = 'can_read_professional_profile')
             not like '%is_admin%'
    ) t;
  if v_bad is not null then
    raise exception 'AE4.9 D6: a PRESERVED arm went missing: %', v_bad
      using errcode = 'check_violation';
  end if;

  -- (8) `app.is_org_commission_staff_admin` survives with its two remaining callers. Rows 31 and
  --     32 stay pending-rekey and must not have been collaterally cut.
  select count(*) into v_n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'is_org_commission_staff_admin'
     and p.proname <> 'is_org_commission_staff_admin';
  if v_n <> 2 then
    raise exception
      'AE4.9 D6: is_org_commission_staff_admin has % remaining callers — expected exactly 2 '
      '(can_manage_external_participant, can_manage_case_vocabulary).', v_n
      using errcode = 'check_violation';
  end if;

  -- (9) The three roles this re-key depends on have not changed state under it. `staff_admin`
  --     must be `authoritative` or the three sites just lost their staff_admin population
  --     entirely; the tenancy roles must still be `legacy` or the preserved arms are no longer
  --     the reason they pass.
  if (select state::text from authz.roles where code = 'staff_admin') <> 'authoritative' then
    raise exception 'AE4.9 D6: staff_admin is not `authoritative` — the re-keyed arms grant nothing.'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from authz.roles where code in ('org_admin','hospital_admin','platform_admin')
                                          and state::text <> 'legacy') then
    raise exception 'AE4.9 D6: a tenancy role is no longer `legacy` — re-check the preserved arms.'
      using errcode = 'check_violation';
  end if;
end $mig$;
