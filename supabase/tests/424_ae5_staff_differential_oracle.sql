-- 424 — AE5 increment 1: the `staff` differential oracle.
--
-- Subjects: authz.candidate_has_permission (⛔ NEVER authz.has_permission — `staff` sits in
-- `test_validation` throughout this suite's lifetime) vs the legacy evaluators.
--
-- ⭐⭐ THE MECHANISM CHANGED (lead rulings L9′/L10; backend's build `a0723554`, HEAD `f5b12832`).
-- `authz_differential_cells_staff` now carries, PER CELL, an EXECUTABLE probe pair — columns
-- `legacy_sql`, `catalog_sql` (full parameterised `select ...` text, literal ids baked in),
-- `legacy_fixture_id` (the row the legacy probe reads, for the existence control below) and
-- `keying` (`caller-only` | `third-party-capable`, informational — cells the generator knows are
-- caller-only never carry a `self_check=false` row at all, so `424` no longer decides who a
-- third-party call is meaningful for). `424` therefore WRITES NO DOOR and NAMES NO RESOURCE: every
-- `legacy_class`-keyed dispatch, every `pg_temp.legacy_row*` helper, and the scope-fallback this
-- file used to carry are DELETED. The driver's whole job is: set the state the cell asks for, set
-- the claims the cell asks for, `EXECUTE` the two given strings, compare.
--
-- ⛔ TWO ASSERTIONS PER CELL, AND THE SECOND IS THE POINT (unchanged from 403).
--   §4  is(legacy, catalog)          — the resolver reproduces today's behaviour;
--   §5  is(catalog, approved-value)  — the MATRIX is the oracle, not "whatever legacy did".
--
-- ⛔ EXPECTED VALUES ARE TRANSCRIBED, NEVER COMPUTED THE WAY THE RESOLVER COMPUTES THEM.
--
-- ⚠ `case_reach` is swept as a global column but is INERT for every `staff` cell — `staff` holds
-- no `can_read_professional_profile` rep. `member_gate_arm` (`none · conjunct_met · conjunct_unmet
-- · disjunct_present · disjunct_absent`) is the ELEVEN-ROW axis §7 asserts the coordinate set of.
--
-- ⭐ RULING HISTORY, KEPT SHORT (the mechanism that carried these is gone; the rulings are not) —
-- PO 2026-09-14, "P1 accept the exception / P2 intended composition / P3 pending GRANTED":
--   P1 `arm3:divergent-approved:role-free-disjunct-ignores-principal-state` — a limb-(b) role-free
--     disjunct (rows 1, 4, 11, 16) grants regardless of `principalState`, filed as
--     BUG-AE5-STAFF-INACTIVE-BYPASSES-ROLE-FREE-DISJUNCTS (open; fix = unit
--     AE5-INACTIVE-DISJUNCT-GUARD). Gated on `arm3Door.reach` per persona after backend's fix at
--     `805cf65c` — NOT unconditional across every persona; the vector's own `expected_legacy_granted`
--     already encodes exactly which persona/coordinate combinations reach it.
--   P2 `arm3:divergent-narrower:door-conjunct-unmet` — at `conjunct_unmet` the door's own conjunct
--     denies a principal the catalog grants; not a bug, a permission code cannot carry a
--     non-permission term.
--   Both labels are DATA on the cell (`arm3_divergence`, `expected_legacy_granted`) — §4.1 excludes
--   labelled cells from the no-divergence comparison; §4.1b compares `legacy` against
--   `expected_legacy_granted` on EVERY cell, labelled or not, which is what makes P1/P2 testable
--   rather than assumed.
--
-- ⚠ ROW 12's `HC0J0` GUARD IS AN ETHICS-DETAILS EXISTENCE GUARD, NOT A STATUS GUARD (lead ruling
-- L5) — carried in `legacy_sql` now, not re-derived here.
--
-- ⚠ THE ABLE-TO-FAIL PROOF (§6, mirrors 403 §6 — direct `delete`/`insert`, reversed by its own
-- inverse, NOT a bare SAVEPOINT, which discards assertions made after a rollback to it).
--
-- RUN SHAPE: `plan(23)` — §2.6 (the fixture-existence control, now reading the vector's own
-- `probe_table`/`probe_column` rather than a name this file infers) plus §2.6a (its discrimination
-- half: a deliberately-absent id must be reported absent). Re-derived against what is actually
-- written below, not predicted.

begin;
select plan(23);

\ir vectors/authz_differential_cells.psql

-- ============================================================================
-- §1 — the fixture. Down to a PERSONA→PRINCIPAL map only — every resource id the old dispatch
-- needed (meetings, cases, action items, frameworks, documents, capa, form versions, co-members)
-- is now baked into `legacy_sql`/`catalog_sql` by the generator. Reuses backend's round-4 personas
-- unchanged; no new row of any kind.
-- ============================================================================

create temp table f424 on commit drop as
select
  '00000000-0000-0000-0000-00000000000a'::uuid                                            as uid,        -- staff4.ccih (subject_holder)
  '00000000-0000-0000-0000-000000000006'::uuid                                            as other_id,   -- staff1.farm (other_commission_holder)
  'a5f00000-0000-0000-0000-0000000000e1'::uuid                                            as xorg_holder,-- gap.xorg.b (cross_org_actor)
  'a5f00000-0000-0000-0000-0000000000e2'::uuid                                            as nobody;     -- gap.unpriv (unprivileged; also the third-party caller)

-- ============================================================================
-- §2 — the cell set, and its controls.
-- ============================================================================

select cmp_ok((select count(*)::int from authz_differential_cells_staff), '>', 2000,
  -- ⚠ RE-MEASURED after the two named-defect fixes (`5ace5d91`, HEAD `f40babdc`): 3708, down from
  -- 6372 — the population SHRANK because 2664 cells that used to probe a scope-mismatched CCIH
  -- resource are now a NAMED skip (`no_resource_fixture_at_this_scope`), counted in the coverage
  -- census rather than emitted as a cell that could never agree with `catalog`. The floor is
  -- lowered to match, never raised to hide a further shrink — read here, not guessed.
  -- ⚠ RE-MEASURED again (backend round 4, seed `cea002eb`, vector `c5ef5fef`): 3348, down from
  -- 3708 — 648 `cast_case_vote_guard` cells (row 12, `commission.cases.vote`) are GONE from this
  -- table entirely, named-skipped as `door_is_a_write_guard_not_executable` (that door WRITES;
  -- T12's `425` polarity-flip owns it, never this file).
  -- ⚠ RE-MEASURED a third time (backend round 5, vector `d5015060`): 3024, down from 3348 — rows
  -- 4/11's `disjunct_absent`/`conjunct_unmet` bindings were re-derived from door truth tables
  -- (skips 2376/2160/648 named in backend's own count). Old -> new, all three measurements:
  -- 6372 -> 3708 -> 3348 -> 3024.
  '2.1 CARDINALITY CONTROL: the generated `staff` cell set is populated (3024 at `d5015060`). An '
  'empty or truncated vector file would let §§4-5 iterate nothing and pass having asserted nothing.');

select ok(
  (select count(*) from authz_differential_cells_staff where expected_granted) > 0
  and (select count(*) from authz_differential_cells_staff where not expected_granted) > 0,
  '2.2 ⭐ the EXPECTED column carries BOTH answers for `staff`.');

select is((select count(distinct legacy_class)::int from authz_differential_cells_staff), 11,
  -- ⚠ RE-MEASURED (backend round 4): 11, down from 12 — `cast_case_vote_guard` (row 12) no longer
  -- has ANY cell in this table (`door_is_a_write_guard_not_executable`, 648 cells named-skipped;
  -- `public.cast_case_vote` WRITES and is T12's job, never a read differential's). Old -> new: 12
  -- -> 11. ⚠ RE-VERIFIED at backend round 5 (vector `d5015060`): still 11 — unchanged.
  '2.3 ELEVEN legacy-equivalence classes (measured against the live vector, not guessed): TEN '
  'arm-3 door classes plus `is_member_of_for` (`commission.responses.create`, the inert 11th '
  'representative). ⭐⭐ A CONSEQUENCE of REPS_STAFF, not an adjustment: if this reds, the '
  'question is which class gained or lost a representative, never "what number matches today".');

select ok(
  (select count(*) from authz_differential_cells_staff where self_check) > 0
  and (select count(*) from authz_differential_cells_staff where not self_check) > 0,
  '2.4 ⭐⭐ §6A BOTH POLARITIES ARE PRESENT for `staff` — self-check AND third-party. ⛔ Not every '
  'class carries both any more (`keying=caller-only` classes are self-check only, BY DESIGN, not '
  'an omission — see the header) — this control is over the WHOLE cell set, which still does.');

select is(
  (select count(*)::int from public.case_participants cp
     join public.professional_participants pp on pp.participant_id = cp.participant_id
    where pp.professional_profile_id in (
      select pr.id from public.professional_profiles pr
      -- Row 1's masking control (matrix header; 409 §0(b)'s own control shape): the chosen
      -- `subject_holder` (staff4.ccih) must carry NO participation link, or
      -- `app.can_access_targeted_version`'s role-free disjunct grants regardless of membership and
      -- row 1's cells stop measuring bare membership. Unaffected by the mechanism change — this
      -- checks the FIXTURE, not the dispatch.
      where pr.id = (select uid from f424)
    )),
  0,
  '2.5 ⭐ MASKING CONTROL: `staff4.ccih`''s id names no `professional_participants` row via any '
  '`case_participants` link.');

-- ⚠ FIXED (this round): the control used to infer the probed TABLE from the `legacy_class` NAME —
-- a hand-maintained mapping this file owned. That is exactly the blindness that kept the prior
-- smoke green while the door measured nothing: row 16's real door reads `public.documents`, not
-- `public.controlled_documents` (the name the class suggests), and row 6's `can_reach_meeting_
-- not_respondent` keys on `meeting_id` in `public.meeting_cases`, not `id`. The vector now DECLARES
-- both facts per cell (`probe_table`, `probe_column`, from the manifest's `probeReadsTable` /
-- `probeReadsColumn`, derived by reading each door's body) — the control reads THAT, never a name
-- it infers itself.
create or replace function pg_temp.probe_exists(p_table text, p_column text, p_id uuid) returns boolean
language plpgsql stable as $pe$
declare v_exists boolean;
begin
  execute format('select exists(select 1 from %s where %I = %L::uuid)', p_table, p_column, p_id)
    into v_exists;
  return v_exists;
end;
$pe$;

select is(pg_temp.probe_exists('public.profiles', 'id', '00000000-0000-0000-0000-000000000000'::uuid), false,
  '2.6a ⭐ DISCRIMINATION HALF, KEPT: a deliberately-absent id is reported ABSENT by the same '
  '`probe_exists` check §2.6 below uses. Without this, §2.6 passing could mean either "every '
  'fixture is present" or "the check cannot see a missing row" — a control that never reds first '
  'is not a control.');

create or replace function pg_temp.fixture_control() returns text
language plpgsql volatile as $fc$
declare
  r record; v_missing text[] := array[]::text[];
begin
  -- ⭐ "A control per class, not per cell" — ONE existence check per DISTINCT
  -- (probe_table, probe_column, legacy_fixture_id) triple the vector actually names (≈36 pairs per
  -- backend's own smoke, not 3708 cells). `''`/`'(none)'` (no fixture needed — `is_member_of_for`)
  -- and `'{uid}'` (the SELF-read coordinate of `rls_profiles_comember_or_self`, whose OTHER fixture
  -- ids for the same class already exercise this control) are excluded by name, not silently
  -- skipped; a null/blank `probe_table` is reported, never silently passed.
  for r in
    select distinct probe_table, probe_column, legacy_fixture_id
      from authz_differential_cells_staff
     where legacy_fixture_id not in ('', '(none)', '{uid}')
  loop
    if r.probe_table is null or r.probe_table = '' then
      v_missing := v_missing || (r.legacy_fixture_id || ': no probe_table declared for this fixture id');
      continue;
    end if;
    if not pg_temp.probe_exists(r.probe_table, r.probe_column, r.legacy_fixture_id::uuid) then
      v_missing := v_missing || (r.probe_table || '.' || r.probe_column || '=' || r.legacy_fixture_id
                                  || ' NOT FOUND');
    end if;
  end loop;
  return coalesce(nullif(array_to_string(v_missing, ' | '), ''), '(none)');
end;
$fc$;

select is(pg_temp.fixture_control(), '(none)',
  '2.6 ⭐ FIXTURE CONTROL (RLS-bypassed, one check per (probe_table, probe_column, fixture id), not '
  'per cell): every `legacy_fixture_id` exists at the vector''s OWN declared probe coordinate — '
  'never a table this file infers from the class name.');

-- ============================================================================
-- §3 — the driver. Materialises each cell's principal state and claims, then EXECUTEs the vector's
-- own `legacy_sql` / `catalog_sql` verbatim. No door name, no resource id, no per-class branch.
-- ============================================================================

create or replace function pg_temp.cell_answers(
  p_persona text, p_ctx text, p_state text, p_self boolean, p_legacy_sql text, p_catalog_sql text
) returns table (legacy boolean, catalog boolean)
language plpgsql volatile as $d$
declare
  f record; v_principal uuid; v_caller uuid; v_role text;
begin
  perform test_helpers.reset_role_and_claims();
  select * into f from f424;
  v_principal := case p_persona
      when 'subject_holder' then f.uid
      when 'other_commission_holder' then f.other_id
      when 'cross_org_actor' then f.xorg_holder
      else f.nobody end;

  -- ⛔ RESET EVERY FIXTURE PRINCIPAL, NOT JUST THIS CELL'S — a driver whose answer depends on a
  -- PREVIOUS cell's leftover state is not measuring its subject (403 §3's own lesson).
  update public.profiles set is_active = true, suspended_until = null, email_confirmed_at = now()
   where id in (f.uid, f.other_id, f.xorg_holder, f.nobody);
  if p_state = 'deactivated' then update public.profiles set is_active = false where id = v_principal;
  elsif p_state = 'suspended' then update public.profiles set suspended_until = now() + interval '7 days' where id = v_principal;
  elsif p_state = 'pending' then update public.profiles set email_confirmed_at = null where id = v_principal;
  end if;

  -- ⭐ THE LOOP, VERBATIM PER BACKEND'S SPEC (L9′/L10). The active-role argument is derived from
  -- `active_context` REGARDLESS of self/third-party — the caller's claimed hat, not just the
  -- principal's, is part of the coordinate under test.
  v_caller := case when p_self then v_principal else f.nobody end;
  v_role := case p_ctx when 'matching' then 'staff' when 'other_role' then 'staff_admin' else null end;
  perform test_helpers.claims_for(v_caller, false, v_role);

  execute p_catalog_sql into catalog;

  set local role authenticated;
  execute p_legacy_sql into legacy;
  reset role;

  return next;
end $d$;

create temp table r424 on commit drop as
select c.*, a.legacy, a.catalog
  from authz_differential_cells_staff c
  cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.principal_state,
                                          c.self_check, c.legacy_sql, c.catalog_sql) a;

select test_helpers.reset_role_and_claims();

select is((select count(*)::int from r424), (select count(*)::int from authz_differential_cells_staff),
  '3.0 ⭐ EVERY `staff` CELL PRODUCED A ROW.');

select is((select count(*)::int from r424 where legacy is null or catalog is null), 0,
  '3.1 the driver returned an answer for EVERY `staff` cell.');

select ok(
  (select count(*) from r424 where catalog) > 0 and (select count(*) from r424 where not catalog) > 0,
  '3.2 ⭐ DISCRIMINATION CONTROL: the resolver returned BOTH answers across the `staff` sweep.');

select is((select state::text from authz.roles where code = 'staff'), 'test_validation',
  '3.2b ⭐ PRECONDITION mirroring 403''s §3.2b from `staff`''s side: `staff` sits in '
  '`test_validation`, which is what makes candidate_has_permission the correct oracle for this '
  'suite''s cells.');

select is((select count(*)::int from authz.roles where code = 'staff_admin' and state = 'test_validation'), 0,
  '3.2c ⭐ mirrors L4''s §3.2c from 424''s side: `staff_admin` is NEVER in `test_validation` while '
  '`staff` is — the two suites'' subjects are not confused.');

select is(
  (select count(*)::int
     from authz_differential_cells_staff c
     join r424 b on b.cell_id = c.cell_id
     cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.principal_state,
                                             c.self_check, c.legacy_sql, c.catalog_sql) a
    where a.catalog is distinct from b.catalog),
  0,
  '3.3 ⭐ DETERMINISM CONTROL: a second sweep over the same `staff` cells returns the same answers.');

-- ============================================================================
-- §4 — is(legacy, catalog).
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' catalog=' || catalog::text,
                              ' | ' order by cell_id), '(none)')
     from r424
    where legacy is distinct from catalog
      and expected_legacy_granted is not distinct from expected_granted),
  '(none)',
  '4.1 ⭐ LEGACY == CATALOG on every `staff` cell where the vector declares no divergence.');

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' expected_legacy=' ||
                              expected_legacy_granted::text || ' div=' || arm3_divergence,
                              ' | ' order by cell_id), '(none)')
     from r424
    where legacy is distinct from expected_legacy_granted),
  '(none)',
  '4.1b LEGACY == expected_legacy_granted on EVERY cell, labelled or not — the P1/P2 rulings are '
  'testable here, not assumed (see the header''s ruling-history note).');

-- ============================================================================
-- §5 — is(catalog, approved matrix value). THE ORACLE HALF.
-- ============================================================================

select is(
  (select coalesce(string_agg(cell_id || ' catalog=' || catalog::text || ' expected=' ||
                              expected_granted::text || ' src=' || expected_source,
                              ' | ' order by cell_id), '(none)')
     from r424 where catalog is distinct from expected_granted),
  '(none)',
  '5.1 ⭐⭐ CATALOG == THE APPROVED `staff` MATRIX VALUE.');

select is(
  (select count(*)::int from r424 where expected_source like 'deny-class:wrong_active_context:third-party%'
     and not catalog),
  0,
  '5.2 ⭐ §6A''s asymmetry for `staff`: every WRONG-HAT THIRD-PARTY cell is GRANTED.');

-- ============================================================================
-- §6 — THE SUITE SHOWN ABLE TO FAIL. Direct DML, reversed by its own inverse — NOT a bare SAVEPOINT.
-- ============================================================================

create or replace function pg_temp.disagreements() returns int
language sql volatile as $x$
  select count(*)::int
    from authz_differential_cells_staff c
    cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.principal_state,
                                            c.self_check, c.legacy_sql, c.catalog_sql) a
   where a.catalog is distinct from c.expected_granted;
$x$;

select cmp_ok(pg_temp.disagreements(), '=', 0,
  '6.0 ⭐⭐ BASELINE FOR BOTH FAIL-PROOFS — the oracle agrees on every `staff` cell before any '
  'deliberate mutation.');

delete from authz.role_permissions
 where role_code = 'staff' and permission_code = 'commission.forms.read';
select cmp_ok(pg_temp.disagreements(), '>', 0,
  '6.1 FAIL-PROOF 1 — flipping ONE seeded `staff` role_permissions row makes the oracle RED.');
insert into authz.role_permissions (role_code, permission_code)
  values ('staff', 'commission.forms.read');
select test_helpers.reset_role_and_claims();
select ok(
  (select a.catalog
     from authz_differential_cells_staff c
     cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.principal_state,
                                             c.self_check, c.legacy_sql, c.catalog_sql) a
    where c.permission_code = 'commission.forms.read' and c.persona = 'subject_holder'
      and c.scope = 'own_commission' and c.principal_state = 'active'
      and c.active_context = 'matching' and c.self_check and c.member_gate_arm = 'none'
    limit 1),
  '6.2 ...and RESTORING the grant makes the mutated permission resolve TRUE again at its base '
  'coordinate.');

select cmp_ok(pg_temp.disagreements(), '=', 0,
  '6.2b ⭐ THE RESTORE IS COMPLETE ACROSS THE WHOLE SWEEP.');

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
  '6.3 ⭐⭐ FAIL-PROOF 2 — with authz.scope_reaches REMOVED from the resolver, the `staff` oracle '
  'goes RED.');

-- ============================================================================
-- §7 — arm-3 census bound.
-- ============================================================================

-- ⚠ RE-MEASURED (backend round 4): `cast_case_vote_guard` (row 12) DROPPED from this array — its
-- door is a write guard, never executable in a read differential, named-skipped as
-- `door_is_a_write_guard_not_executable` (T12's `425` owns its polarity). Row 12 is still one of
-- the matrix § 5.3's eleven arm-3 ROWS; this assertion is now about the TEN classes 424 actually
-- executes, not the eleven-row matrix count — the two numbers answer different questions and
-- neither is guessed from the other. ⚠ RE-VERIFIED at backend round 5 (vector `d5015060`): the
-- same ten names — unchanged.
select is(
  (select array_agg(distinct legacy_class order by legacy_class)
     from authz_differential_cells_staff where member_gate_arm <> 'none')::text,
  (array['can_reach_meeting','can_reach_meeting_not_respondent','can_read_action_item','can_read_capa',
         'can_sign_meeting','case_caps_deliberation',
         'rls_accreditation_frameworks_owner_null','rls_controlled_documents_approver',
         'rls_form_matrix_targeted_version','rls_profiles_comember_or_self'])::text,
  '7.1 the emitted arm-3 coordinate set is exactly TEN of the matrix § 5.3''s eleven rows, named — '
  'row 12 (`cast_case_vote_guard`) is named-skipped here (a write guard, T12''s job) and is not '
  'expected in this array.');

select * from finish();
rollback;
