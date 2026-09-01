-- AE4.7c STEP 2 of 2 — THE OPERATION SPLIT AND THE GRANT CHANGE, together.
-- Spec: docs/design/authz-ae43-staff-admin-permission-matrix.md § 12.8.5 · ADR 0155 D7.
-- ⛔ REQUIRES 20261003007220 (the family split) to have landed first — see its header.
--
-- door-sweep-targets: app.can_create_professional(uuid, uuid), app.can_manage_professional(uuid, uuid), app.can_read_professional_profile(uuid, uuid), public.create_professional_profile(uuid, text, text, text, text, text, text, uuid), public.ensure_professional_participant(uuid), public.set_professional_link_state(uuid, text, uuid)
--
-- ============================================================================
-- ⭐ THE RULING: `staff_admin` may ADD a professional, never MODIFY one.
--
-- The PO stated the product fact and it beats every alternative considered. Row 30 splits by
-- OPERATION, not by resource and not by case reach:
--
--   ADD   create_professional_profile · ensure_professional_participant ·
--         set_professional_link_state (bounded)      -> row 43 `org.professionals.create` ✅ keeps
--   MODIFY update_professional_profile · redact_professional_profile
--                                                    -> row 30 `org.professionals.manage`  ⛔ loses
--
-- ⛔ TWO EARLIER RULINGS WERE OVERTURNED BY MEASUREMENT, and the trail is in matrix § 12.8.5
-- because the final answer looks obvious and so did the first two:
--   1. "it becomes org-admin-only" — measured FALSE: `org_admin` cannot reach the surface at
--      all (ADR 0100 D12 deleted the tenancy-admin coercion; e2e asserts the denial). Door ∩
--      surface = ∅, so that revoke strands the feature for everyone.
--   2. narrow by CASE REACH — a per-RESOURCE condition, which a role->permission->SCOPE
--      catalog structurally cannot express. It would have lived in the door body with `authz`
--      still answering TRUE.
-- *Add vs modify* is a CAPABILITY distinction, which is exactly what a catalog models.
--
-- ⚠ THE TWO DOORS `staff_admin` LOSES HAVE ZERO PRODUCT CALLERS — `updateProfessionalProfile`
-- (src/lib/participants/actions.ts) and `redactProfessionalProfile` (src/lib/ethics/actions.ts)
-- are exported and called by no component, page or route. ⛔ That is why the change is cheap;
-- it is NEVER a reason to skip the tests. A door with no caller today is a door with no caller
-- *today*.
--
-- ============================================================================
-- ⛔ THE GRANT CHANGE AND THE GATE CHANGE ARE IN THE SAME MIGRATION, DELIBERATELY.
--
-- AE4.5's oracle (pgTAP 403 § 4.1) asserts `legacy == catalog` cell by cell. Landing the
-- catalog revoke in one migration and the enforcement change in another leaves a state where
-- the catalog says a `staff_admin` may not create while the door still lets them — and the
-- oracle reds on the transition rather than on a defect. Matrix § 12.8.5 states this; it is
-- the reason this file is longer than it looks like it should be.
-- ============================================================================

-- ============================================================================
-- 1. `app.can_create_professional` — row 43's gate. TODAY'S POPULATION, unchanged.
--
-- ⭐ Written as `can_manage_professional OR <the ascent>` rather than as a copy, so the
-- containment `create ⊇ manage` is STRUCTURAL rather than a coincidence of two bodies that
-- happen to agree. Step 1 already isolated the ascent into one function; this is its third
-- and last consumer.
--
-- ⚠ BUG-PROF-INACTIVE-001's `is_active(p_uid)` gate travels WITH the arm, into
-- `app.is_org_commission_staff_admin`. pgTAP 404's subject therefore moves here — the bug was
-- always about the staff_admin arm, and this is where that arm now lives. A 404 left pointing
-- at `can_manage_professional` would keep passing while asserting nothing about the principal
-- state of anyone the fix was for.
-- ============================================================================

create function app.can_create_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  select app.can_manage_professional(p_org, p_uid)
      or app.is_org_commission_staff_admin(p_org, p_uid);
$f$;

comment on function app.can_create_professional(uuid, uuid) is
  'Gate for matrix row 43 (org.professionals.create): mint a professional profile, seat it in '
  'the participants registry, and complete its initial platform linkage. ⭐ This is the '
  'population app.can_manage_professional had BEFORE AE4.7c — org authority PLUS the '
  'commission staff_admin ascent — so every ADD door''s answer is unchanged by the split. '
  '⛔ The name is narrower than the contents (create + seat + initial linkage); '
  'org.professionals.register would read truer, but org.professionals.create is the code the '
  'PO approved by name (matrix § 12.8.5, naming note).';

-- ============================================================================
-- 2. `app.can_manage_professional` NARROWS to org authority. This is the revoke's enforcement
--    half, and after step 1 it is safe: rows 31 and 32 no longer ride this gate.
--
-- ⚠ TWO PROPERTIES CHANGE SHAPE HERE AND BOTH ARE STATED RATHER THAN LEFT TO BE NOTICED:
--
--  (a) `p_uid` becomes VESTIGIAL — used only as a null guard. Both remaining arms
--      (`is_admin()`, `is_org_admin_of(p_org)`) read the CALLER's auth.uid(). That makes this
--      function a PURE SELF-CHECK with a third-party-shaped signature, which is a SHARPER
--      statement of FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM, not a resolution of it. ⛔ The
--      signature is kept: pgTAP 401 § 14.9 derives a permission's expected resolution scope
--      from this function's FIRST ARGUMENT NAME, and its two remaining callers pass
--      auth.uid() anyway.
--  (b) The FUP's only THIRD-PARTY caller moves. `app.can_read_professional_profile` passed a
--      `p_uid` that is not always the caller; it now routes through `can_create_professional`
--      (§ 4 below). So this function's reachability question dissolves — and reappears,
--      unchanged, one function over. ⛔ Record the move; do not record a closure.
--
-- ⛔ `is_active(p_uid)` LEAVES THIS BODY WITH THE ARM IT GUARDED. That is correct — it was
-- added by 20261003007190 to the staff_admin ascent specifically — but it means a green
-- "can_manage_professional gates on is_active" assertion would now be vacuous. pgTAP 404 is
-- re-pointed in the same commit.
-- ============================================================================

create or replace function app.can_manage_professional(p_org uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $f$
  -- ORG AUTHORITY ONLY since AE4.7c. The commission staff_admin ascent moved to
  -- app.can_create_professional (row 43) — a staff_admin ADDS a professional, never modifies
  -- or redacts one (matrix § 12.8.5).
  --
  -- The `is_org_admin_of(p_org)` disjunct reads the CALLER's auth.uid(), not the `p_uid`
  -- target parameter, and so does `is_admin()`. With the ascent gone, `p_uid` is a null guard
  -- and nothing else: FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM, narrowed rather than fixed.
  -- Left alone deliberately — changing it would move an answer, and this migration's claim is
  -- that only the staff_admin arm moves.
  select p_uid is not null and (
    coalesce(app.is_admin(), false)
    or app.is_org_admin_of(p_org)
  );
$f$;

comment on function app.can_manage_professional(uuid, uuid) is
  'Gate for matrix row 30 (org.professionals.manage): MODIFY an existing professional identity '
  'record — update, redact. ORG AUTHORITY ONLY since AE4.7c; the commission staff_admin ascent '
  'moved to app.can_create_professional. ⚠ p_uid is now a null guard only — both arms read the '
  'caller. FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM is narrowed by that, not closed, and its '
  'one third-party call site moved to can_create_professional with the arm.';

-- ============================================================================
-- 3. RE-POINT THE TWO UNBOUNDED ADD DOORS. House rewrite pattern, exactly-once guarded.
-- ============================================================================

do $add_doors$
declare
  v_target text;
  v_src    text;
  v_hits   int;
  v_from   constant text := 'app.can_manage_professional(';
  v_to     constant text := 'app.can_create_professional(';
  v_doors  constant text[] := array[
    'public.create_professional_profile(uuid, text, text, text, text, text, text, uuid)',
    'public.ensure_professional_participant(uuid)'
  ];
  i int;
begin
  foreach v_target in array v_doors loop
    v_src := pg_get_functiondef(v_target::regprocedure);
    v_hits := (length(v_src) - length(replace(v_src, v_from, ''))) / length(v_from);
    if v_hits <> 1 then
      raise exception 'AE4.7c step 2: % contains % call(s) to app.can_manage_professional, expected exactly 1.',
        v_target, v_hits using errcode = 'check_violation';
    end if;
    execute replace(v_src, v_from, v_to);
    v_src := pg_get_functiondef(v_target::regprocedure);
    if position(v_from in v_src) <> 0 or position(v_to in v_src) = 0 then
      raise exception 'AE4.7c step 2: the rewrite of % did not land.', v_target
        using errcode = 'check_violation';
    end if;
  end loop;
end $add_doors$;

-- ⛔ AND THE COMMENT INSIDE `ensure_professional_participant` NAMED THE OLD GATE.
-- Its write-gate comment reads *"`can_manage_professional` names the population that may seat
-- professionals at all"* — false the moment the call above moved. Same discipline as step 1's
-- comment rewrite: `pg_get_functiondef` is what the next reader is told to trust, so this text
-- IS the catalog.
do $seat_comment$
declare
  v_src  text;
  v_hits int;
  v_old  constant text := '`can_manage_professional` names the population that may seat';
  v_new  constant text := '`can_create_professional` (row 43) names the population that may seat';
begin
  v_src := pg_get_functiondef('public.ensure_professional_participant(uuid)'::regprocedure);
  v_hits := (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old);
  if v_hits <> 1 then
    raise exception 'AE4.7c step 2: the stale gate name appears % time(s) in ensure_professional_participant''s comment, expected exactly 1.',
      v_hits using errcode = 'check_violation';
  end if;
  execute replace(v_src, v_old, v_new);
  if position(v_old in pg_get_functiondef('public.ensure_professional_participant(uuid)'::regprocedure)) <> 0 then
    raise exception 'AE4.7c step 2: the seating comment rewrite did not land.' using errcode = 'check_violation';
  end if;
end $seat_comment$;

-- ============================================================================
-- 4. `app.can_read_professional_profile` — arm 1 follows the POPULATION, not the name.
--
-- ⛔ THIS IS THE SITE THAT WOULD HAVE BROKEN SILENTLY. Matrix row 33 `org.professionals.read`
-- is a code `staff_admin` KEEPS, and this function is its only enforcement site. Its arm 1 was
-- `can_manage_professional(v_org, p_uid)` — so leaving it alone while row 30 narrows would
-- have DENIED every staff_admin the org-wide read the matrix grants them: the catalog says
-- TRUE, legacy says FALSE, and 403 § 4.1 reds on a divergence the split never intended.
--
-- ⭐ Re-pointed to `can_create_professional`, which is EXACTLY the population this arm had
-- yesterday (it is the old `can_manage_professional` body). Answer-preserving, and it is also
-- the correct population by derivation: row 33's holders are row 43's holders ∪ row 30's, and
-- row 43's ⊇ row 30's.
--
-- ⚠ WRONG THE DAY row 33's grants stop tracking row 43's — e.g. AE5 grants a role
-- `org.professionals.read` without `org.professionals.create`. This site then needs its own
-- predicate rather than borrowing the create gate's. Stated because the coupling is real and
-- invisible from either end.
-- ============================================================================

do $read_gate$
declare
  v_src  text;
  v_hits int;
  v_from constant text := 'app.can_manage_professional(v_org, p_uid)';
  v_to   constant text := 'app.can_create_professional(v_org, p_uid)';
begin
  v_src := pg_get_functiondef('app.can_read_professional_profile(uuid, uuid)'::regprocedure);
  v_hits := (length(v_src) - length(replace(v_src, v_from, ''))) / length(v_from);
  if v_hits <> 1 then
    raise exception 'AE4.7c step 2: can_read_professional_profile contains % call(s) to the org-manager arm, expected exactly 1.',
      v_hits using errcode = 'check_violation';
  end if;
  execute replace(v_src, v_from, v_to);
  v_src := pg_get_functiondef('app.can_read_professional_profile(uuid, uuid)'::regprocedure);
  if position(v_from in v_src) <> 0 or position(v_to in v_src) = 0 then
    raise exception 'AE4.7c step 2: the read-gate rewrite did not land.' using errcode = 'check_violation';
  end if;
end $read_gate$;

-- ============================================================================
-- 5. `public.set_professional_link_state` — KEPT for `staff_admin`, BOUNDED to `unknown`.
--
-- It belongs on the ADD side because it COMPLETES an add rather than altering an established
-- record: the add dialog sets the initial linkage immediately after creating, and the
-- "Resolver vínculo" affordance only renders while the row's link state is `unknown`.
--
-- ⛔ BUT THE DOOR ACCEPTS TRANSITIONS THE UI NEVER OFFERS. `link_state` is
-- `linked | no_account | unknown`, and nothing in the body reads the CURRENT state — so the
-- RPC will move an established `linked` profile to `no_account`, breaking a real account
-- association. That is the *no UI ≠ not reachable* class, and it is closed HERE, at the door,
-- rather than trusted to the component that happens to hide the button today.
--
-- ⭐ TWO CHECKS, NOT ONE COMPOUND CONDITION, and the split is deliberate:
--   * the FIRST keeps the existing population denial verbatim — same message, same 42501 — so
--     every caller outside the org-manager population is refused exactly as before, and the
--     assertions pinning that path do not move;
--   * the SECOND is the NEW bound, with its own pt-BR message naming the real reason. A
--     compound `if not (A or (B and C))` would have collapsed both into one message that tells
--     a staff_admin they lack coordination authority — which they have. A denial that
--     misstates its own cause is how an operator is sent to fix the wrong thing.
-- `org_admin` / `platform_admin` pass the second check unconditionally.
-- ============================================================================

do $link_gate$
declare
  v_src  text;
  v_old  constant text :=
    '  if not app.can_manage_professional(v_org, auth.uid()) then' || chr(10) ||
    '    raise exception ''apenas a coordenação ou administração da organização pode vincular profissionais''' || chr(10) ||
    '      using errcode = ''42501'';' || chr(10) ||
    '  end if;';
  v_new  constant text :=
    '  -- POPULATION (unchanged): who may touch this linkage at all.' || chr(10) ||
    '  if not app.can_create_professional(v_org, auth.uid()) then' || chr(10) ||
    '    raise exception ''apenas a coordenação ou administração da organização pode vincular profissionais''' || chr(10) ||
    '      using errcode = ''42501'';' || chr(10) ||
    '  end if;' || chr(10) ||
    '' || chr(10) ||
    '  -- AE4.7c BOUND: a staff_admin may only COMPLETE an add. Altering an already-decided' || chr(10) ||
    '  -- linkage is a MODIFY and belongs to org authority (matrix 12.8.5). Read from the' || chr(10) ||
    '  -- ROW, not from the argument: the caller does not say which transition this is, and' || chr(10) ||
    '  -- the UI that only offers this on `unknown` rows is not a gate.' || chr(10) ||
    '  if v_current_link is distinct from ''unknown''' || chr(10) ||
    '     and not app.can_manage_professional(v_org, auth.uid()) then' || chr(10) ||
    '    raise exception ''o vínculo deste profissional já está definido; apenas a administração da organização pode alterá-lo''' || chr(10) ||
    '      using errcode = ''42501'';' || chr(10) ||
    '  end if;';
  v_decl_old constant text := '  v_org uuid;';
  v_decl_new constant text := '  v_org uuid;' || chr(10) || '  v_current_link text;';
  v_sel_old  constant text := '  select organization_id into v_org from public.professional_profiles where id = p_profile_id;';
  v_sel_new  constant text := '  select organization_id, link_state into v_org, v_current_link' || chr(10) ||
                              '    from public.professional_profiles where id = p_profile_id;';
begin
  v_src := pg_get_functiondef('public.set_professional_link_state(uuid, text, uuid)'::regprocedure);

  if (length(v_src) - length(replace(v_src, v_decl_old, ''))) / length(v_decl_old) <> 1
     or (length(v_src) - length(replace(v_src, v_sel_old, ''))) / length(v_sel_old) <> 1
     or (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'AE4.7c step 2: set_professional_link_state does not match its expected shape (declaration / select / gate must each appear exactly once).'
      using errcode = 'check_violation';
  end if;

  v_src := replace(v_src, v_decl_old, v_decl_new);
  v_src := replace(v_src, v_sel_old,  v_sel_new);
  v_src := replace(v_src, v_old,      v_new);
  execute v_src;

  v_src := pg_get_functiondef('public.set_professional_link_state(uuid, text, uuid)'::regprocedure);
  if position('v_current_link' in v_src) = 0
     or position('app.can_create_professional(' in v_src) = 0
     or position('já está definido' in v_src) = 0 then
    raise exception 'AE4.7c step 2: the link-state bound did not land.' using errcode = 'check_violation';
  end if;
end $link_gate$;

-- ============================================================================
-- 6. THE CATALOG. Row 43 is created and granted; row 30's `staff_admin` grant is revoked.
--
-- ✅ The 43rd row is PO-APPROVED (2026-09-01) — the first amendment to the 42-row approval,
-- made under that approval's own rule that "a 43rd row needs its own approval".
--
-- ⚠ `risk_class = 'write'`, not `authority`. Row 30 is `authority` because it alters and
-- redacts an EXISTING identity record; minting one is an ordinary write. The two rows differ
-- on exactly the axis the split is about, which is a small corroboration that the cut is real.
--
-- ⛔ GRANTED TO `staff_admin` ONLY, and that is NOT a contradiction of the matrix's "granted to
-- staff_admin and org_admin". The matrix states the PRODUCT fact; `authz.role_permissions`
-- records only the SUBSTITUTED role's grants until AE5 (pgTAP 401 § 14.8 asserts exactly that:
-- zero rows for any role other than staff_admin). `org_admin` holds row 30 in the product today
-- and has no catalog grant either — granting it row 43 alone would make the catalog say
-- org_admin may create but not manage, which is false in both directions.
-- ============================================================================

insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind)
values ('org.professionals.create', 'identity', 'write', 'class2_professional_identity', 'organization');

-- ⛔ DERIVED DATA: the resolver reads the CLOSURE, never the edges. A permission inserted
-- without this call is invisible to authz.has_direct_permission — it fails CLOSED, silently,
-- and every cell of the new row would read as a denial while the grant sits right there.
select authz.rebuild_implication_closure();

insert into authz.role_permissions (role_code, permission_code)
values ('staff_admin', 'org.professionals.create');

delete from authz.role_permissions
 where role_code = 'staff_admin' and permission_code = 'org.professionals.manage';

do $catalog$
declare
  v_perms   int;
  v_grants  int;
  v_closure int;
  v_other   int;
begin
  select count(*) into v_perms   from authz.permissions;
  select count(*) into v_grants  from authz.role_permissions;
  select count(*) into v_closure from authz.permission_implication_closure;
  select count(*) into v_other   from authz.role_permissions where role_code <> 'staff_admin';

  -- ⚠ 43 PERMISSIONS BUT 42 GRANTS, AND THE ASYMMETRY IS THE WHOLE CHANGE. Row 43 is
  -- inserted and granted; row 30's grant is deleted. So the catalog gains a permission and
  -- staff_admin's grant count is UNCHANGED at 42 — it now holds 42 OF 43 codes, and the one
  -- it does not hold is org.professionals.manage. ⛔ A migration expecting 43/43 here would
  -- red on a correct apply; that draft did, which is why the figures are written out with the
  -- arithmetic rather than transcribed from the row count before it.
  if v_perms <> 43 or v_grants <> 42 or v_closure <> 43 then
    raise exception 'AE4.7c step 2: expected 43 permissions / 42 grants / 43 closure rows, got % / % / %.',
      v_perms, v_grants, v_closure using errcode = 'check_violation';
  end if;
  if v_other <> 0 then
    raise exception 'AE4.7c step 2: % grant(s) exist for a role other than staff_admin — AE4 substitutes exactly one role.',
      v_other using errcode = 'check_violation';
  end if;
  if exists (select 1 from authz.role_permissions
              where role_code = 'staff_admin' and permission_code = 'org.professionals.manage') then
    raise exception 'AE4.7c step 2: staff_admin STILL holds org.professionals.manage — the revoke did not land.'
      using errcode = 'check_violation';
  end if;
  if not exists (select 1 from authz.role_permissions
                  where role_code = 'staff_admin' and permission_code = 'org.professionals.create') then
    raise exception 'AE4.7c step 2: staff_admin does NOT hold org.professionals.create — the grant did not land.'
      using errcode = 'check_violation';
  end if;
end $catalog$;

-- ============================================================================
-- 7. POST-CONDITIONS on the enforcement half, from the catalog at apply time.
--
-- The door census, re-derived rather than bumped — pgTAP 320 pins the same figure with an
-- explicit "do not just bump the number" instruction, and this raises at APPLY time, which is
-- where a mis-scoped `replace()` is cheapest to catch.
--   `can_manage_professional`  : 3 public RPCs — update, redact, AND set_link_state
--   `can_create_professional`  : 3 public RPCs — create, ensure, set_link_state
-- ⚠ THE COUNTS OVERLAP BY ONE AND THAT IS THE POINT, NOT AN ERROR IN EITHER.
-- `set_professional_link_state` names BOTH gates: `can_create_professional` decides the
-- population, `can_manage_professional` decides whether an ALREADY-DECIDED linkage may be
-- changed. A census that reported 2 and 3 would be describing a door that does not exist, and
-- reading these as disjoint sets is how the `unknown` bound gets deleted by someone tidying up.
-- ⚠ `app.can_read_professional_profile` lives in `app` and is in NEITHER count, the same bound
-- 320's assertion carries.
-- ============================================================================

do $post$
declare
  v_manage int;
  v_create int;
  v_ascent int;
begin
  select count(*) into v_manage
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') like '%can_manage_professional%';

  select count(*) into v_create
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') like '%can_create_professional%';

  -- The ascent must exist in EXACTLY ONE place. Three gates consume it; if a body ever
  -- re-inlines the `commissions` traversal, the collapse step 1 performed has been undone and
  -- the "one representative answers for rows 31, 32 and 43" argument silently stops holding.
  select count(*) into v_ascent
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public')
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'is_staff_admin_of_for\(c\.id'
     and not (n.nspname = 'app' and p.proname = 'is_org_commission_staff_admin');

  if v_manage <> 3 or v_create <> 3 then
    raise exception 'AE4.7c step 2: expected 3 manage-naming + 3 create-naming public doors (they overlap on set_professional_link_state), got % / %.',
      v_manage, v_create using errcode = 'check_violation';
  end if;
  if v_ascent <> 0 then
    raise exception 'AE4.7c step 2: % body/bodies re-inline the org ascent outside app.is_org_commission_staff_admin.',
      v_ascent using errcode = 'check_violation';
  end if;
end $post$;
