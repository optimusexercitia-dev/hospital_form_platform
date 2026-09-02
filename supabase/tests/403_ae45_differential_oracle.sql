-- 403 — AE4.5: the differential oracle.
--
-- ⭐ AE4.9 (ADR 0176 D4) REPOINTED THIS SUITE FROM THE RUNTIME EVALUATOR TO THE CANDIDATE ONE,
-- and the distinction is the ADR's own ("the differential compared the CANDIDATE evaluator with
-- the matrix; the wrapper gates compared the WRAPPER with legacy"). `authz.candidate_has_permission`
-- is the PRE-CUTOVER ORACLE: identical to `authz.has_permission` in every gate except that it
-- also sees roles in `test_validation`. That is the state a role occupies WHILE it is being
-- differentialled, so a suite pointed at the runtime evaluator would report "the catalog denies
-- everything" for every AE5 role increment and call it a divergence.
-- ⚠ NOTHING IS LOST TODAY: staff_admin is `authoritative`, where the two evaluators agree by
-- construction — §2.2 asserts that agreement over the whole sweep rather than arguing it, and
-- 407 §3 proves the two DISAGREE under `test_validation`, which is what makes them two functions.
--
-- Subjects: authz.candidate_has_permission (AE4.4b as corrected by AE4.9) vs the legacy evaluators, over the
-- PO-approved matrix (docs/design/authz-ae43-staff-admin-permission-matrix.md, 42 rows) and the
-- PO-approved deny-class effect table (docs/design/authz-ae45-deny-class-effects.md, 9 rows).
--
-- ⛔ TWO ASSERTIONS PER CELL, AND THE SECOND IS THE POINT.
--   §4  is(legacy, catalog)          — the resolver reproduces today's behaviour;
--   §5  is(catalog, approved-value)  — the MATRIX is the oracle, not "whatever legacy did".
-- With only the first, the cheapest green is to approve a legacy defect into the oracle.
--
-- ⛔ THE EXPECTED VALUES ARE NOT COMPUTED THE WAY THE RESOLVER COMPUTES THEM. They are
-- transcribed from two hand-encoded sources (the matrix row; the deny-class table) into the
-- generated vector file, which performs no scope-reaching join, no closure lookup and no
-- role_permissions read. A suite whose expected values mirror the implementation proves only
-- that the resolver equals a second copy of itself.
--
-- ⚠ TWO APPROVED LIMITATIONS — they are not caveats to drop, and the gate record must carry them:
--   * `suspended` is NOT independently observable — app.is_active folds it with `inactive`, so no
--     site distinguishes them. Any claim of separate suspension coverage is false.
--   * `cross_org` asserts the REQUIRED answer; matrix §6.1 measured that it is enforced by the
--     UUID id-space, not by any org term in the resolver. ⛔ This must never read as
--     "the resolver enforces tenant isolation".
--
-- ⚠ TWO MORE LIMITATIONS, MEASURED 2026-09-01 (a third was RESOLVED — see below). Each is a place
-- where the CELL COUNT overstates what was measured, and both read as coverage if not stated:
--   * `648 cells` is 432 DISTINCT DRIVER-OBSERVABLE COORDINATES. The driver's answer depends on
--     (persona, context, scope, RESOLUTION-SCOPE-KIND, state, self_check) — not on the permission
--     code — and TWO of the three representatives are org-scoped, so 216 of the cells re-run a
--     coordinate an earlier rep already measured. That re-run is not worthless (it shows the two
--     org-scoped codes agree) but it is not 648 independent measurements, and citing 648 as the
--     measurement count is the inflation the axes file itself warns against.
--     ⛔ RE-DERIVED, NOT ADJUSTED: this read `657 / 438 / 219` until ADR 0175 D2 deleted the nine
--     anonymous cells. Scaling those three numbers by hand would have been wrong — the count of
--     DISTINCT coordinates does not move with the cell count in any fixed ratio.
--   * ✅ RESOLVED 2026-09-01 (ADR 0175 D2) — THE 9 `deny-class:unauthenticated` CELLS ARE DELETED.
--     They never ran unauthenticated: the driver maps `anonymous` to f.nobody, the same
--     AUTHENTICATED principal as `unprivileged`, so they proved exactly what
--     `matrix-row:not-a-holder` proves and NOTHING about anonymity. ⛔ Nor was the honest version
--     constructible on this axis — an `anon` caller cannot reach `authz.candidate_has_permission` at
--     all (no application role holds USAGE on `authz`), so it would ERROR rather than deny and
--     there is no differential to take. That structural fact is asserted in 401 §18.1 and is
--     STRICTLY STRONGER than the nine cells, which is the only reason deleting them is honest.
--     ⛔ The generator now refuses the persona by name, and `expected()` RAISES if it is ever
--     re-enabled without a JWT-less driver — see the exclusion's reason there.
--   * 108 CELLS LABELLED `third_party` HAVE CALLER == PRINCIPAL. The driver deliberately uses
--     f.nobody as the third-party caller (see its comment — using f.uid made the subject_holder
--     cells self-checks in disguise), but `unprivileged`'s principal IS f.nobody, so for that
--     persona the same substitution recreates the very defect it was written to avoid. Those 108
--     cells are self-checks wearing a third-party label. They are not WRONG — a non-holder is
--     denied either way — but they do not exercise the §6A asymmetry, and the asymmetry's real
--     evidence is the 26 `wrong_active_context:third-party` cells, not the 108.
--
-- ⚠ PER-PERMISSION GRAIN: the axis sweep runs one representative per legacy-equivalence class
-- (three; pgTAP 401 §19.2 asserts the partition). Per-permission GRANT is covered by 401 §19.4's
-- 42 cheap probes. Per-permission AXES are not observable until AE5 gives a role a partial map.
--
-- RUN SHAPE: `Files=2, Tests=23` (22 here + 00_setup.sql's one). ⚠ 18 -> 21: ADR 0175 D3's § 7,
-- the three assertions that BOUND F3's discharge. ⚠ 21 -> 22: AE4.9's § 3.2b, the bound on
-- pointing this suite at the CANDIDATE evaluator. ⛔ Keep this line in step with plan() — the QA
-- review caught it already claiming 12 against plan(15), and a stale RUN SHAPE is read as the
-- expected shape by the next person diagnosing a count mismatch.

begin;
select plan(22);

\ir vectors/authz_differential_cells.psql

-- ============================================================================
-- §1 — the fixture. Three holding scopes, one of them CONSTRUCTED cross-org.
-- ⛔ Deleted BY IDENTITY at the end, never positionally — a positional cleanup eats seed rows
-- that ~900 tests contractually depend on.
-- ============================================================================

create temp table f403 on commit drop as
select
  (select p.id from public.profiles p where p.email = 'chefe.ccih@test.local')            as uid,
  (select m.commission_id from public.memberships m join public.profiles p on p.id = m.principal_id
    where p.email = 'chefe.ccih@test.local' and m.role = 'staff_admin' limit 1)           as own_cid,
  '00000000-0000-4403-8000-000000000001'::uuid                                            as sib_holder,
  '00000000-0000-4403-8000-000000000002'::uuid                                            as xorg_holder,
  '00000000-0000-4403-8000-000000000003'::uuid                                            as nobody;

alter table f403 add column sib_cid uuid;
alter table f403 add column xorg_cid uuid;
alter table f403 add column own_oid uuid;
alter table f403 add column xorg_oid uuid;

update f403 set
  own_oid  = (select h.organization_id from public.commissions c join public.hospitals h on h.id = c.hospital_id
               where c.id = own_cid),
  sib_cid  = (select c.id from public.commissions c join public.hospitals h on h.id = c.hospital_id
               where h.organization_id = (select h2.organization_id from public.commissions c2
                                            join public.hospitals h2 on h2.id = c2.hospital_id where c2.id = own_cid)
                 and c.id <> own_cid limit 1);
update f403 set
  xorg_cid = (select c.id from public.commissions c join public.hospitals h on h.id = c.hospital_id
               where h.organization_id <> own_oid limit 1);
update f403 set
  xorg_oid = (select h.organization_id from public.commissions c join public.hospitals h on h.id = c.hospital_id
               where c.id = xorg_cid);

-- ⚠ profiles.id references auth.users, so the auth rows come first (the shape 00_setup.sql
-- uses). A handle_new_user trigger may already materialise the profile, hence the upsert.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000'::uuid, sib_holder,  'authenticated','authenticated','zz403.sib@test.local',  now(), now() from f403 union all
select '00000000-0000-0000-0000-000000000000'::uuid, xorg_holder, 'authenticated','authenticated','zz403.xorg@test.local', now(), now() from f403 union all
select '00000000-0000-0000-0000-000000000000'::uuid, nobody,      'authenticated','authenticated','zz403.nobody@test.local',now(), now() from f403;

insert into public.profiles (id, email, full_name, is_active, email_confirmed_at)
select sib_holder,  'zz403.sib@test.local',  'ZZ403 Sibling',   true, now() from f403 union all
select xorg_holder, 'zz403.xorg@test.local', 'ZZ403 CrossOrg',  true, now() from f403 union all
select nobody,      'zz403.nobody@test.local','ZZ403 Nobody',   true, now() from f403
on conflict (id) do update set is_active = true, email_confirmed_at = now();

insert into public.memberships (principal_id, commission_id, role)
select sib_holder,  sib_cid,  'staff_admin' from f403 union all
select xorg_holder, xorg_cid, 'staff_admin' from f403;

-- ⭐ ADR 0175 D3 — THE SUBJECT THE REAL DOOR NEEDS, and the reason the substitution existed.
-- `app.can_read_professional_profile(p_profile_id, p_uid)` takes a PROFILE id, not a scope id,
-- and derives the organization FROM THE PROFILE. So a single profile would collapse the scope
-- axis: every cell would resolve against one org and own/sibling/foreign would stop differing.
-- ⛔ ONE PROFILE PER ORG, mapped by the SAME rule the driver uses for v_scope_id, or the sweep
-- silently narrows to one column while still reporting three.
alter table f403 add column own_prof uuid;
alter table f403 add column xorg_prof uuid;
update f403 set own_prof  = '00000000-0000-4403-8000-000000000011'::uuid,
                xorg_prof = '00000000-0000-4403-8000-000000000012'::uuid;

insert into public.professional_profiles (id, organization_id, full_name)
select own_prof,  own_oid,  'ZZ403 Prof OwnOrg'   from f403 union all
select xorg_prof, xorg_oid, 'ZZ403 Prof CrossOrg' from f403;

select ok((select xorg_cid from f403) is not null and (select sib_cid from f403) is not null
          and (select xorg_oid from f403) <> (select own_oid from f403),
  '1.1 FIXTURE CONTROL: a sibling commission (same org) and a CONSTRUCTED cross-org holder in a '
  'DIFFERENT organization both resolve. ⛔ No seeded persona holds anything outside its home org, '
  'so the cross-org half of this matrix is fixture-only by construction — a cross-org cell written '
  'against a seeded persona passes while proving nothing.');

-- ============================================================================
-- §2 — the cell set, and its controls.
-- ============================================================================

select cmp_ok((select count(*)::int from authz_differential_cells), '>', 500,
  '2.1 CARDINALITY CONTROL: the generated cell set is populated. An empty or truncated vector '
  'file would let §§4-5 iterate nothing and pass having asserted nothing.');

select ok(
  (select count(*) from authz_differential_cells where expected_granted) > 0
  and (select count(*) from authz_differential_cells where not expected_granted) > 0,
  '2.2 ⭐ the EXPECTED column carries BOTH answers. A cell set expecting only denials would be '
  'satisfied by a resolver stuck at false, which is the single most likely way this suite could '
  'pass while proving nothing.');

select is((select count(distinct legacy_class)::int from authz_differential_cells), 3,
  '2.3 all THREE legacy-equivalence classes are swept (401 §19.2 asserts the partition is total '
  'and that there are exactly three).');

select ok(
  (select count(*) from authz_differential_cells where self_check) > 0
  and (select count(*) from authz_differential_cells where not self_check) > 0,
  '2.4 ⭐⭐ §6A BOTH POLARITIES ARE PRESENT — self-check AND third-party. ⛔ A generator emitting '
  'only the self-check passes while pinning the uniform-apply bug, which would break all 27 `_for` '
  'call sites. This is the arm that makes the omission impossible.');

select ok(
  (select count(*) from authz_differential_cells
    where resolution_scope_kind = 'organization' and scope = 'sibling_commission'
      and expected_granted) > 0,
  '2.5 ⭐ §11.3 THE DIFFERING-SCOPE CELL EXISTS AND EXPECTS A GRANT: an ORG-scoped permission IS '
  'reached from a SIBLING commission (the ascent), where a commission-scoped one is not. Without '
  'this cell the whole org-scoped class goes untested and an adapter deriving resolution scope '
  'from allowed_scope_kind would look correct.');

-- ============================================================================
-- §3 — the driver. Materialises each cell's state and calls BOTH evaluators.
-- ============================================================================

create or replace function pg_temp.cell_answers(
  p_persona text, p_ctx text, p_scope text, p_code text, p_class text, p_state text, p_self boolean
) returns table (legacy boolean, catalog boolean)
language plpgsql volatile as $d$
declare
  f record; v_principal uuid; v_scope_id uuid; v_res text;
begin
  -- ⛔ RESET CLAIMS FIRST. guard_profile_privileged_columns refuses lifecycle writes unless the
  -- caller is service-role, and the PREVIOUS cell's claims_for() left `authenticated` in place —
  -- so without this the second cell onward fails with "identity/lifecycle columns are
  -- service-role-only". The failure is in the DRIVER, not the subject.
  perform test_helpers.reset_role_and_claims();
  select * into f from f403;
  v_principal := case p_persona
      when 'subject_holder' then f.uid
      when 'other_commission_holder' then f.sib_holder
      when 'cross_org_actor' then f.xorg_holder
      else f.nobody end;

  select pm.resolution_scope_kind::text into v_res from authz.permissions pm where pm.code = p_code;

  if v_res = 'commission' then
    v_scope_id := case p_scope when 'own_commission' then f.own_cid
                               when 'sibling_commission' then f.sib_cid
                               else f.xorg_cid end;
  else
    v_scope_id := case p_scope when 'foreign_org_commission' then f.xorg_oid else f.own_oid end;
  end if;

  -- principal state (the deny-class axis). `pending` sets ONLY the profiles mirror, which is
  -- what the seed models and what app.is_active does NOT read — deny-class table row 5.
  -- ⛔ RESET EVERY FIXTURE PRINCIPAL, NOT JUST THIS CELL'S. Resetting only v_principal leaves
  -- a deactivated/suspended state on whichever principal a PREVIOUS cell touched, so the
  -- answers become ORDER-DEPENDENT — and §6.2 caught exactly that: re-running the sweep in a
  -- different order disagreed with the first pass. A driver whose result depends on iteration
  -- order is not measuring the subject.
  update public.profiles set is_active = true, suspended_until = null, email_confirmed_at = now()
   where id in (f.uid, f.sib_holder, f.xorg_holder, f.nobody);
  if p_state = 'deactivated' then update public.profiles set is_active = false where id = v_principal;
  elsif p_state = 'suspended' then update public.profiles set suspended_until = now() + interval '7 days' where id = v_principal;
  elsif p_state = 'pending' then update public.profiles set email_confirmed_at = null where id = v_principal;
  end if;

  -- active-role context; only meaningful for a self-check (§6A).
  if p_self then
    perform test_helpers.claims_for(v_principal, false,
      case p_ctx when 'matching' then 'staff_admin' when 'other_role' then 'quality_reviewer' else null end);
  else
    -- ⛔ THE CALLER MUST NOT BE THE PRINCIPAL. A first draft used f.uid as the caller, which for
    -- the `subject_holder` persona IS the principal — so those cells were SELF-checks wearing a
    -- third_party label, the asymmetry never engaged, and §5.2 correctly red. Use a caller that
    -- is never the subject.
    perform test_helpers.claims_for(f.nobody, false, 'quality_reviewer');
  end if;

  -- ⭐ AE4.7c MOVED BOTH ORG BRANCHES, and neither move is a widening of what is measured.
  --  * The REP for the org write class is now `org.professionals.create` (matrix § 12.8.5):
  --    staff_admin LOST org.professionals.manage, so a rep on the old code would make every
  --    cell of the class a denial — single polarity, invisible to arm2 because arm2 is
  --    satisfied globally by the other reps.
  --  * ⛔ ROW 33's `else` BRANCH HAD TO MOVE TOO, or 403 § 4.1 would red on a divergence the
  --    split never intended. That branch SUBSTITUTED a gate for `can_read_professional_profile`
  --    (QA finding F3). The substituted gate had to be the ARM the substitution stood for: the
  --    real door's arm 2 is the org-manager arm, which AE4.7c re-pointed to
  --    `can_create_professional`. Leaving `can_manage_professional` there would have reported
  --    staff_admin as DENIED row 33 — a code it KEEPS — a SUBSTITUTION ARTIFACT, not a finding.
  --
  -- ✅ F3 IS DISCHARGED HERE (ADR 0175 D3): THE `else` BRANCH NOW CALLS THE DOOR ITS CLASS IS
  -- NAMED FOR. The equivalence the substitution ASSUMED is no longer assumed — it is measured,
  -- every cell, every run. `can_read_professional_profile` is a THREE-ARM disjunction
  -- (is_admin · can_create_professional · a case-committee traversal), and substituting arm 2
  -- for the whole door meant arms 1 and 3 were outside the differential entirely: a widening of
  -- either was invisible to the oracle by construction.
  -- ⚠ WHAT THIS DOES **NOT** BUY, stated because "the real door is called" reads like more:
  -- arms 1 and 3 are now EVALUATED but cannot GRANT in this fixture (§ 7 asserts both, rather
  -- than asserting it in prose). So a widening that makes them grant is caught; a widening
  -- INSIDE arm 3's traversal, which needs case participation to reach at all, is still not.
  -- That divergence is PO-DEFERRED to the AE5 matrix — ADR 0175 D3, and it is why the gate
  -- record may not write "the differential is green" without the exercised-≠-oracled qualifier.
  legacy := case p_class
    when 'is_staff_admin_of_for'         then app.is_staff_admin_of_for(v_scope_id, v_principal)
    when 'can_create_professional'       then app.can_create_professional(v_scope_id, v_principal)
    -- ⛔ The profile is chosen by the SAME scope rule as v_scope_id above. Choosing it any other
    -- way (or using one profile) decouples the door's org from the cell's scope, and the scope
    -- axis stops being swept while the cell ids still claim it is.
    else app.can_read_professional_profile(
           case p_scope when 'foreign_org_commission' then f.xorg_prof else f.own_prof end,
           v_principal)
  end;
  catalog := authz.candidate_has_permission(v_principal, v_res, v_scope_id, p_code);
  return next;
end $d$;

create temp table r403 on commit drop as
select c.*, a.legacy, a.catalog
  from authz_differential_cells c
  cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope,
                                          c.permission_code, c.legacy_class,
                                          c.principal_state, c.self_check) a;

select test_helpers.reset_role_and_claims();

select is((select count(*)::int from r403), (select count(*)::int from authz_differential_cells),
  '3.0 ⭐ EVERY CELL PRODUCED A ROW. r403 is a `cross join lateral` over the vector table, so a '
  'driver returning ZERO rows for some cell silently DROPS it — §§4-5 then compare a subset and '
  'report green over cells that never ran. §2.1 counts the vector table and §3.1 catches a NULL '
  'answer; neither can see a cell that produced no row at all.');

select is((select count(*)::int from r403 where legacy is null or catalog is null), 0,
  '3.1 the driver returned an answer for EVERY cell — a NULL would fall out of the comparisons '
  'below and read as agreement.');

select ok(
  (select count(*) from r403 where catalog) > 0 and (select count(*) from r403 where not catalog) > 0,
  '3.2 ⭐ DISCRIMINATION CONTROL: the resolver returned BOTH answers across the sweep. A resolver '
  'stuck on one value could satisfy a same-answer cell set, and this is what stops that reading as '
  'agreement.');

select is((select count(*)::int from authz.roles where state = 'test_validation'), 0,
  '3.2b ⭐ THE BOUND ON POINTING THIS SUITE AT THE CANDIDATE EVALUATOR (AE4.9, ADR 0176 D4). '
  'authz.candidate_has_permission and authz.has_permission differ in EXACTLY ONE respect: the '
  'candidate also sees roles in `test_validation`. With ZERO roles in that state, the two are '
  'INDISTINGUISHABLE over this fixture — so the repoint costs no coverage today, and this suite '
  'is currently evidence about the runtime path as well. ⛔ THE DAY THIS REDS, IT STOPS BEING '
  'EVIDENCE ABOUT THE RUNTIME PATH, which is correct and is the whole reason the oracle is the '
  'candidate: the role being differentialled is precisely the one the runtime evaluator must '
  'still refuse. Do not "fix" a red here by repointing the suite back — record it. '
  '⚠ ASSERTED, NOT ARGUED: 407 §3 proves the two evaluators genuinely DISAGREE under '
  '`test_validation`, so this is a real bound and not a restatement of a rename.');

select is(
  (select count(*)::int
     from authz_differential_cells c
     join r403 b on b.cell_id = c.cell_id
     cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope, c.permission_code,
                                             c.legacy_class, c.principal_state, c.self_check) a
    where a.catalog is distinct from b.catalog),
  0,
  '3.3 ⭐ DETERMINISM CONTROL: a SECOND sweep over the same cells, with nothing changed in '
  'between, returns the SAME answers as the first. ⛔ Without this, §§4-5 could be green by '
  'iteration luck — the driver mutates principal state per cell, and a driver whose result '
  'depends on order is not measuring its subject. This assertion is what makes the rest of the '
  'suite trustworthy rather than merely observed once.');

-- ============================================================================
-- §4 — is(legacy, catalog).
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' catalog=' || catalog::text,
                              ' | ' order by cell_id), '(none)')
     from r403 where legacy is distinct from catalog),
  '(none)',
  '4.1 ⭐ LEGACY == CATALOG on every cell. ⛔ Because the matrix is ALREADY APPROVED, a difference '
  'here means legacy is wrong or the resolver is wrong — it is never a licence to record "the '
  'catalog matches legacy" and move on (PA-F8). The message names the disagreeing cells.');

-- ============================================================================
-- §5 — is(catalog, approved matrix value). THE ORACLE HALF.
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' catalog=' || catalog::text || ' expected=' ||
                              expected_granted::text || ' src=' || expected_source,
                              ' | ' order by cell_id), '(none)')
     from r403 where catalog is distinct from expected_granted),
  '(none)',
  '5.1 ⭐⭐ CATALOG == THE APPROVED VALUE. This is what makes the MATRIX the oracle rather than '
  '"whatever legacy did" — with §4 alone, the cheapest green is to approve a legacy defect into '
  'the regression oracle. Expected values come from the approved matrix row and the approved '
  'deny-class table ONLY, never from resolver logic. '
  '⚠ ROW 7 WILL LOOK LIKE A BUG AND IS NOT: a THIRD-PARTY check carrying the WRONG HAT is '
  'GRANTED, because app.has_role''s active-context term is '
  '`(p_user_id is distinct from auth.uid() or ...)` — it short-circuits entirely when the '
  'principal is not the caller. ⛔ Do not "fix" that. Both polarities are required precisely '
  'because a suite emitting only the self-check passes while pinning the uniform-apply bug.');

select is(
  (select count(*)::int from r403 where expected_source like 'deny-class:wrong_active_context:third-party%'
     and not catalog),
  0,
  '5.2 ⭐ §6A''s asymmetry, asserted head-on: every WRONG-HAT THIRD-PARTY cell is GRANTED. If this '
  'reds, the adapter has started applying the active-role filter uniformly, which breaks all 27 '
  '`_for` call sites while looking like a tightening.');

-- ============================================================================
-- §6 — THE SUITE SHOWN ABLE TO FAIL. Two constructed mutations, each restored.
--
-- ⭐ The strongest evidence for this suite is not below: §4.1 was RED on the
-- can_manage_professional cells before 20261003007190 and PASSES after — a real defect found
-- and a real fix confirmed, on a failing state nobody built on purpose. §6 is the deliberate
-- half, which matters because it aims at the two mechanisms most likely to rot silently.
-- ============================================================================

create or replace function pg_temp.disagreements() returns int
language sql volatile as $x$
  select count(*)::int
    from authz_differential_cells c
    cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope,
                                            c.permission_code, c.legacy_class,
                                            c.principal_state, c.self_check) a
   where a.catalog is distinct from c.expected_granted;
$x$;

-- ⛔⛔ THE BASELINE, AND §6 IS WORTHLESS WITHOUT IT. `cmp_ok(disagreements(), '>', 0)` is a
-- fail-proof only if the count is ZERO first — otherwise it passes with its mutation DELETED.
-- That is not hypothetical: this suite shipped with the fixture-membership cleanup sitting HERE,
-- above §6, so `sib_holder`/`xorg_holder` already disagreed on every expected-granted cell and
-- BOTH fail-proofs below passed on 48 pre-existing disagreements rather than on their own
-- mutations (QA 2026-09-01, F1 — measured with exactly this assertion, which returned 48). The
-- cleanup now runs last, beside the deactivation, for the same reason the comment down there
-- gives for that one. ⛔ Never move a cleanup above a fail-proof: a fail-proof that fires for a
-- reason other than the one it names is not a fail-proof, and it is SILENT about the difference.
select cmp_ok(pg_temp.disagreements(), '=', 0,
  '6.0 ⭐⭐ BASELINE FOR BOTH FAIL-PROOFS — the oracle agrees on EVERY cell before any deliberate '
  'mutation. This is the half that makes 6.1 and 6.3 differentials; without it each is an '
  'assertion that some disagreement exists somewhere, which the fixture teardown alone can '
  'satisfy.');

delete from authz.role_permissions
 where role_code = 'staff_admin' and permission_code = 'commission.forms.edit';
select cmp_ok(pg_temp.disagreements(), '>', 0,
  '6.1 FAIL-PROOF 1 — flipping ONE seeded role_permissions row makes the oracle RED. Without '
  'this the green in §5.1 is a comparison nobody has shown can fail.');
insert into authz.role_permissions (role_code, permission_code)
  values ('staff_admin', 'commission.forms.edit');
select test_helpers.reset_role_and_claims();
select ok(
  (select a.catalog
     from authz_differential_cells c
     cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope, c.permission_code,
                                             c.legacy_class, c.principal_state, c.self_check) a
    where c.permission_code = 'commission.forms.edit' and c.persona = 'subject_holder'
      and c.scope = 'own_commission' and c.principal_state = 'active'
      and c.active_context = 'matching' and c.self_check
    limit 1),
  '6.2 ...and RESTORING the grant makes the mutated permission resolve TRUE again at its base '
  'coordinate. ⚠ TARGETED at the mutated permission, deliberately, rather than re-sweeping all '
  '657 cells: §3.3 already establishes the driver is deterministic, so a whole-sweep restoration '
  'comparison adds no information about the RESTORE while folding in every unrelated cell. '
  'Measured independently outside the suite: delete -> false, re-insert -> true.');

-- ⛔ 6.3's OWN baseline. §6.0 established zero BEFORE 6.1's mutation; 6.2 proves the mutated
-- permission resolves TRUE again at ONE coordinate, deliberately (see its message). Neither
-- shows the sweep is back to zero, and a restore that left ANY residual disagreement would make
-- 6.3 below pass without its neutralisation doing anything — the same vacuity as F1, one
-- mutation later. This is the only place the whole-sweep cost buys information 6.2 cannot.
select cmp_ok(pg_temp.disagreements(), '=', 0,
  '6.2b ⭐ THE RESTORE IS COMPLETE ACROSS THE WHOLE SWEEP — re-inserting the grant returned the '
  'oracle to zero disagreements, so 6.3 below starts from the same baseline 6.1 did.');

-- ⭐ FAIL-PROOF 2 — neutralise the RESOLVER'S SCOPE CHECK. This is AE4.7's requirement
-- ("neutralize the resolver's scope check -> the staff_admin keystones red") exercised EARLY,
-- and it is the one that matters most: it proves the suite is sensitive to the resolver's SCOPE
-- logic and not merely to its grant lookup. A suite that only noticed missing grants would pass
-- a resolver that had stopped checking scope entirely — an org-wide over-grant.
-- ⚠ AE4.9: the neutralised body must keep BOTH gates the corrected evaluator carries and drop
-- ONLY authz.scope_reaches — the state filter and the scope-kind validation stay. A neutraliser
-- that also dropped them would be three mutations at once, and 6.3's red would no longer be
-- attributable to the scope check.
create or replace function authz.candidate_has_permission(
  p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text
) returns boolean language sql stable security definer set search_path = '' as $neut$
  select case
    when p_scope_kind is distinct from (
           select pm.resolution_scope_kind::text from authz.permissions pm
            where pm.code = p_permission_code)
      then false
    else exists (
      select 1 from authz.assignment_facts(p_principal) af
        join authz.roles r on r.code = af.role_code
        join authz.role_permissions rp on rp.role_code = af.role_code
        join authz.permission_implication_closure cl
          on cl.implying = rp.permission_code and cl.implied = p_permission_code
       where r.state in ('test_validation', 'authoritative')
         and (p_principal is distinct from (select auth.uid())
              or af.role_code is not distinct from app.active_role()))
  end;
$neut$;
select cmp_ok(pg_temp.disagreements(), '>', 0,
  '6.3 ⭐⭐ FAIL-PROOF 2 — with authz.scope_reaches REMOVED from the resolver, the oracle goes '
  'RED. ⛔ This is the assertion that proves the suite measures SCOPE and not only grants: a '
  'resolver that stopped checking scope would answer TRUE for every commission in the '
  'database, and §5.1 would still be green if this suite were only grant-sensitive.');

-- ============================================================================
-- §7 — THE BOUND ON F3's DISCHARGE, ASSERTED RATHER THAN PROMISED (ADR 0175 D3).
-- §§4-5 now compare the REAL `can_read_professional_profile`. That door has three arms, and
-- this fixture can only make ONE of them grant. ⛔ Writing that in a comment would let it go
-- stale the first time someone adds a platform admin or a case participation to the fixture —
-- and it would go stale SILENTLY, in the direction that reads as more coverage. So it is
-- asserted: if either arm ever becomes able to grant here, these reds and the AE5 divergence
-- question arrives with a test attached instead of being rediscovered.
-- ============================================================================

select is(
  (select count(*)::int from public.professional_profiles pp
    where pp.id in ((select own_prof from f403), (select xorg_prof from f403))
      and pp.organization_id in ((select own_oid from f403), (select xorg_oid from f403))),
  2,
  '7.1 FIXTURE CONTROL: both subject profiles exist, one per organization. §1.1 already proved '
  'the two orgs differ, so the row-33 class sweeps the scope axis through the PROFILE''s org — '
  'the door ignores v_scope_id entirely and derives the org from the profile it is handed.');

select is(
  (select count(*)::int from public.profiles p
    where p.id in ((select uid from f403), (select sib_holder from f403),
                   (select xorg_holder from f403), (select nobody from f403))
      and coalesce(p.is_admin, false)),
  0,
  '7.2 ARM 1 CANNOT GRANT IN THIS FIXTURE: no fixture principal is a platform admin, so '
  '`is_admin()` is false for every caller §§4-5 construct. ⛔ This is a BOUND, not a pass — it '
  'says the arm is evaluated and structurally silent, which is exactly why a widening of arm 1 '
  'would be caught (catalog would not move) and a defect INSIDE arm 1 would not.');

select is(
  (select count(*)::int from public.professional_participants pp
    where pp.professional_profile_id in ((select own_prof from f403), (select xorg_prof from f403))),
  0,
  '7.3 ARM 3 CANNOT GRANT IN THIS FIXTURE: neither subject profile has a single '
  '`professional_participants` row, so the case-committee traversal has nothing to walk and '
  'returns false for every cell. ⛔ THIS IS THE PO-DEFERRED DIVERGENCE (ADR 0175 D3): arm 3 '
  'grants with NO org term at all — a professional in a readable case is readable whatever their '
  'organization — and measuring THAT needs a participation fixture plus expected values the AE5 '
  'matrix owns. Until then: exercised, not oracled. ⛔ If this reds because someone added a '
  'participation row, do not adjust the number — the arm just became reachable and its cells '
  'need approved expected values first.');

-- ⚠ CLEANUP RUNS LAST, AND THE ORDER IS LOAD-BEARING. It was originally placed before §6,
-- which deactivated the fixture principals and made EVERY cell deny — so §6.1 passed for the
-- WRONG REASON (the deactivation, not the flipped grant) and §6.2 could never go green. A
-- fail-proof that fires for a reason other than the one it names is not a fail-proof.
-- ⛔ CLEANUP: the fixture principals are IDENTIFIED precisely (by their f403 uuids, never
-- positionally — a positional cleanup eats seed rows ~900 tests depend on), but they are
-- DELIBERATELY NOT DELETED, because deletion is structurally impossible here and that is by
-- design: a guard refuses `profiles` deletes outright ("profiles are never deleted; deactivate
-- via is_active"), and `profiles_id_fkey` has no cascade, so removing the auth.users row fails
-- too. The suite's isolation is the enclosing transaction's ROLLBACK. Deactivating them instead
-- is the product's own sanctioned route, and is what an out-of-transaction run would do.
-- ⛔ Reset claims FIRST — the last cell left `authenticated` in place and
-- guard_profile_privileged_columns refuses the write ("only an admin may change
-- is_admin/is_active"). Same lesson as the driver's per-cell reset, one layer out.
select test_helpers.reset_role_and_claims();
-- ⛔ BY IDENTITY, never positionally — a positional cleanup eats seed rows ~900 tests depend on.
-- ⚠ This ran ABOVE §6 until 2026-09-01 and that placement was what made both fail-proofs vacuous
-- (F1). It has no reason to run early: nothing between §1 and here asserts these memberships are
-- gone, and everything in §§4-6 assumes they are PRESENT.
delete from public.memberships where principal_id in
  (select sib_holder from f403 union all select xorg_holder from f403);
update public.profiles set is_active = false
 where id in (select sib_holder from f403 union all select xorg_holder from f403
              union all select nobody from f403);


select * from finish();
rollback;
