# AE5-STAFF — matrix review, round 1 (external QA review + lead evaluation)

**Subject:** `docs/design/authz-ae5-staff-permission-matrix.md` at `a31ba31e` (T1, PROVISIONAL).
**Received:** 2026-09-13, provided by the PO in the lead session verbatim (§ 1). **Evaluated:**
2026-09-13 by the lead (§ 2), every cited line `sed -n`-read and the two policies read from the live
catalog before any finding was accepted (lead-playbook §4 item 12: a relayed finding is the lead's
the moment it is acted on). **Verdict:** the review is sound — six findings confirm exactly, one
confirms in its core and overreaches at the edge, one is right with its data home partly elsewhere.
**Disposition:** `CHANGES REQUESTED` — a backend fix round on all eight before the PO rules on § 11.

⚠ The review's links are absolute `/D:/…` paths as delivered; they are kept verbatim.

## 1. The review, verbatim

```
Blocker — the staff_admin compatibility consequence covers only 7 of 18 new codes.
The proposal establishes that every legacy is_member_of(_for) check accepts either commission-tier role ([matrix §0.1 (line 68)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:68)). Therefore, every new permission replacing such a check must preserve existing staff_admin access.
However, the approval request grants staff_admin only seven new read codes ([§9.3 (line 804)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:804), [§11 item 4 (line 860)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:860)). The remaining eleven include existing staff_admin behavior such as filling responses, signing minutes, voting, reading events/CAPAs/referrals, and authoring referral notes.
Before approval, all 18 new codes need a staff_admin disposition: either grant the code to staff_admin, or explicitly preserve an existing staff_admin permission as another authorizer arm. Otherwise T7 will silently under-grant the baseline role.

Blocker — the mandatory per-arm interface data is absent.
AC-1 requires every arm's subject and hat requirement and every row's definerSurface ([feature AC-1 (line 30)](/D:/Development/claude/hospital_form_platform/docs/features/ae5-staff.md:30)). ADR 0201 requires those facts for every paired arm ([ADR 0201 D3 (line 144)](/D:/Development/claude/hospital_form_platform/docs/decisions/0201-the-keying-asymmetry-is-the-model.md:144)), while ADR 0200 requires the DEFINER/policy split as per-row data rather than prose ([ADR 0200 (line 252)](/D:/Development/claude/hospital_form_platform/docs/decisions/0200-professional-identity-predicates-answer-about-their-subject.md:252)).
The matrix has only R/D/T prose and an occasional subject annotation ([matrix table (line 425)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:425)). It has no per-arm hat field and no per-row definerSurface, including explicit empty declarations. The global discussion in §6A cannot replace per-arm data, especially for rows mixing caller-keyed, subject-keyed, policy, and registry paths.

High — the arm-3 inventory contradicts the document's own derivation.
The proposal explicitly identifies accreditation_frameworks_select as arm-3-shaped because owner_commission_id IS NULL grants every authenticated caller ([§2 (line 170)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:170)). Yet row 15 is marked arm-3 = — ([row 15 (line 441)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:441)), and PO item 5 lists only five other coordinates ([§11 (line 863)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:863)).
Row 4's co-member profile join is likewise identified as resource-dependent ([§2 (line 180)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:180)) but has no coordinate. Rows 19 and 21 also depend on non-permission resource shape—indicator-sourced CAPA and referral source/target membership—without arm coordinates.
At minimum, the global-framework and co-member cases must be added. The entire arm census should then be rerun so empty joins or residual public arms cannot satisfy the oracle vacuously.

High — securable_resources_select is missing from row 16.
The policy census assigns three document policies to row 16, including securable_resources_select ([§2 (line 155)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:155), [§9.1 (line 763)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:763)). Row 16 names only the two controlled-document policies ([row 16 (line 442)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:442)).
I independently confirmed in the live catalog that public.securable_resources.securable_resources_select is:
app.is_member_of(commission_id)
OR app.is_tenancy_admin_of(commission_id)
It must be mapped explicitly to row 16 or to another approved code, including disposition of its tenancy-admin arm.

High — the function reconciliation is arithmetically and categorically invalid.
§3.2 says "15 functions," but its table names 24 distinct functions: 23 permission-shaped sites plus _audit_access_authorized as a registry ([§3.2 (line 227)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:227)). §9.1 then tries to reconcile 42 functions using 15 + 18 + 1 and an "8 function" residue, although the residue text itself does not match that number ([§9.1 (line 766)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:766)).
Based on the live 42-function population, the clean equation is:
23 permission-shaped
+ 1 registry
+ 18 managed-row
+ 1 allowlisted
- 1 overlap (create_referral_internal_note)
= 42
The enumeration may contain all names, but its advertised completeness proof currently does not hold.

High — commission.responses.fill has no coherent enforcement shape.
Row 2 names only the membership-gated INSERT policy plus a TS guard ([row 2 (line 428)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:428)). The proposal separately excludes the ownership-keyed read/edit/submit sites ([§5.1 (line 397)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:397)), while asserting that the catalog would deny edit and submission after membership revocation ([§8.1 (line 648)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:648)).
Those statements cannot all define one permission interface:
- If the permission governs only creation, rename it to something like commission.responses.create; later ownership behavior is not a divergence of that permission.
- If fill governs the full lifecycle, the update/submit doors must be declared as enforcement or residual-compatibility sites, including the direct database path—not merely the TS guard.

Minor — stale matrix heading.
[§5.2 (line 412)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:412) still says "21 proposed rows," while the table and header say 22.

Minor — broken ADR 0193 link.
The authority link at [line 7 (line 7)](/D:/Development/claude/hospital_form_platform/docs/design/authz-ae5-staff-permission-matrix.md:7) points to a nonexistent filename. The repository file is [0193-the-enforcement-manifest-declares-what-it-measured.md](D:/Development/claude/hospital_form_platform/docs/decisions/0193-the-enforcement-manifest-declares-what-it-measured.md).
```

## 2. Lead evaluation — what was measured, and the ruling per finding

| # | finding | verdict | measured |
| --- | --- | --- | --- |
| B1 | `staff_admin` consequence covers 7 of 18 | **CONFIRMED, blocker** | § 9.3 names rows 1, 4, 5, 13, 14, 15, 16 only; § 11 item 4 says "7 of the new codes". § 0.1 `:68` establishes every membership site accepts either commission-tier role ⇒ all 18 new codes are `staff_admin` behaviour at re-key. Item 4 asks the PO to rule on the wrong set. |
| B2 | per-arm subject · hat · `definerSurface` absent | **CONFIRMED against AC-1, blocker for AC-1 and T5** — with two qualifications | § 3.2 has a `subject` and a `prosecdef` column per function; § 6A argues the hat globally; no per-arm hat field, no per-row `definerSurface`. Qualification 1: ADR 0193 D5 / ADR 0200 place the *as data* home in the enforcement manifest (T5); the matrix is the source, so it owes a per-row table T5 copies verbatim. Qualification 2: the rows mixing caller-keyed, `p_uid`, policy and registry paths are exactly where a global statement hides a wrong arm, so the PO should not approve rows whose arms carry no declared hat — the differential's cells derive from those declarations. |
| H3 | arm-3 inventory contradicts § 2 | **CONFIRMED in core; the edge is the reviewer's inference** | `:177` names `accreditation_frameworks_select` arm-3-shaped (NULL-owner arm grants every authenticated caller); row 15 marks `—`; § 11 item 5 omits it. The public arm is the vacuous shape, so this matters most. Row 4's co-member leg is "shaped differently" at `:180` — add it. Rows 19 (`source = 'indicator'`) fits the plan's definition; row 21 (source-or-target membership) reads as § 8.5's two-scope shape, not arm 3. Remedy as asked: rerun the arm census against ONE written criterion and let it decide 19 and 21. |
| H4 | `securable_resources_select` missing from row 16 | **CONFIRMED** | § 2 `:155` counts it under row 16 (`documents ×2 + securable_resources ×1`); § 9.1 credits row 16 with 3; row 16 lists 2. Live catalog: `(app.is_member_of(commission_id) OR app.is_tenancy_admin_of(commission_id))`. The row-22 trap (a count that sums is not a mapping) recurred one row earlier. |
| H5 | function reconciliation invalid | **CONFIRMED at the heading; the reviewer's 23 not independently reproduced** | § 3.2 says "15 functions"; the table names many more (a regex over `:231-249` counts 22 distinct `app.`/`public.` names and cannot parse the `note(s)` shorthand — ⛔ name the set, do not size it). § 9.1's `15 + 18 + 1` with an "8" residue does not reproduce. `create_referral_internal_note` sits in BOTH § 3.2 and § 3.3 (the overlap the equation needs). Population plausible: an unanchored sweep over `app`/`public`/`authz` for `is_member_of` or `'staff'` returns **47** = the record's 42 + 3 `'staff'` literals + 2 other `has_role_any` callers. Completeness is likely; its proof is not. |
| H6 | `commission.responses.fill` has no coherent shape | **CONFIRMED — and a seventh PO ruling** | Row 2 = `responses_insert_own` + a TS guard; § 5.1 excludes every later lifecycle door as ownership-keyed; § 8.1 files the revoked-member submit as PA-F8-STAFF-1 *against that row*. Either the code governs creation only (then § 8.1 is a product finding on the ownership path — a bug/follow-up, not a PA-F8 divergence of the row) or it governs the lifecycle (then update/submit are enforcement or residual-compatibility sites, DB path included). |
| M7 | stale heading "21 proposed rows" | **CONFIRMED** | `:412` |
| M8 | broken ADR 0193 link | **CONFIRMED** | `:7` links `0193-definer-writers-and-the-policy-rekey.md`; the file is `0193-the-enforcement-manifest-declares-what-it-measured.md`. ⚠ No gate reaches it: gate 13's link/citation arms exclude `docs/design/` (`RETIRED_EXCLUDE_PATH_PREFIXES` lists `docs/design/temp/`; the design directory's links are not resolved at all). |

## 3. Routing

Backend fix round (r2 of the matrix): all eight, in the record's session log with the queries. The
§ 11 package grows to **seven** items — item 4 over all 18 codes; a new item on the `responses.fill`
interface. The PO rules on nothing in § 11 until r2 lands.
