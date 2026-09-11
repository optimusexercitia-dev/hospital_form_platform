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
--   * `1080 cells` is 432 DISTINCT DRIVER-OBSERVABLE COORDINATES. The driver's answer depends on
--     (persona, context, scope, RESOLUTION-SCOPE-KIND, state, self_check) — not on the permission
--     code — and FOUR of the five representatives are org-scoped, so 648 of the cells re-run a
--     coordinate an earlier rep already measured. That re-run is not worthless (it shows the four
--     org-scoped codes agree) but it is not 1080 independent measurements, and citing 1080 as the
--     measurement count is the inflation the axes file itself warns against.
--     ⛔ RE-DERIVED, NOT SCALED, THREE TIMES NOW. This read `657 / 438 / 219` until ADR 0175 D2
--     deleted the nine anonymous cells, then `648 / 432 / 216` until AE4.9 added a fourth
--     representative, then `864 / 432 / 432` until pre-AE5 Batch 10 added a fifth (PO ruling R4).
--     Note what did and did NOT move: the cell count went 864 -> 1080 (5 reps x 216) and the
--     RE-RUN count went 432 -> 648, but DISTINCT COORDINATES STAYED AT 432 — it is bounded by the
--     number of distinct resolution-scope KINDS (2), not by the number of reps. Scaling all three
--     numbers by 5/4 would have produced a plausible, wrong 540.
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
--   * 180 CELLS LABELLED `third_party` HAVE CALLER == PRINCIPAL. The driver deliberately uses
--     f.nobody as the third-party caller (see its comment — using f.uid made the subject_holder
--     cells self-checks in disguise), but `unprivileged`'s principal IS f.nobody, so for that
--     persona the same substitution recreates the very defect it was written to avoid. Those 180
--     cells are self-checks wearing a third-party label. They are not WRONG — a non-holder is
--     denied either way — but they do not exercise the §6A asymmetry, and the asymmetry's real
--     evidence is the 46 `wrong_active_context:third-party` cells, not the 180.
--     ⛔ CORRECTED 2026-09-10 (pre-AE5 Batch 10), AND THE CORRECTION IS BIGGER THAN THE FIFTH REP.
--     These read `108` and `26`. Re-measured against the vector AS IT STOOD AT HEAD BEFORE this
--     batch (4 reps, 864 cells) they were already `144` and `36` — i.e. the literals were the
--     THREE-rep values and AE4.9 moved the reps without moving them. A cited figure rots when its
--     artifact is regenerated, and it rots in the direction that reads as care (a smaller caveat).
--     Both are now MEASURED off the generated file, at 5 reps: 180 and 46.
--
-- ⚠ PER-PERMISSION GRAIN: the axis sweep runs one representative per legacy-equivalence class it
-- can cover — FIVE reps over the SIX classes 401 §19.2 counts (FOUR until pre-AE5 Batch 10, PO
-- ruling R4). ⭐ THE BODY-IDENTITY REDUCTION IS RETIRED: no class is covered any longer by two
-- functions continuing to agree. The ONE uncovered class is named rather than left to inference:
-- `can_manage_professional` (row 30) has no rep because staff_admin does NOT hold that code, so
-- every cell would be a denial (the single-polarity trap AE4.7c already hit once).
-- `can_manage_external_participant` (row 31) now has a rep OF ITS OWN — `org.participants.external.manage`
-- — because ADR 0201 D5 armed the vocabulary gate ALONE and the two bodies diverged, exactly as
-- the old §2.3b said they one day would. §2.3b is re-ruled onto that rep's existence and polarity.
-- Per-permission GRANT is covered by 401 §19.4's 43 cheap probes. Per-permission AXES are not
-- observable until AE5 gives a role a partial map.
--
-- RUN SHAPE: `Files=2, Tests=28` (27 here + 00_setup.sql's one). ⚠ 18 -> 21: ADR 0175 D3's § 7,
-- the three assertions that BOUND F3's discharge. ⚠ 21 -> 22: AE4.9's § 3.2b, the bound on
-- pointing this suite at the CANDIDATE evaluator. ⚠ 22 -> 23: AE4.9's § 2.3b, the body-identity
-- assertion that licensed ONE rep covering rows 31 and 32. ⭐ pre-AE5 Batch 10 moves NOTHING here,
-- and that is worth saying rather than leaving as an absence: a fifth representative adds 216
-- CELLS (864 -> 1080), which §§4-5 fold into their existing aggregate assertions, and §2.3/§2.3b
-- ⚠ THE CELL COUNT ABOVE IS SPENT: 1080 -> 1728 at AE5-MATRIX-ARM3-CELLS increment 2. The rep count
-- is still FIVE and that half stands; what moved is the AXIS COUNT — `caseReach` multiplies the
-- arm-3 rep alone by 4 (216 -> 864) and a named skip rule holds the other four reps at 216 each,
-- so 864 + 4x216 = 1728. ⛔ A reader diagnosing a count mismatch against "1080" is reading a shape
-- two increments old, which is the exact failure the line below warns about.
-- are RE-RULED rather than added to. A rep is not an assertion. ⛔ Keep this line in step with
-- plan() — the QA review caught it already claiming 12 against plan(15), and a stale RUN SHAPE is
-- read as the expected shape by the next person diagnosing a count mismatch.
-- ⚠ 23 -> 27 at AE5-MATRIX-ARM3-CELLS increment 3, and each of the four is a CONSEQUENCE of arm 3
-- becoming REACHABLE in this fixture: § 4.1b (the LEGACY door's own oracle, which PAYS FOR the
-- carve-out § 4.1 now takes), § 7.3b (the four reaches measured at one coordinate), § 7.4 (the
-- filed defect PINNED, never approved) and § 7.5 (the guard PO ruling R2 requires on the fix).
-- ⭐ 27 -> 27 AT ARM3-HAT-TERM-FIX, AND THE UNMOVED TOTAL IS WORTH STATING RATHER THAN LEAVING AS
-- AN ABSENCE: § 7.4 was DELETED (its bug is fixed by ADR 0209 / migration 20261003007400, and
-- deletion is the route its own message named) and § 7.4b ADDED in its place — a LIVE head-on pin
-- of the door-level ACT hat term, in three lines: the DENY the fix creates, the GRANT it must not
-- break (PO ruling R2's role-less reach), and the hatless-holder value no cell can carry. ⛔ A
-- reader diagnosing plan(27) against a diff that deletes an assertion is looking at a SWAP, not at
-- a silently dropped test.

begin;
select plan(27);

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

-- ⭐⭐ AE5-MATRIX-ARM3-CELLS INCREMENT 3 — THE PARTICIPATION FIXTURE ARM 3 NEEDS.
-- ⛔ IT LIVES HERE AND NOT IN seed.sql, deliberately: a seed change ripples into ~900 tests, every
-- one of which would silently start carrying a professional_participants row it never asked for —
-- and `professional_participants_select`'s USING clause IS app.can_read_professional_profile, so
-- the blast radius would be precisely the door under test. Fixture-owned, FIXED ids (⛔ never a
-- seed gen_random_uuid() captured at authoring time: ids pinned that way are green only on the
-- reset that produced them), identified precisely, cleaned up last.
--
-- THREE CASES, ONE PER HOLDING COMMISSION, because arm 3's ROLE-KEYED reach is `_case_caps` S1,
-- `app.is_staff_admin_of_for(cases.commission_id, caller)`: the case must be where the CALLER
-- holds, and the three holder personas hold in three DIFFERENT commissions. One case would make
-- `role_keyed` constructible for exactly one persona and silently inert for the other two.
--
-- TWO PARTICIPANTS, ONE PER ORGANIZATION, because `trg_assert_participant_same_org_as_case` binds
-- participants.organization_id to cases.organization_id. ⛔ NOTHING binds the professional
-- PROFILE's organization to either — no trigger, no constraint — and that MISSING EDGE IS the
-- cross-org divergence ADR 0175 D3 predicted: an org-B participant may carry an org-A profile and
-- the same-org trigger ACCEPTS the row. § 7.3b measures that rather than asserting it in prose.
-- ⚠ `professional_participants` is UNIQUE on professional_profile_id, so a profile has at most ONE
-- participant at a time. That is why the link is built PER CELL by pg_temp.set_case_reach below
-- and not once here: a cell's reach decides which organization the subject profile participates in.
alter table f403 add column case_own  uuid;
alter table f403 add column case_sib  uuid;
alter table f403 add column case_xorg uuid;
alter table f403 add column part_own  uuid;
alter table f403 add column part_xorg uuid;
alter table f403 add column role_own  uuid;
alter table f403 add column role_xorg uuid;
update f403 set case_own  = '00000000-0000-4403-8000-0000000000a1'::uuid,
                case_sib  = '00000000-0000-4403-8000-0000000000b1'::uuid,
                case_xorg = '00000000-0000-4403-8000-0000000000c1'::uuid,
                part_own  = '00000000-0000-4403-8000-000000000021'::uuid,
                part_xorg = '00000000-0000-4403-8000-000000000022'::uuid,
                role_own  = '00000000-0000-4403-8000-000000000031'::uuid,
                role_xorg = '00000000-0000-4403-8000-000000000032'::uuid;

-- ⚠ A PARTICIPANT ROLE PER ORG, FIXTURE-OWNED. The seed ships case_participant_roles for Rede A
-- only, so a cross-org case cannot borrow one; and the seed's `respondent_doctor` must be avoided
-- outright — `_case_caps` STEP 4 hard-denies a respondent BEFORE every positive arm, which would
-- turn an arm-3 GRANT cell into a silent deny for a reason the cell never names.
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
select role_own,  own_oid,  'zz403_participant', 'ZZ403 Participante', array['professional'] from f403 union all
select role_xorg, xorg_oid, 'zz403_participant', 'ZZ403 Participante', array['professional'] from f403;

insert into public.cases (id, commission_id, organization_id, label, status)
select case_own,  own_cid,  own_oid,  'ZZ403 caso own',  'not_started' from f403 union all
select case_sib,  sib_cid,  own_oid,  'ZZ403 caso sib',  'not_started' from f403 union all
select case_xorg, xorg_cid, xorg_oid, 'ZZ403 caso xorg', 'not_started' from f403;

insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select part_own,  own_oid,  'professional', 'professional_identity', 'ZZ403 Part OwnOrg'   from f403 union all
select part_xorg, xorg_oid, 'professional', 'professional_identity', 'ZZ403 Part CrossOrg' from f403;

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

select is((select count(distinct legacy_class)::int from authz_differential_cells), 5,
  '2.3 FIVE legacy-equivalence classes are swept. ⭐⭐ THE 5 IS A CONSEQUENCE, NOT AN ADJUSTMENT, '
  'and the difference matters: 401 §19.2 counts SIX classes, and the sweep covers the five it '
  'CAN. The ONE it cannot is `can_manage_professional` (row 30): staff_admin does not hold that '
  'code, so a rep on it would make every cell a denial. ⚠ 3 -> 4 at AE4.9: the D6 re-key split '
  'can_create_professional''s body away from rows 31/32, so the create rep stopped speaking for '
  'them and a fourth rep was added (lead ruling, option (b)). ⚠ 4 -> 5 at pre-AE5 Batch 10 (PO '
  'ruling R4, 2026-09-10): ADR 0201 D5 armed app.can_manage_case_vocabulary with the relocated '
  'platform arm and app.can_manage_external_participant DELIBERATELY NOT (D5''s declared loss '
  'list, pinned RED-first by 418 §4.7), so the two bodies diverged and row 31 lost the rep it '
  'shared. ⭐⭐ WHY THE COUNT MOVED IS THAT A REPRESENTATIVE NOW EXISTS — NOT THAT A BODY '
  'DIVERGED. The divergence is the CAUSE of the loss; the 5 records the REPAIR. Re-coding this '
  'to a number that matched the divergence would have recorded the loss as if it were the fix. '
  '⛔ IF THIS REDS, THE QUESTION IS WHICH CLASS LOST OR GAINED A REP — never "what number '
  'matches today". An expected value edited to track reality is not an assertion.');

select is(
  coalesce(
    (select 'class=' || min(c.legacy_class) || ' scope=' || min(c.resolution_scope_kind)
            || ' classes=' || count(distinct c.legacy_class)::int::text
            || ' granted=' || (count(*) filter (where c.expected_granted) > 0)::text
            || ' denied='  || (count(*) filter (where not c.expected_granted) > 0)::text
       from authz_differential_cells c
      where c.permission_code = 'org.participants.external.manage'
     having count(*) > 0),
    '(NO CELLS — row 31 has NO REPRESENTATIVE)'),
  'class=can_manage_external_participant scope=organization classes=1 granted=true denied=true',
  '2.3b ⭐⭐ ROW 31 HAS A REPRESENTATIVE OF ITS OWN, AND THAT REPLACES THE BODY IDENTITY THIS '
  'ASSERTION USED TO PIN. ⚠ RE-RULED 2026-09-10 (pre-AE5 Batch 10, PO ruling R4) — READ WHAT '
  'MOVED AND WHY. Until today this asserted `count(distinct comment-stripped prosrc) = 1` over '
  'app.can_manage_external_participant and app.can_manage_case_vocabulary, because ONE rep '
  '(org.case_vocabulary.manage) covered rows 31 AND 32 and the ONLY thing licensing that '
  'reduction was the two gates'' bodies being identical. ADR 0201 D5 armed the vocabulary gate '
  'with the relocated platform arm and the participant gate DELIBERATELY NOT (D5''s declared '
  'loss list — a platform_admin must not mint participants in a tenant''s org; pinned RED-first '
  'by 418 §4.7). The bodies diverged and this assertion RED, doing precisely the job it was '
  'written for. ⛔ THE RED WAS NOT RE-CODED TO 2. The count is gone entirely, because a body '
  'count can no longer say anything about coverage here: row 31 now carries '
  'org.participants.external.manage as its OWN rep, so nothing rides on the two gates agreeing '
  'and a re-merge would cost redundancy, not coverage. ⭐ WHAT THIS NOW PROVES, and it is '
  'strictly what the reduction used to buy: the rep EXISTS in the generated cell set, is wired '
  'to the can_manage_external_participant class (`classes=1` forbids a rep straddling two), '
  'resolves at ORGANIZATION scope, and carries BOTH expected polarities — the last clause is the '
  'single-polarity trap AE4.7c hit, where a rep on a code staff_admin does not hold makes every '
  'cell of its class a denial while arm2 stays satisfied globally by the other reps. ⛔ A rep '
  'that is merely PRESENT is not yet LIVE: liveness is what the driver''s '
  'pg_temp.unknown_legacy_class raise and §§3.0-3.1 enforce (an emitted class with no dispatch '
  'branch ERRORS the suite; a cell that produced no row or a NULL answer reds there). It was '
  'also demonstrated by planting a broken-open body on the door and watching §4.1 red on these '
  'cells alone — recorded in docs/progress/admin-arm-is-active.md. ⚠ The partition half lives in '
  '401 §19.2b/c, deliberately mirrored: that suite guards WHICH BODIES exist and that each has a '
  'rep; this one guards THE SWEEP.');

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

-- ⛔ THE DRIVER'S `else` IS NO LONGER A CATCH-ALL. A legacy class the dispatch below does
-- not name RAISES instead of being silently routed to whichever door the `else` happened to
-- hold. Returns boolean only so it can sit in the CASE expression; it never returns.
create or replace function pg_temp.unknown_legacy_class(p_class text) returns boolean
language plpgsql immutable as $u$
begin
  raise exception '403 driver: legacy class % has no dispatch branch. Add one; do NOT let a '
    'default arm answer for it.', p_class;
end;
$u$;

-- ⭐⭐ THE caseReach AXIS, CONSTRUCTED. One function, called by the driver AND by §§7.3b/7.5, so
-- the reach the sweep measures and the reach the witnesses measure can never drift apart.
--
-- ⛔ IT RESETS BEFORE IT BUILDS, EVERY CELL, exactly as the principal-state block below does and
-- for the same reason: leaving a previous cell's participation in place makes the answers
-- ORDER-DEPENDENT, and §3.3 would catch it as non-determinism without saying why.
--
-- The four values, and what each one is FOR (axes JSON `caseReach._source` carries the predicate):
--   none        — NO participation. arm 3 denies through an EMPTY JOIN. This is the state the
--                 fixture was in before increment 3, and it is kept as a VALUE rather than simply
--                 replaced, because every arm-3 deny satisfied by an absent row is the
--                 keystone-that-could-not-fail shape (docs/learning/LESSONS.md).
--   unreachable — participation EXISTS, on a case the caller provably holds NOTHING on, so
--                 `_case_caps` returns 0 and arm 3 denies for the RIGHT REASON. This is the
--                 non-vacuous deny, and it is the CONTROL for grant_keyed below.
--   role_keyed  — participation on a case in the commission where the caller HOLDS staff_admin,
--                 so the reach is S1. S1 runs through authz.holds_role, whose trailing conjunct
--                 binds the active hat on a self-check — which is why this value can be SILENCED
--                 by the wrong hat and grant_keyed cannot.
--   grant_keyed — ⭐ IDENTICAL PARTICIPATION TO `unreachable`, PLUS ONE case_access_grants ROW.
--                 The pair is a one-row differential: anything that separates them is the grant,
--                 and nothing else. That is what makes §7.3b evidence rather than observation.
--
-- ⚠ The case for `unreachable`/`grant_keyed` is chosen PER PERSONA as one the caller holds no role
-- in (chefe and the sibling holder get the cross-org case; the cross-org holder and the
-- unprivileged principal get the own-org one), which is checkable against §1's memberships: each
-- fixture principal has exactly ONE, and chefe's single seeded membership is asserted by the
-- unit's derivation. ⛔ Do not "simplify" this to one fixed case — for one persona it would then
-- be a case they coordinate, S1 would co-fire, and grant_keyed would stop isolating S3.
create or replace function pg_temp.set_case_reach(p_persona text, p_scope text, p_reach text)
returns void language plpgsql volatile as $r$
declare
  f record; v_principal uuid; v_prof uuid; v_case uuid; v_part uuid; v_role uuid;
begin
  select * into f from f403;
  v_principal := case p_persona
      when 'subject_holder' then f.uid
      when 'other_commission_holder' then f.sib_holder
      when 'cross_org_actor' then f.xorg_holder
      else f.nobody end;

  -- ⛔ FULL RESET FIRST. Identified by the fixture's own ids, never positionally.
  delete from public.case_access_grants
   where case_id in (f.case_own, f.case_sib, f.case_xorg);
  delete from public.case_participants
   where participant_id in (f.part_own, f.part_xorg);
  delete from public.professional_participants
   where participant_id in (f.part_own, f.part_xorg);
  if p_reach = 'none' then
    return;
  end if;

  -- ⛔ THE PROFILE IS CHOSEN BY THE SAME SCOPE RULE THE DRIVER USES FOR v_scope_id AND FOR THE
  -- DOOR'S FIRST ARGUMENT. Choosing it any other way would let the reach be built for a profile
  -- the cell never reads, and every arm-3 cell would go silent while still claiming a reach.
  v_prof := case p_scope when 'foreign_org_commission' then f.xorg_prof else f.own_prof end;

  if p_reach = 'role_keyed' then
    v_case := case p_persona
        when 'other_commission_holder' then f.case_sib
        when 'cross_org_actor'         then f.case_xorg
        else                                f.case_own end;
  else
    v_case := case p_persona
        when 'cross_org_actor' then f.case_own
        when 'unprivileged'    then f.case_own
        else                        f.case_xorg end;
  end if;
  -- The participant must live in the CASE's organization (trg_assert_participant_same_org_as_case);
  -- the PROFILE it carries is unconstrained, which is the whole cross-org divergence.
  if v_case = f.case_xorg then v_part := f.part_xorg; v_role := f.role_xorg;
  else                         v_part := f.part_own;  v_role := f.role_own;  end if;

  insert into public.professional_participants (participant_id, professional_profile_id)
    values (v_part, v_prof);
  insert into public.case_participants (case_id, participant_id, role_id)
    values (v_case, v_part, v_role);

  if p_reach = 'grant_keyed' then
    insert into public.case_access_grants
      (case_id, principal_id, read_case_content, read_case_deliberation)
      values (v_case, v_principal, true, true);
  end if;
end $r$;

create or replace function pg_temp.cell_answers(
  p_persona text, p_ctx text, p_scope text, p_code text, p_class text, p_state text, p_self boolean,
  p_reach text
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

  -- ⭐ THE REACH, BUILT BEFORE THE CLAIMS ARE SET. Still running as the suite's own role here, so
  -- the fixture DML is not subject to the RLS the claims below would impose. ⛔ Called for EVERY
  -- cell, not only the arm-3 ones: for the other four representatives the reach is always `none`
  -- and this collapses to three deletes that remove nothing — which is exactly the guarantee the
  -- determinism control needs, because it means no cell can inherit a neighbour's participation.
  perform pg_temp.set_case_reach(p_persona, p_scope, p_reach);

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
    -- ⭐ AE4.9: the FOURTH class (lead ruling 2026-09-02, option (b)). Rows 31 and 32 lost their
    -- representative when the D6 re-key split can_create_professional's body away from theirs.
    when 'can_manage_case_vocabulary'    then app.can_manage_case_vocabulary(v_scope_id, v_principal)
    -- ⭐⭐ pre-AE5 BATCH 10 (PO ruling R4, 2026-09-10): the FIFTH class. ADR 0201 D5 armed the
    -- vocabulary gate above with the relocated platform arm and left THIS one alone on purpose, so
    -- the shared body that let one rep speak for rows 31 and 32 is gone. The branch is what makes
    -- the new rep LIVE rather than merely present: the `else` below RAISES, so an emitted class
    -- with no branch here errors the suite instead of being answered by a default arm — which is
    -- how the fourth class would have been silently routed to the professional-profile door.
    -- ⛔ THE DOOR IS CALLED DIRECTLY, not through a sibling that happens to agree with it today.
    -- Agreeing-by-body was the whole defect; substituting can_manage_case_vocabulary here would
    -- have reproduced it one layer down, where no assertion in this file could see it.
    when 'can_manage_external_participant' then app.can_manage_external_participant(v_scope_id, v_principal)
    -- ⛔ The profile is chosen by the SAME scope rule as v_scope_id above. Choosing it any other
    -- way (or using one profile) decouples the door's org from the cell's scope, and the scope
    -- axis stops being swept while the cell ids still claim it is.
    when 'can_read_professional_profile' then app.can_read_professional_profile(
           case p_scope when 'foreign_org_commission' then f.xorg_prof else f.own_prof end,
           v_principal)
    -- ⛔⛔ THE `else` USED TO BE A CATCH-ALL FOR can_read_professional_profile, AND THAT IS A
    -- DEFAULT ARM — the exact shape ADR 0176 D5 retires from 401 § 19. It bit immediately: adding
    -- the fourth class above would have sent EVERY one of its cells to the professional-profile
    -- door, and the suite would have reported a clean differential for a class it never called.
    -- The door is now named explicitly and an unknown class RAISES rather than being absorbed.
    else pg_temp.unknown_legacy_class(p_class)
  end;
  catalog := authz.candidate_has_permission(v_principal, v_res, v_scope_id, p_code);
  return next;
end $d$;

create temp table r403 on commit drop as
select c.*, a.legacy, a.catalog
  from authz_differential_cells c
  cross join lateral pg_temp.cell_answers(c.persona, c.active_context, c.scope,
                                          c.permission_code, c.legacy_class,
                                          c.principal_state, c.self_check, c.case_reach) a;

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
                                             c.legacy_class, c.principal_state, c.self_check,
                                             c.case_reach) a
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
     from r403
    where legacy is distinct from catalog
      and expected_legacy_granted is not distinct from expected_granted),
  '(none)',
  '4.1 ⭐ LEGACY == CATALOG on every cell WHERE THE VECTOR DECLARES NO DIVERGENCE. ⛔ Because the '
  'matrix is ALREADY APPROVED, a difference here means legacy is wrong or the resolver is wrong — '
  'it is never a licence to record "the catalog matches legacy" and move on (PA-F8). The message '
  'names the disagreeing cells. '
  '⚠⚠ THERE IS NOW EXACTLY ONE CARVE-OUT, AND IT IS NOT AN EXEMPTION — read what pays for it. '
  'Cells where `expected_legacy_granted <> expected_granted` are the 84 the AE5 arm-3 derivation '
  'DECLARES divergent under PO ruling R2, and § 4.1b asserts the legacy answer on them BY VALUE, '
  'so nothing is merely skipped. They diverge for a structural reason rather than a defect: '
  '`authz.candidate_has_permission` is a role/permission resolver with NO case arm, and arm 3 '
  'reaches through a CASE GRANT, which is not a permission and is not meant to become one. '
  'MEASURED live at head, class-4 grant_keyed coordinate — door TRUE (arm1 f, arm2a f, arm2b f, '
  'caps 6) against resolver FALSE. '
  '⭐⭐ THE SECOND CARVE-OUT IS GONE, BY THE ROUTE ITS OWN MESSAGE NAMED. It excused ten '
  '`arm3:divergent-defective:hat-unenforceable` cells BY LABEL, because a case grant could stand '
  'in for a missing ACT hat and no expected value may launder a defect into the oracle. ADR 0209 '
  '(migration 20261003007400) fixed the door — the hat is now a term evaluated BEFORE the arms — '
  'so those cells (with eight re-ruled cross-org siblings) carry `arm3:pre-empted:door-hat-term`, '
  'expect DENY, and are compared here BY VALUE like everything else. § 7.4 was DELETED with the '
  'carve-out, never edited from "granted on 10" to "granted on 0"; its successor is § 7.4b, which '
  'pins the term head-on in both polarities. ⚠ The flip count moved 92 -> 84 for the same reason: '
  'the eight cross-org cells stopped expecting a legacy GRANT.');

select is(
  (select coalesce(string_agg(cell_id || ' legacy=' || legacy::text || ' expected_legacy=' ||
                              expected_legacy_granted::text || ' div=' || arm3_divergence,
                              ' | ' order by cell_id), '(none)')
     from r403
    where legacy is distinct from expected_legacy_granted),
  '(none)',
  '4.1b ⭐⭐ THE LEGACY DOOR HAS ITS OWN APPROVED VALUE, AND THIS IS WHERE ARM 3 STOPS BEING '
  '"EXERCISED, NOT ORACLED" (ADR 0175 D3''s forward promise, discharged). § 4.1 above can only '
  'ever say the two implementations agree; on the 84 cells where they are RULED to disagree it '
  'has nothing to compare, and without this assertion the carve-out would be pure subtraction. '
  '`expected_legacy_granted` is transcribed by the generator from the arm-3 derivation exactly as '
  '`expected_granted` is transcribed from the deny-class table — no resolver logic, no case-caps '
  'reimplementation — and generator arm10 refuses a divergence with no label to attribute it to. '
  '⭐⭐ THIS ASSERTION NOW COVERS EVERY CELL. The ten-cell label carve-out is gone: ADR 0209 made '
  'the ACT hat a term the door evaluates BEFORE its arms, so the cells that used to be excused '
  'DENY here BY VALUE, under `arm3:pre-empted:door-hat-term`, and § 7.4 was deleted with the '
  'exemption it paid for. ⛔ THAT IS ALSO WHAT MAKES THIS THE MUTATION ORACLE FOR THE FIX ITSELF: '
  'a hat check keyed on the HAT ALONE — one that forgets to ask whether the caller holds any role '
  '— reds here on the 36 `arm3:divergent-approved:not-a-holder` cells, because S3 is role-free by '
  'design and an unprivileged principal reaching through an explicit grant is reach PO ruling R2 '
  'APPROVED. Measured as mutant C, and again as mutant C′ on the door-level term. '
  '⛔ IF THIS REDS, THE QUESTION IS WHICH WAY THE DOOR MOVED, never "what value matches today". A '
  'cell that now DENIES where the vector expects a legacy GRANT means a narrowing revoked reach '
  'PO ruling R2 approved ("the case-grant path deliberately anchors on the case, not on the '
  'caller''s org or role"); a cell that now GRANTS where the vector expects a DENY means arm 3 '
  'grew reach nobody ruled. Both are findings; neither is an expected value to edit.');

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
                                            c.principal_state, c.self_check, c.case_reach) a
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
                                             c.legacy_class, c.principal_state, c.self_check,
                                             c.case_reach) a
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

-- ⭐⭐ § 7.3 WAS REPLACED, NOT RENUMBERED, AT AE5-MATRIX-ARM3-CELLS INCREMENT 3.
-- It used to assert `count(professional_participants for the two subject profiles) = 0` and said:
-- "⛔ If this reds because someone added a participation row, do not adjust the number — the arm
-- just became reachable and its cells need approved expected values first." That is exactly what
-- happened, in that order: the reach was built (pg_temp.set_case_reach), the approved expected
-- values arrived (PO ruling R2, carried by `expected_legacy_granted`), and only then did the `0`
-- go. ⛔ NOTHING HERE MAY BE "FIXED" BY EDITING A COUNT TO MATCH A NEW FIXTURE — what replaced the
-- sentinel says WHERE arm 3 grants and WHAT THE APPROVED ANSWER IS, which is the debt the old
-- sentinel was holding open.
select is(
  (select string_agg(x, ' ' order by x) from (
     select arm3_divergence || '=' || count(*)::int::text || '/' ||
            (case when bool_and(expected_legacy_granted)     then 'GRANT'
                  when bool_and(not expected_legacy_granted) then 'DENY'
                  else 'MIXED' end) as x
       from authz_differential_cells
      where case_reach = 'grant_keyed'
      group by arm3_divergence) g),
  'arm3:blocked:principal-state=108/DENY '
  'arm3:divergent-approved:cross-org=24/GRANT '
  'arm3:divergent-approved:not-a-holder=36/GRANT '
  'arm3:masking=30/GRANT '
  'arm3:pre-empted:door-hat-term=18/DENY',
  '7.3 ⭐⭐ WHERE ARM 3 GRANTS, AND WHAT THE APPROVED ANSWER IS — the whole grant_keyed column, '
  'partitioned, with each partition''s approved LEGACY answer beside it. Read it as five rulings: '
  '(108) `_case_caps` STEP 2 shuts arm 3 for a suspended or deactivated principal, so no fixture '
  'can make it fire and DENY is structural, not approved; (30) arm 3 agrees with a grant the cell '
  'already expected and MASKS the arm the cell names — which is why `none` had to survive as an '
  'axis value instead of the fixture simply gaining participation; (24 + 36) PO ruling R2 — an '
  'explicit case grant needs NO role and anchors on the CASE, never on the caller''s org, so both '
  'are APPROVED designed reach and their approved legacy answer is GRANT; (18) the DOOR''s own ACT '
  'hat term (ADR 0209 D1), evaluated BEFORE the arms, whose approved answer is DENY because the '
  'hat rule SHOULD deny a holder self-checking under a role they do not hold. '
  '⭐⭐ THE STRING WAS RE-DERIVED BY RUNNING THIS QUERY, NEVER HAND-EDITED. It read '
  '`cross-org=32/GRANT` and `divergent-defective:hat-unenforceable=10/DENY` until 2026-09-11. The '
  'ten were the filed bug (a case grant standing in for a missing hat); the door now denies them '
  '— AND EIGHT MORE. ⛔ THOSE EIGHT ARE A RE-RULING, NOT A COUNT CORRECTION (ADR 0209 D5, PO to '
  'ratify): they are `other_role` SELF-checks at a cross-org coordinate, and they sat in class 4 '
  'only because the generator''s `expected()` resolves scope (`deny-class:cross_org`) BEFORE the '
  'hat (`wrong_active_context:self`). R2 approved CROSS-ORG reach and never spoke to the WRONG '
  'HAT — and a hat term that spared them would have to be conditioned on org, which is precisely '
  'the org check R2 forbids. '
  '⛔ THE 24/36 GRANT AND THE 18 DENY ARE THE SAME MEASUREMENT WEARING TWO RULINGS. Merging them '
  '— by giving the pre-empted cells a GRANT to "match reality", or by demoting the approved pair '
  'to DENY to "tighten" the door — is the single thing R2 forbids, in either direction. Generator '
  'arm10 refuses both edits at generation time; this asserts the result reached the vector. '
  '⚠ THE PARTITION IS THE ORACLE, NOT THE TOTAL: if a count moves, the question is which cells '
  'changed class, never which number matches today.');

-- ⭐⭐ THE LIVE HALF. § 7.3 asserts what the vector RULES; this measures what the door DOES, at
-- one coordinate, across all four reaches. ⛔ The coordinate is chosen so the door's answer IS
-- arm 3's answer: a cross-org actor reading an own-org profile has arm 1, arm 2a and arm 2b all
-- false at EVERY reach (asserted in the string, not assumed), so nothing else can move it.
create or replace function pg_temp.arm3_probe(p_persona text, p_scope text, p_reach text)
returns text language plpgsql volatile as $p$
declare
  f record; v_principal uuid; v_prof uuid; v_org uuid; v_live int;
begin
  perform test_helpers.reset_role_and_claims();
  select * into f from f403;
  v_principal := case p_persona
      when 'subject_holder' then f.uid
      when 'other_commission_holder' then f.sib_holder
      when 'cross_org_actor' then f.xorg_holder
      else f.nobody end;
  v_prof := case p_scope when 'foreign_org_commission' then f.xorg_prof else f.own_prof end;
  select organization_id into v_org from public.professional_profiles where id = v_prof;
  perform pg_temp.set_case_reach(p_persona, p_scope, p_reach);
  -- ⭐ THE JOIN ARM 3 WALKS, COUNTED SEPARATELY. Without it `none` and `unreachable` would both
  -- read "door=false" and the non-vacuous deny would be indistinguishable from the empty one —
  -- which is the whole reason `unreachable` exists as an axis value.
  select count(*)::int into v_live
    from public.professional_participants pp
    join public.case_participants cp
      on cp.participant_id = pp.participant_id and cp.removed_at is null
   where pp.professional_profile_id = v_prof;
  -- The MATCHING hat, deliberately: every holder persona holds staff_admin, so a future hat check
  -- inside arm 3 (the shape BUG-...-HAT-TERM-UNENFORCEABLE's fix takes) must leave this alone.
  perform test_helpers.claims_for(v_principal, false, 'staff_admin');
  return p_reach || ': participation=' || v_live::text
    || ' arm1=' || coalesce(app.is_admin_for(v_principal), false)::text
    || ' arm2a=' || app.can_manage_professional(v_org, v_principal)::text
    || ' arm2b=' || authz.has_permission(v_principal, 'organization', v_org,
                                         'org.professionals.read')::text
    || ' door=' || app.can_read_professional_profile(v_prof, v_principal)::text;
end $p$;

select is(
  pg_temp.arm3_probe('cross_org_actor', 'own_commission', 'none')        || ' | ' ||
  pg_temp.arm3_probe('cross_org_actor', 'own_commission', 'unreachable') || ' | ' ||
  pg_temp.arm3_probe('cross_org_actor', 'own_commission', 'role_keyed')  || ' | ' ||
  pg_temp.arm3_probe('cross_org_actor', 'own_commission', 'grant_keyed'),
  'none: participation=0 arm1=false arm2a=false arm2b=false door=false | '
  'unreachable: participation=1 arm1=false arm2a=false arm2b=false door=false | '
  'role_keyed: participation=1 arm1=false arm2a=false arm2b=false door=true | '
  'grant_keyed: participation=1 arm1=false arm2a=false arm2b=false door=true',
  '7.3b ⭐⭐ THE FOUR REACHES, MEASURED — and the two DENY lines are the load-bearing half. '
  '`none` denies through an EMPTY JOIN (participation=0): that is the state this fixture was in '
  'until increment 3, and an arm-3 deny produced by an absent row is a keystone that could not '
  'fail (docs/learning/LESSONS.md). `unreachable` denies with participation=1 — the join is '
  'non-empty and `_case_caps` withheld the capabilities — which is the SAME answer for a '
  'completely different reason, and the only reason the deny polarity here is worth anything. '
  '⭐ `unreachable` AND `grant_keyed` ARE ONE `case_access_grants` ROW APART AND NOTHING ELSE: '
  'same case, same participant, same profile, same hat. So the true on the fourth line is '
  'ATTRIBUTABLE to the grant, not merely coincident with it — a differential, not an observation. '
  '`role_keyed` reaches the same true through `_case_caps` S1 instead, on a case in the commission '
  'this caller coordinates, and its participant is in ORG B carrying an ORG A profile — the edge '
  'no trigger binds (trg_assert_participant_same_org_as_case binds participant to CASE only), '
  'which is ADR 0175 D3''s "grants with NO org term at all" measured rather than asserted. '
  '⛔ If a line moves, do not adjust the string: participation=0 on a reach that should build one '
  'means set_case_reach stopped constructing, and door=false at grant_keyed means the reach '
  'stopped working — either way §§4.1b/5.1 are then reporting on a coordinate that no longer '
  'exists, and they would still be GREEN.');

-- ⭐⭐ § 7.4 WAS DELETED AT ARM3-HAT-TERM-FIX, BY THE ROUTE ITS OWN MESSAGE NAMED.
-- It pinned BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE head-on —
-- "10 cells, legacy granted on 10, … approved answer denies on 10" — and instructed: "Move it by
-- deleting this section and dropping the carve-out from § 4.1/§ 4.1b — never by editing 'granted
-- on 10' to 'granted on 0'." ADR 0209 (migration 20261003007400) fixed the door, the carve-out is
-- gone from both sections, and those cells are now compared BY VALUE under
-- `arm3:pre-empted:door-hat-term`. ⛔ THE GRAIN IT HELD IS NOT LOST: § 7.4b below replaces it with
-- a LIVE head-on pin of the term that fixed it — which is a stronger assertion, because § 7.4
-- could only ever restate what the vector already said about ten cells, while this measures the
-- door at three coordinates the vector cannot carry all of.

-- ⭐⭐ THE HAT-PARAMETERISED PROBE. ⛔ A SEPARATE FUNCTION, NOT A DEFAULT PARAMETER ON
-- pg_temp.arm3_probe, and that is deliberate: § 7.3b's and § 7.5's calls stay BYTE-IDENTICAL, so
-- neither guard can be said to have moved with the fix it was written to constrain. A default
-- argument would have re-pointed both at a new body while their call sites read unchanged.
--
-- ⛔ THE HAT IS SET WITHOUT test_helpers.claims_for WHEN IT IS ABSENT, AND THIS IS THE WHOLE
-- REASON THE THIRD LINE MEANS ANYTHING. `claims_for(uid, false, null)` DERIVES the hat for a
-- principal holding exactly one live role type — which every holder persona here is — so a
-- "hatless" line written through it would silently seat `staff_admin`, measure the MATCHING hat
-- and read door=true. That is the fixture-cannot-reach-the-failing-state shape
-- (docs/learning/LESSONS.md), and it would have inverted the pin's verdict rather than weakened
-- it. The claims object below is byte-for-byte claims_for's, minus the `active_role` key.
-- ⚠ WHAT THE ABSENT-HAT LINE IS AND IS NOT: it pins the DOOR'S PREDICATE at an absent hat
-- (ADR 0209 D4). It is NOT a claim that the token hook can issue that state to THIS principal —
-- it cannot, for exactly the reason above, which is why the generator excludes the coordinate
-- (`absent_unreachable_for_single_role_principal`) and why no cell carries it. The hook DOES
-- issue it to a principal holding ZERO or 2+ role types, and D4 is the ruling for those.
create or replace function pg_temp.arm3_probe_at_hat(p_persona text, p_scope text, p_reach text,
                                                     p_hat text)
returns text language plpgsql volatile as $p$
declare
  f record; v_principal uuid; v_prof uuid; v_org uuid;
begin
  perform test_helpers.reset_role_and_claims();
  select * into f from f403;
  -- ⛔⛔ ACCOUNT STATE RESET, AND WITHOUT IT LINE 2 OF § 7.4b IS A DEAD HALF. Unlike § 7.3b/§ 7.5,
  -- which probe holder personas, this pin also probes `unprivileged` = f.nobody — and the LAST
  -- cell of the sweep is `unprivileged | … | deactivated | third_party | none` (read off the tail
  -- of the generated vector), so §§ 3/6 leave f.nobody DEACTIVATED. `_case_caps` STEP 2 would then
  -- shut arm 3 and the GRANT half would read door=false for a reason that has nothing to do with
  -- the hat: a keystone satisfied by a deactivation, which is the § 6.0/F1 shape one section over.
  -- This is exactly what pg_temp.cell_answers does per cell, and for the same reason — it must be
  -- ALL FOUR principals, not just this call's, or the answer depends on which cell ran last.
  update public.profiles set is_active = true, suspended_until = null, email_confirmed_at = now()
   where id in (f.uid, f.sib_holder, f.xorg_holder, f.nobody);
  v_principal := case p_persona
      when 'subject_holder' then f.uid
      when 'other_commission_holder' then f.sib_holder
      when 'cross_org_actor' then f.xorg_holder
      else f.nobody end;
  v_prof := case p_scope when 'foreign_org_commission' then f.xorg_prof else f.own_prof end;
  select organization_id into v_org from public.professional_profiles where id = v_prof;
  perform pg_temp.set_case_reach(p_persona, p_scope, p_reach);
  if p_hat is null then
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', v_principal, 'role', 'authenticated', 'is_admin', false)::text,
      true);
  else
    perform test_helpers.claims_for(v_principal, false, p_hat);
  end if;
  return coalesce(p_hat, '(no hat)')
    || ': arm1=' || coalesce(app.is_admin_for(v_principal), false)::text
    || ' arm2a=' || app.can_manage_professional(v_org, v_principal)::text
    || ' arm2b=' || authz.has_permission(v_principal, 'organization', v_org,
                                         'org.professionals.read')::text
    || ' door=' || app.can_read_professional_profile(v_prof, v_principal)::text;
end $p$;

select is(
  pg_temp.arm3_probe_at_hat('subject_holder', 'own_commission', 'grant_keyed', 'quality_reviewer')
    || ' | ' ||
  pg_temp.arm3_probe_at_hat('unprivileged',   'own_commission', 'grant_keyed', 'quality_reviewer')
    || ' | ' ||
  pg_temp.arm3_probe_at_hat('subject_holder', 'own_commission', 'grant_keyed', NULL),
  'quality_reviewer: arm1=false arm2a=false arm2b=false door=false | '
  'quality_reviewer: arm1=false arm2a=false arm2b=false door=true | '
  '(no hat): arm1=false arm2a=false arm2b=false door=false',
  '7.4b ⭐⭐ THE DOOR-LEVEL ACT HAT TERM, PINNED HEAD-ON IN BOTH POLARITIES (ADR 0209). This is '
  '§ 7.4''s successor: the same coordinate, measured on the LIVE door instead of restated from the '
  'vector. All three lines are the SAME reach — one `case_access_grants` row, arms 1/2a/2b false '
  'in the string rather than assumed — so the door''s answer IS the term''s answer. '
  '⭐ LINE 1 IS THE FIX: a principal who HOLDS staff_admin, asking about THEMSELVES while wearing '
  '`quality_reviewer`, is DENIED. Before ADR 0209 this line read door=true, and that was '
  'BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE: `_case_caps` S3/S4 '
  'carry no role lookup at all, so a case grant stood in for the hat and the rule "you cannot read '
  'your own profile while acting as another role" was rendered INOPERATIVE for anyone holding one. '
  '⭐⭐ LINE 2 IS WHY THIS PIN CANNOT PASS BY OVER-DENYING, and it is the half a red-to-green fix '
  'would otherwise be free to break. SAME hat, SAME reach, SAME scope — only the caller changes, '
  'to a principal who holds NO role at all — and the door still GRANTS. PO ruling R2: an explicit '
  'case grant needs no role and is approved designed reach, so a hat check keyed on the HAT ALONE '
  '(mutant C/C′) turns this line false and reds § 4.1b''s 36 class-3 cells with it. A pin carrying '
  'only line 1 is satisfied by a door that denies everybody. '
  '⭐ LINE 3 IS THE ONLY PIN ON THE HATLESS-HOLDER VALUE (D4) — a coordinate the vector CANNOT '
  'carry, because the token hook mints a hat implicitly for a single-role-type principal, so the '
  'generator skips it by a named rule and no cell exists at it. Read the probe''s comment for why '
  'it is constructed with set_config rather than claims_for: through claims_for this line would '
  'have measured the MATCHING hat and read TRUE. '
  '⛔ IF A LINE MOVES, DO NOT ADJUST THE STRING. door=true on line 1 means the door-level term was '
  'removed or stopped firing on a self-check; door=false on line 2 means the fix grew a role or '
  'hat condition R2 forbids; door=true on line 3 means the NULL-safety went (`=` instead of `is '
  'not distinct from`, the BUG-ACT-NULLHAT-1 shape). Each is a finding about the door.');

select is(
  pg_temp.arm3_probe('cross_org_actor', 'own_commission',         'grant_keyed') || ' | ' ||
  pg_temp.arm3_probe('subject_holder',  'foreign_org_commission', 'grant_keyed'),
  'grant_keyed: participation=1 arm1=false arm2a=false arm2b=false door=true | '
  'grant_keyed: participation=1 arm1=false arm2a=false arm2b=false door=true',
  '7.5 ⭐⭐ THE CLASS-4 GUARD — IT EXISTS TO CONSTRAIN THE FIX FOR § 7.4''s BUG, AND THE PO RULED '
  'IT MANDATORY. Classes 4 and 5 overlap conceptually, so "a fix that adds a hat check inside '
  'arm 3 MUST NOT accidentally add an ORG check" — narrowing by org "would silently break '
  'cross-org case collaboration that the referral module exists for". A fix verified only by '
  '§ 7.4 going red-to-green would revoke that approved reach and NO arm in ANY suite would say '
  'so. This is that arm. '
  '⭐ BOTH DIRECTIONS OF THE CROSS-ORG EDGE, because a one-sided guard is half a guard: line 1 is '
  'an ORG-B caller reading an ORG-A profile on an ORG-A case; line 2 is an ORG-A caller reading '
  'an ORG-B profile on an ORG-B case. In each the caller''s organization is the ODD ONE OUT, '
  'which is precisely R2''s point — the grant anchors on the CASE. '
  '⭐ THE HAT IS THE *MATCHING* ONE (arm3_probe sets active_role = staff_admin, the role each '
  'persona actually holds), deliberately: a correct class-5 fix adds a hat check, and a hat check '
  'leaves a matching hat alone. So this assertion SURVIVES the intended fix and REDS on the '
  'accidental org check — which is the only way it could be a guard rather than a second copy of '
  '§ 7.4. ⚠ Line 1 repeats § 7.3b''s last measurement ON PURPOSE: § 7.3b proves the reach '
  'MECHANISM and may one day be re-cut, and the guard must not leave with it.');

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

-- ⛔ THE PARTICIPATION FIXTURE, TORN DOWN BY IDENTITY AND LAST. Every one of these rows is
-- fixture-minted with a fixed `…-4403-…` id, so unlike the profiles above they CAN be deleted and
-- are — the suite should leave a hypothetical out-of-transaction run with no live
-- professional_participants row for its subject profiles, which is the state § 7.3's predecessor
-- asserted and the state ~900 other tests were written against.
-- ⚠ ORDER IS LOAD-BEARING, TWICE OVER. It runs AFTER § 7 (every assertion up to § 7.5 needs the
-- reach constructible; §§ 6.0-6.3 re-sweep every cell and each sweep rebuilds participation), and
-- child-before-parent within itself. ⛔ Moving it above § 6 would make BOTH fail-proofs there fire
-- for the teardown instead of their own mutations — the F1 shape the memberships cleanup was
-- moved down here to escape.
delete from public.case_access_grants where case_id in
  (select case_own from f403 union all select case_sib from f403 union all select case_xorg from f403);
delete from public.case_participants where participant_id in
  (select part_own from f403 union all select part_xorg from f403);
delete from public.professional_participants where participant_id in
  (select part_own from f403 union all select part_xorg from f403);
delete from public.participants where id in
  (select part_own from f403 union all select part_xorg from f403);
delete from public.cases where id in
  (select case_own from f403 union all select case_sib from f403 union all select case_xorg from f403);
delete from public.case_participant_roles where id in
  (select role_own from f403 union all select role_xorg from f403);


select * from finish();
rollback;
