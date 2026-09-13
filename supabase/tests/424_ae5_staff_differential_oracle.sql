-- 424 — AE5 increment 1: the `staff` differential oracle.
--
-- ⛔⛔ SKELETON ONLY — NO ASSERTIONS YET. This file is the section shape T11 will fill in once
-- backend's T3 (`scripts/gen-authz-differential-cells.py` MULTI-ROLE, `REPS_BY_ROLE['staff']`, the
-- `role` axis in `CELL_AXIS_COL`) lands and regenerates `vectors/authz_differential_cells.psql` with
-- `staff` cells in it. Until then `\ir vectors/authz_differential_cells.psql` would find no `staff`
-- rows to drive, so it is not included below — the file ends in a single placeholder `pass()` so
-- `supabase test db` stays green while this sits in the tree. ⛔ Nobody may fill in an assertion here
-- before (a) T3 lands the vectors, (b) T4 seeds `staff` grants + the fixture rows
-- `docs/testing/ae5-staff-fixture-gaps.md` lists, and (c) the PO confirms the per-class values § "PO
-- INPUT OWED" below proposes.
--
-- Subjects: authz.candidate_has_permission (⛔ NEVER authz.has_permission — the runtime evaluator
-- sees only `authoritative` roles, and `staff` sits in `test_validation` throughout this suite's
-- lifetime, exactly as `403` explains for `staff_admin`'s own pre-cutover window) vs the legacy
-- evaluators (`app.is_member_of(_for)` → `app.has_role_any('commission', …)`), over the PO-approved
-- `staff` matrix (`docs/design/authz-ae5-staff-permission-matrix.md`, 20 held rows) and the
-- PO-approved `staff` deny-class effect table (`docs/design/authz-ae5-staff-deny-class-effects.md`,
-- 9 rows). Mirrors `403_ae45_differential_oracle.sql`'s shape one-for-one; only the subject role,
-- the REPS population and the arm-3 mechanism differ.
--
-- ⛔ TWO ASSERTIONS PER CELL, AND THE SECOND IS THE POINT (unchanged from `403`).
--   §4  is(legacy, catalog)          — the resolver reproduces today's behaviour;
--   §5  is(catalog, approved-value)  — the MATRIX is the oracle, not "whatever legacy did".
-- With only the first, the cheapest green is to approve a legacy defect into the oracle — the exact
-- PA-F8 trap the matrix's own header names.
--
-- ⛔ THE EXPECTED VALUES ARE NOT COMPUTED THE WAY THE RESOLVER COMPUTES THEM. They are transcribed
-- from two hand-encoded sources (the `staff` matrix row; the `staff` deny-class table) into the
-- generated vector file — never read from `authz.role_permissions`, or the suite proves the resolver
-- equals a copy of itself.
--
-- ⚠ `case_reach` axis (`none · role_keyed · grant_keyed · unreachable`) IS SWEPT, because the vector
-- carries it as a global column for every representative regardless of role — but it is INERT for
-- every `staff` cell: `staff` holds no code whose enforcement predicate consults
-- `app.can_read_professional_profile`'s case-committee arm (matrix § 5.2, § 7.1), so `staff`'s
-- representative is skipped by the generator's own `CONDITIONAL_EXCLUSIONS[('caseReach',
-- 'inert_outside_the_arm3_gate')]` rule. `unreachable` STAYS MANDATORY IN THE VECTOR SHAPE even
-- though it never distinguishes a `staff` cell — dropping it to save cells here would silently
-- change what the column means for every OTHER role sharing the same generator (the ⭐⭐ MANDATORY
-- warning in `authz-matrix-axes.json`'s own `caseReach.values.unreachable` text). ⛔ Do not conflate
-- this axis with the eleven `staff`-specific arm-3 coordinates below — different mechanism, different
-- predicate family (§ 5.3's criterion vs `can_read_professional_profile`'s arm 3).
--
-- ⛔ `arm3_divergence` LABEL + THE 14th `expected_legacy_granted` COLUMN (AE5-MATRIX-ARM3-CELLS,
-- plan `:1224-1227`). Approved legacy-door divergence goes in `expected_legacy_granted` ONLY, never
-- in `expected_granted` (which is compared against `authz.candidate_has_permission` and is RIGHT to
-- deny where a legacy arm grants for a reason the catalog has no mechanism for). For `staff` the one
-- candidate is PA-F8-STAFF-1 (§ 8.1 of the matrix: a revoked member keeps/edits/submits their draft)
-- — but its disposition is CONDITIONAL on § 11 item 7's ruling (rename to `commission.responses.create`
-- vs keep `.fill` over the lifecycle): under (A) there is no row for it to diverge FROM and the label
-- is never emitted for row 2; under (B) it lands here as `expected_legacy_granted=true`,
-- `expected_granted=false`, labelled `arm3_divergence='PA-F8-STAFF-1'`. ⛔ This file cannot pick
-- between them — that is § 11 item 7, still a PO ruling as of this skeleton.
--
-- ⚠ THE ABLE-TO-FAIL PROOF (mirrors `403` § 6; not yet written, described here so the section exists
-- when T3 lands). Two constructed mutations, each restored inside the same rolled-back transaction:
--   (i) flip ONE seeded `authz.role_permissions` row for `staff` (candidate: delete the
--       `('staff','commission.forms.read')` grant) and show §4/§5's relevant cell FAILS, then restore
--       and show it passes again — proves the suite can see a missing grant;
--   (ii) flip the SAME row's counterpart on `staff_admin` (which already holds
--       `commission.forms.read` under a DIFFERENT gate, `app.is_staff_admin_of`) to confirm the
--       failure is attributable to the `staff` row alone and not a masked sibling arm — the AE4.7c
--       "REPS comment" lesson, restated for two roles instead of one.
--
-- ⚠ PER-CLASS EXPECTED VALUES FOR THE ELEVEN ARM-3 COORDINATES — ⛔ PROPOSED, NOT PO-APPROVED. The
-- PO has approved only the COORDINATE SET (matrix § 11 item 5: rows 1, 4, 6, 7, 8, 9, 11, 12, 15, 16,
-- 19; rows 4 and 11 carry both limbs) — never a value per class. The table below is this suite's
-- proposal, derived from the plain legacy reading of each predicate (matrix § 5.3), to be confirmed
-- or corrected at T11's plan review. ⛔ `expected_legacy_granted` for these rows is `expected_granted`
-- UNLESS the PO names a divergence — none is proposed here; these are ordinary catalog=legacy cells.
--
--   row  term                                                    class value        -> proposed
--   ---  ------------------------------------------------------- ----------------- ---------------
--   1(b) can_access_targeted_version participation disjunct      no participation    GRANTED (bare membership)
--                                                                 participation present GRANTED (disjunct; limb-b only adds)
--   4(a) co-member leg (target's own memberships)                target shares a commission GRANTED
--                                                                 target shares none  DENIED (falls to self-leg only)
--   4(b) self-read disjunct                                      self                GRANTED (role-free)
--                                                                 third-party, no share DENIED
--   6    visibility_policy / attendee EXISTS                     commission_default  GRANTED
--                                                                 participants_only + attendee GRANTED
--                                                                 participants_only + non-attendee DENIED
--   7    + is_case_respondent hard deny (on a row-6 GRANT)        non-respondent      GRANTED
--                                                                 respondent          DENIED
--   8    attendance='present' AND status='in_signature'          present + in_signature GRANTED
--                                                                 present + other status DENIED
--                                                                 absent  + in_signature DENIED
--   9    v_eg (visibility_policy='explicit_grants_only')         commission_default  GRANTED
--                                                                 explicit_grants_only, no grant DENIED
--   11(a) visibility_scope                                       committee           GRANTED
--                                                                 case_restricted     DENIED
--                                                                 assignees_only, not assigned DENIED
--   11(b) assigned_to = auth.uid() disjunct                      assigned            GRANTED (role-free)
--                                                                 not assigned        DENIED
--   12   ethics-case status guard (HC0J0) precedes membership    votable status      GRANTED
--                                                                 non-votable status  DENIED (HC0J0, not a permission denial)
--   15   owner_commission_id IS NULL (public arm)                owner IS NULL       GRANTED (vacuous — every authenticated caller)
--                                                                 owner = own commission GRANTED (membership)
--                                                                 owner = a different commission DENIED
--   16   is_document_approver_of disjunct                        approver-of-record  GRANTED (role-free)
--                                                                 member, not approver GRANTED (membership)
--                                                                 neither             DENIED
--   19   cp.source='indicator' provenance                        source=indicator    GRANTED (member of the indicator's commission)
--                                                                 source=event        N/A to this row (row 17's arm, not row 19's)
--
-- ⚠ `409`-SHAPE DOORS T12 WILL FLIP ONCE T7 LANDS (the grant-present-vs-DELETED differential, both
-- polarities, on WRITES — `425_ae5_staff_rekey_differential.sql`, not this file). Named here so T12's
-- author does not re-derive the write population: `responses.responses_insert_own` (row 2, R — the
-- ONLY site under § 11 item 7 option (A); if (B) is ruled instead, T12 additionally owns the five
-- residual-compatibility sites the matrix § 11 lists, none of them re-keyable) ·
-- `meetings.meeting_signatures_insert` + its DEFINER door `app.can_sign_meeting` (row 8, R+D, both
-- move together) · `public.cast_case_vote` (row 12, D) · `public.notify_safety_event` (row 18, D) ·
-- `public.create_referral_internal_note` (row 21, D, arm 1 only — arm 2's third-party site is a
-- class-E managed-row value, not this row's surface). ⛔ DEFINER NON-FLIPPER, NAMED AS A COUNTDOWN
-- (409 § 2.10c's pattern): `public.submit_response` — `prosecdef = f` (INVOKER), no membership gate of
-- any kind in its body, gated entirely by `responses_update_own_draft`'s ownership predicate. Deleting
-- a `staff` grant does NOT change this door's behaviour (matrix § 8.1's own transcript) — T12 must
-- name it as excluded from the flip, not silently omit it, or a reviewer will ask why it is missing.
--
-- RUN SHAPE: this skeleton carries exactly ONE test (the placeholder). ⛔ Keep this line in step with
-- plan() the moment real assertions land — a stale RUN SHAPE is read as the expected shape by the
-- next person diagnosing a count mismatch (403's own header names this trap; inherited verbatim).

begin;
select plan(1);

-- ============================================================================
-- §1 — the fixture. NOT YET WRITTEN.
-- Will mirror 403 §1's shape (fixture-owned, FIXED, non-seed-colliding ids; cleaned up by IDENTITY,
-- never positionally) PLUS the rows `docs/testing/ae5-staff-fixture-gaps.md` § 8 lists as owed to T4
-- (a `participants_only` meeting + attendees, an `in_signature` meeting + attendees, non-`committee`
-- action items, `accreditation_frameworks` rows, a `cross_org_actor` staff-only principal). ⛔ The
-- lifecycle-persona membership inserts (`pending`, `deactivated`) are T4's — this suite CONSUMES them,
-- it does not insert them, matching 403's own division (401/410 own the manifest and role state; 403
-- only reads).
-- ============================================================================

-- ============================================================================
-- §2 — the cell set, and its controls. NOT YET WRITTEN.
-- Will `\ir vectors/authz_differential_cells.psql` once T3 regenerates it with `staff` rows; asserts
-- the census (cell count is an OUTPUT of the generator, never a target written here) and the masking
-- controls the fixture-gap report flags (row 1(b)'s participation-link control; § 8.1's ownership
-- masking on row 2, N/A under option (A)).
-- ============================================================================

-- ============================================================================
-- §3 — the driver. NOT YET WRITTEN.
-- Materialises each cell's state and calls BOTH evaluators — `authz.candidate_has_permission` and the
-- legacy `app.is_member_of(_for)` chain — exactly as 403 §3 does for `staff_admin`.
-- ============================================================================

-- ============================================================================
-- §4 — is(legacy, catalog). NOT YET WRITTEN. See the header's two-assertions-per-cell contract.
-- ============================================================================

-- ============================================================================
-- §5 — is(catalog, approved matrix value). THE ORACLE HALF. NOT YET WRITTEN.
-- Reads `expected_granted`, never `expected_legacy_granted`, for the comparison against
-- `authz.candidate_has_permission`.
-- ============================================================================

-- ============================================================================
-- §6 — THE SUITE SHOWN ABLE TO FAIL. NOT YET WRITTEN. See the header's able-to-fail proof (i)/(ii).
-- ============================================================================

-- ============================================================================
-- §7 — arm-3 / case_reach bound. NOT YET WRITTEN.
-- Asserts the eleven-coordinate census matches the manifest's declared arm-3 set (mirrors 403 §7's
-- role for `staff_admin`'s single arm-3 coordinate, generalised to eleven) and that `case_reach`'s
-- `unreachable` value is present in the swept set even though it is inert for every `staff` cell.
-- ============================================================================

select pass(
  '424 SKELETON ONLY — no cell assertions yet. Awaiting (a) T3''s staff REPS_BY_ROLE + role column '
  'in vectors/authz_differential_cells.psql, (b) T4''s staff grants + the fixture rows named in '
  'docs/testing/ae5-staff-fixture-gaps.md, (c) the PO''s per-class values for the eleven arm-3 '
  'coordinates proposed in this file''s header. This placeholder keeps `supabase test db` green in '
  'the interim; it is not evidence of anything about `staff`.'
);

select * from finish();
rollback;
