# FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL — `hardDenyClasses` is empty on all 43 rows and the lint arm that checks it iterates zero times

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

`hardDenyClasses` is `[]` on **43 of 43** manifest rows. Lint arm M7 iterates the list, so on an empty list
it runs zero iterations and **cannot fail**. In pgTAP `410` §6.2 the same emptiness excludes 40 rows by way
of their having zero sites, §6.2 carries **no discrimination control**, and it is **already blind to live
instances**: the vocabulary class `principal_inactive` is enforced below §6.2's search depth on every one of
the three rows that carry the measured label.

**How it was measured.** Manifest read directly; M7's loop body and §6.2's search depth read from source;
the gate positions re-derived from the live catalog by transitive closure over `pg_proc.prosrc`.

## 2026-09-03 — remediation (a) LANDED. The bound is now disclosed, not closed.

Review F-MAJOR-1 offered (a) narrow the caption and label to what is measured, or (b) make the measurement
transitive. **The PO took (a).** What changed:

- The vocabulary value `measured-at-declared-sites` was **renamed to
  `measured-depth1-at-sites-and-authorizer`** — the depth is now in the name, so the label cannot be read as
  a closure. Validators updated in the same change: `catalogSnapshot.hardDenyProvenanceValues` (the M6 arm
  reads the vocabulary as data, so it needed no code edit), the `410` §6.2/§6.3 predicates, and the
  regenerated fixture `authz_enforcement_manifest.psql` + `authz-matrix-coverage.json`.
- `410` §6.2's caption now reads *"no hard-deny gate is invoked **directly** at the declared sites or in the
  authorizer body — depth 1, stated as depth 1"*, and states the enforcement it cannot see. §6.3's caption
  now says out loud that it is a cardinality control and **not** the discrimination control.

⛔ **The class IS enforced. §6.2 cannot see it. That is a known bound, not an absence.** Re-derived on the
live catalog 2026-09-03 with comments stripped, depth 1 = the bodies §6.2 searches (enumerated sites +
domain authorizer):

| row | permission arm | preserved / legacy arm |
| --- | --- | --- |
| `commission.forms.edit` | depth 4 — `has_permission` → `entailed_grants` → `assignment_facts` | **depth 2** — `app.is_tenancy_admin_of_for` |
| `org.professionals.create` | depth 4 — same chain | depth 3 — `can_manage_professional` → `is_org_admin_of` |
| `org.professionals.read` | depth 4 — same chain | depth 3 — `can_manage_professional` → `is_org_admin_of` |

`org.professionals.read` additionally reaches `respondent_exclusion` (`app.is_case_respondent`) at **depth 5**
via `can_read_case_committee` — an instance the review did not name.

⚠ **Correction to this file's own earlier text and to review F-MAJOR-1's paraphrase.** Both said the class
sits *"one hop below"* the search depth, and the AE4 hub recorded *"depth 2 on BOTH arms"*. That is true for
**one arm of one row**. The permission arm is at depth 4 on all three rows. ⛔ **Consequence for (b): raising
the search by one hop is a partial fix that reads as a complete one** — it would catch
`is_tenancy_admin_of_for` and leave five paths unmeasured. The comment-stripping matters too: a raw `prosrc`
match reports `app.is_org_commission_staff_admin` as a live arm of `can_create_professional`, where the
catalog shows it only in a **comment**.

**What would close it (b — still the right end state, unchanged by (a)).** Make §6.2's measurement transitive
over the composed-call closure — depth-bounded and comment-stripped, not one hop — **and** add a positive
control that plants a body containing a vocabulary gate and requires §6.2 to **name** it. ⛔ **Both halves
must land with the M7 fix in the same change**: replace M7's loop with an assertion that can fail on the
empty case, or populate `hardDenyClasses` from the catalog so it has something to iterate. A transitive §6.2
shipped alone only moves the vacuity one level up — the manifest would then carry non-empty lists that no arm
can prove wrong.

⛔ **What must NOT be mistaken for closing it.** Populating the field without proving the arm can red
reproduces the defect one level up. **(a) is a disclosure, not a closure** — this follow-up stays OPEN.
⛔ And note the two figures are not in conflict: the field is empty on
all 43 rows, while 40 rows are additionally labelled `not-attributable-until-rekey` — the label is not a value.
