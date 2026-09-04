# FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR — the rollback runbook's §6.2 counts four policies, and the re-key fix makes it six

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-03 · status open (PO-deferred)

`docs/deployment/authz-rollback-runbook.md` § 6.2 is the 03:00 revert procedure for
`commission.forms.edit`. Every figure in it was measured at migration head `20261003007300`, when the
permission was re-keyed at **four** policies. `BUG-AE49-D6-REKEY-INCOMPLETE` re-points two more
(`form_item_options_staff_admin_write`, `form_item_validations_staff_admin_write`), so the section
is scoped to four while reality is six.

**Why this is a hazard and not just a stale document.** § 6.2's verification query hard-codes
`tablename in ('forms','form_versions','form_sections','form_items')` and asserts `EXPECT 4 rows`.
Run unamended after the fix, it reverts four tables, reports a **clean four-row census**, and leaves
the two new tables enforcing the new authority alone. The section's own comment names exactly this
failure — *"three-of-four reads as a completed rollback and leaves the fourth table enforcing the new
authority alone"* — so the defect is that shape reproduced at a larger N, by a change made after the
comment was written.

⭐ **The class:** a change that alters a count invalidates every control that READS that count, and
those controls have to be enumerated, not recalled. The re-key's own reviewers caught the manifest
axis; the runbook's hard-coded table list is the same axis in a different file.

**Interim mitigation, already applied 2026-09-03.** § 6.2 carries a banner: do not run as written;
add both tables to the `tablename` list, expect six rows, revert both halves of each `FOR ALL`. That
makes the section safe to use without writing the deferred rewrite.

**Closes when:** § 6.2 is re-measured at the post-fix head and rewritten for six policies — pre/post
state, the `alter policy` count, the `tablename` list and the row-count assertion all at six, both
halves of each `FOR ALL` — and the interim banner is deleted rather than left beside the corrected
text.

⛔ **What must NOT be mistaken for closing it.** Editing the `EXPECT 4` to `EXPECT 6` without
re-measuring the pre-state. The pre-cutover text of the two added policies is **not** re-derivable
from a live sibling once their migration applies (§ 6.1's distinction), so it has to be recorded from
the pre-fix catalog or from `BUG-AE49-D6-REKEY-INCOMPLETE`'s record — the measured legacy text is
`app.is_staff_admin_of(app.commission_of_version(form_version_id)) OR
app.is_tenancy_admin_of(app.commission_of_version(form_version_id))`, identical in both halves.

**PO ruling 2026-09-03.** The Gate AE4 review filed the §6 worked example as owed *before* the gate;
the PO ruled the deferral stands and it is written **post-merge**. The ruling was taken on the
premise that §6 was merely unwritten; it was then measured as written-but-scoped-to-four, which is
why the interim banner was added rather than leaving the deferral to cover a live hazard.
