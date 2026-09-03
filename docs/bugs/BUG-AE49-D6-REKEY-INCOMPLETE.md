---
id: BUG-AE49-D6-REKEY-INCOMPLETE
status: open
severity: critical
area: authz
opened: 2026-09-02
closed: ~
feature: AE49
related_adrs: []
---

## Symptom

_Verbatim from the Bug Log section of PROGRESS.md (retired 2026-09-03, ADR 0185), filed 2026-09-02:_

🔴 **BUG-AE49-D6-REKEY-INCOMPLETE — `commission.forms.edit` is re-keyed at 4 of the 7 policy sites
its PO-approved matrix names, and NOTHING REDS.** Filed 2026-09-02 (lead, from Gate AE4 QA
F-BLOCK-1) — **corroborated independently** by the rollback-runbook agent, which recorded the same
two policies as live twins of the **pre-cutover** text while solving an unrelated problem.

## Expected behavior

_Not yet recorded._

## Actual behavior

`form_item_options_staff_admin_write` and `form_item_validations_staff_admin_write` (both `ALL`)
still read `app.is_staff_admin_of(app.commission_of_version(form_version_id)) OR
app.is_tenancy_admin_of(…)`, while the manifest declares 4 sites, `status: "re-keyed"`,
`callGraphBoundary: null`. ⛔ **NOT an exposure — nothing widened.** It is a **conformance** defect,
and it makes the D6 gate line *"the three representatives, each end-to-end"* **4/7 true for
representative 1**. ⚠ `form_block_library` carries **no** `_staff_admin_write` policy at all, though
the matrix says "7 ALL".

## Reproduction

_Not yet recorded._

## Impact

_Not yet recorded._

## Investigation

⛔ **Why no gate saw it:** `410`'s set differences run on the **permission**
axis; `enforcementSites` completeness is checked in **neither direction**, so the **site axis has no
closure check** at all. ⛔ **The fix is a MIGRATION** — it lands in the E2E-invalidating set and is
why a final `e2e:prod` is now certain → [review](../reviews/authz-ae4-gate-review.md).

## Root cause

_Not yet recorded._

## Fix

_Not yet recorded._

## Regression protection

_Not yet recorded._

## Related code

_Not yet recorded._

## Lesson

_Not yet recorded._

## Resolution

_Not yet recorded._
