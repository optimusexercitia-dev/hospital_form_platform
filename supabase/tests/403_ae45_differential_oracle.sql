-- 403 — AE4.5: the differential oracle.
-- Subjects: authz.has_direct_permission (AE4.4b) vs the legacy evaluators, over the
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
-- ⚠ THREE MORE LIMITATIONS, MEASURED 2026-09-01. Each is a place where the CELL COUNT overstates
-- what was measured, and all three read as coverage in a gate record if not stated:
--   * `657 cells` is 438 DISTINCT DRIVER-OBSERVABLE COORDINATES. The driver's answer depends on
--     (persona, context, scope, RESOLUTION-SCOPE-KIND, state, self_check) — not on the permission
--     code — and TWO of the three representatives are org-scoped, so 219 of the cells re-run a
--     coordinate an earlier rep already measured. That re-run is not worthless (it shows the two
--     org-scoped codes agree) but it is not 657 independent measurements, and citing 657 as the
--     measurement count is the inflation the axes file itself warns against.
--   * THE 9 `deny-class:unauthenticated` CELLS DO NOT RUN UNAUTHENTICATED. The driver maps the
--     `anonymous` persona to f.nobody, the same AUTHENTICATED principal as `unprivileged`, so
--     those 9 cells prove exactly what `matrix-row:not-a-holder` proves and NOTHING about
--     anonymity. ⛔ Nor is the honest version constructible on this axis: an `anon` caller cannot
--     reach `authz.has_direct_permission` at all — no application role holds USAGE on `authz`
--     (401 §18.1) — so it would ERROR rather than deny, and there is no differential to take.
--     ⭐ The APPROVED deny-class table ALREADY SAYS SO — row 8's own note records that an
--     anonymous caller cannot invoke the resolver at all. The table was right; the generator
--     emitted cells for the row anyway, and the LABEL is what reads as coverage. Re-labelling an
--     approved deny class is approval surface: routed to the PO, not renamed here.
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
-- RUN SHAPE: `Files=2, Tests=19` (18 here + 00_setup.sql's one).

begin;
select plan(18);

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
  --    split never intended. That branch SUBSTITUTES a gate for `can_read_professional_profile`
  --    (QA finding F3 — still open, still routed to the PO batch, deliberately not fixed here).
  --    The substituted gate must be the ARM the substitution stands for: the real door's arm 1
  --    is the org-manager arm, which AE4.7c re-pointed to `can_create_professional`. Leaving
  --    `can_manage_professional` here would report staff_admin as DENIED row 33 — a code it
  --    KEEPS — and the red would be a SUBSTITUTION ARTIFACT, not a finding.
  legacy := case p_class
    when 'is_staff_admin_of_for'         then app.is_staff_admin_of_for(v_scope_id, v_principal)
    when 'can_create_professional'       then app.can_create_professional(v_scope_id, v_principal)
    else app.can_create_professional(v_scope_id, v_principal)   -- row 33: arm 1's population (F3)
  end;
  catalog := authz.has_direct_permission(v_principal, v_res, v_scope_id, p_code);
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
create or replace function authz.has_direct_permission(
  p_principal uuid, p_scope_kind text, p_scope_id uuid, p_permission_code text
) returns boolean language sql stable security definer set search_path = '' as $neut$
  select exists (
    select 1 from authz.assignment_facts(p_principal) af
      join authz.role_permissions rp on rp.role_code = af.role_code
      join authz.permission_implication_closure cl
        on cl.implying = rp.permission_code and cl.implied = p_permission_code
     where (p_principal is distinct from (select auth.uid())
            or af.role_code is not distinct from app.active_role()));
$neut$;
select cmp_ok(pg_temp.disagreements(), '>', 0,
  '6.3 ⭐⭐ FAIL-PROOF 2 — with authz.scope_reaches REMOVED from the resolver, the oracle goes '
  'RED. ⛔ This is the assertion that proves the suite measures SCOPE and not only grants: a '
  'resolver that stopped checking scope would answer TRUE for every commission in the '
  'database, and §5.1 would still be green if this suite were only grant-sensitive.');

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
