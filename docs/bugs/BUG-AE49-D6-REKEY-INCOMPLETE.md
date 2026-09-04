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

Deleting the single `staff_admin -> commission.forms.edit` row from `authz.role_permissions`
stops that principal writing through EVERY policy site the PO-approved matrix names for the
code - ADR 0176 D6's gate line, *"the grant-deletion mutation flips the PRODUCTION DOOR, not
the resolver"*, applied to representative 1 end to end.

## Actual behavior

`form_item_options_staff_admin_write` and `form_item_validations_staff_admin_write` (both `ALL`)
still read `app.is_staff_admin_of(app.commission_of_version(form_version_id)) OR
app.is_tenancy_admin_of(…)`, while the manifest declares 4 sites, `status: "re-keyed"`,
`callGraphBoundary: null`. ⛔ **NOT an exposure — nothing widened.** It is a **conformance** defect,
and it makes the D6 gate line *"the three representatives, each end-to-end"* **4/7 true for
representative 1**. ⚠ `form_block_library` carries **no** `_staff_admin_write` policy at all, though
the matrix says "7 ALL".

## Reproduction

On a fresh `supabase db reset --local` at head `20261003007330`, in a rolled-back transaction:

1. `delete from authz.role_permissions where role_code='staff_admin' and permission_code='commission.forms.edit';`
2. As `chefe.ccih@test.local` under `set local role authenticated`, insert a `form_item_options`
   row into a DRAFT version of a CCIH form.

Before the fix the insert SUCCEEDED. The same principal's insert into `forms` / `form_versions` /
`form_sections` / `form_items` was refused with `42501`. Now assertions 409 §2.10a/§2.10b; both
were observed RED on the pre-fix catalog and GREEN after.

## Impact

⛔ **Conformance, not exposure - nothing widened.** `app.is_staff_admin_of` is at least as tight
as it ever was, so no principal gained reach at any point. What was false is the D6 gate line:
it read **4 of 6** for representative 1, and the gate record said *"the production door"*.
⚠ The seventh name in matrix row 1 (`form_block_library`) was never a policy site at all, so the
denominator in the review's "4 of 7" is itself the F-REC-4 matrix error, not a missing policy.

## Investigation

⛔ **Why no gate saw it:** `410`'s set differences run on the **permission**
axis; `enforcementSites` completeness is checked in **neither direction**, so the **site axis has no
closure check** at all. ⛔ **The fix is a MIGRATION** — it lands in the E2E-invalidating set and is
why a final `e2e:prod` is now certain → [review](../reviews/authz-ae4-gate-review.md).

## Root cause

Two causes, and only the second is the one worth fixing:

1. **The instance** - `20261003007300` re-pointed four of the six `*_staff_admin_write` policies
   onto `app.can_edit_commission_forms` and its self-verification block asserted `= 4` over a
   hand-written tablename list that did not name the other two. So did 409 §2.1. A count over a
   hand-written domain cannot see outside its own domain: both assertions were TRUE.
2. **The gate hole (the real cause)** - pgTAP `410`'s set differences run on the PERMI§ION axis
   only. `enforcementSites` completeness was checked in NEITHER direction, so a
   declared-but-unre-keyed site could not red and an undeclared enforcing site was invisible.
   §3.5 compares a site against the manifest's OWN `composedWith` - both sides are the manifest.
   ADR 0176 D5's claim that generation *"fails on set difference in either direction"* was, on
   the site axis, **false in the decision record**. Entry:
   `FUP-AE4-MANIFEST-HAS-NO-SITE-AXIS-CLOSURE`.

## Fix

`supabase/migrations/20261003007340_ae49_d6_rekey_remaining_forms_edit_sites.sql` - `alter policy`
on both halves of `form_item_options_staff_admin_write` and
`form_item_validations_staff_admin_write`, onto
`app.can_edit_commission_forms(app.commission_of_version(form_version_id), (select auth.uid()))`,
site-for-site identical to the four `20261003007300` landed. No function is created or replaced;
the names survive, so no name-keyed verdict is orphaned.

**The substitution was proved semantics-preserving before it shipped**, not inherited from the
sibling sites (migration header, § THE EQUIVALENCE ARGUMENT): the tenancy arm is identical *by
catalog definition* (`is_tenancy_admin_of(x)` IS `is_tenancy_admin_of_for(x,(select auth.uid()))`),
and the staff_admin arm is equal term-by-term - same role (only `staff_admin` is authoritative),
same scope reach (`scope_reaches` has no ascent arm at `commission` resolution), same hat clause
(carried verbatim in both `holds_role` and `entailed_grants`) - conditional on the one entitlement
row, which is exactly what D6 makes load-bearing. Measured over **6 204** cells (94 principals x
11 active_role values x 6 commissions, plus the no-JWT case) with **0 disagreements** and a
non-empty positive population on BOTH arms; the harness was then proven able to disagree by
deleting the grant, which produced exactly the 5 staff_admin-arm-only cells and no others.

## Regression protection

⛔ **Fixing the instance closes nothing structural** - the follow-up says so explicitly. The
protection is the axis, added in the same commit:

* **pgTAP `410` § 8 - SITE-AXIS CLOSURE, both directions.** 8.1 DECLARED => ENFORCING (every site
  a `re-keyed` row names reaches its permission code in the live catalog, transitively to one
  hop); 8.4 ENFORCING => DECLARED over the catalog's policies; 8.5 classifies every literal
  carrier by name; 8.2/8.3 are the discrimination pair and 8.6 the cardinality triple.
* **Proven non-vacuous in both directions and both orders.** Pre-fix, with the two sites declared,
  8.1 RED naming both; post-fix GREEN. Post-fix with the two sites removed from the manifest, 8.4
  RED naming both while 8.1 read `(none)` - so 8.1 cannot be satisfied by deletion. 8.1's
  independence from the pre-existing §3.5 was measured separately: with `composedWith` set to the
  legacy pair, §3.5 went GREEN and 8.1 stayed RED.
* **pgTAP `409` § 2** now covers both sites behaviourally where they are reachable (2.6b/2.6c/
  2.10a/2.10b/2.10d) and asserts the grant posture on both polarities where they are not
  (2.6d/2.6e). § 2.10c pins `public.set_item_validations` as still layer-1, so §2's green cannot
  be read as "the whole write path is permission-keyed".
* `274` C3 follows the authority down the hop rather than being relaxed, and was mutation-proven
  to red on BOTH halves (revert the policy -> false; delete the authorizer's permission arm -> false).
* Diff-scoped door sweep, both arms, exit 0 / CLEAN. `form_item_options_staff_admin_write` moved
  **BLIND -> COVERED** and was deleted from `supabase/tests/mutation/authz-blind-allowlist.txt` in
  the same commit, per that file's own contract (ADR 0079 Amdt 8 ruling 3: an ALTER invalidates a
  name-keyed verdict).

## Related code

* `supabase/migrations/20261003007340_ae49_d6_rekey_remaining_forms_edit_sites.sql`
* `supabase/tests/410_ae49_d5_enforcement_manifest.sql` § 8 (+ §1.4, §3.6, §9)
* `supabase/tests/409_ae49_d6_rekey_differential.sql` § 2, § 5.1
* `supabase/tests/274_ff3_validations.sql` C3/C4
* `supabase/tests/vectors/authz-enforcement-manifest.json` (`commission.forms.edit`)
* `supabase/tests/mutation/authz-blind-allowlist.txt`,
  `docs/reviews/authz-{door,writepath}-audit-findings.md`

## Lesson

**A count of what REMAINS cannot see what SHOULD have gone.** Every assertion guarding the re-key
was a count or a set difference over a HAND-WRITTEN domain - 409 §2.1's tablename list,
`20261003007300`'s `= 4`, §5.1's `59`, and the manifest's own `enforcementSites`. All four were
TRUE on a catalog where a third of the sites had not moved. The closure has to be computed
against the CATALOG, in both directions; a check whose two sides are both the record can only
prove the record is self-consistent. ⚠ Second, smaller: writing the behavioural probe FIRST is
what found that `form_item_validations` grants `authenticated` SELECT only - the `throws_ok(...,
'42501')` twin PA§ED while measuring a missing INSERT grant that never moved.

## Resolution

Fixed 2026-09-03 by `20261003007340` + pgTAP `410` § 8. Full pgTAP suite green (262 files, 8 760
tests); `npm run lint` (13 gates) and `npm run typecheck` exit 0; `ARM=census`/`hat`/`floor` and
`FROMFINDINGS=1 ARM=wrapper` all INVARIANT HOLDS; diff-scoped door sweep both arms CLEAN.
⛔ **Status flip and the follow-up's archive move are the lead's Record step, not this file's.**
Three items are reported to the PO and NOT actioned here: matrix row 1's `(7 ALL)` (F-REC-4),
the 0-of-8 DEFINER form doors, and `app.current_professional_read_organizations` showing as the
one `[UNDECLARED]` literal carrier in 410 § 8.5.
