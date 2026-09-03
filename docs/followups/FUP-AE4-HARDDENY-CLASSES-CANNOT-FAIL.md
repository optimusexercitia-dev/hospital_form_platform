# FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL — `hardDenyClasses` is empty on all 43 rows and the lint arm that checks it iterates zero times

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

`hardDenyClasses` is `[]` on **43 of 43** manifest rows. Lint arm M7 iterates the list, so on an empty list
it runs zero iterations and **cannot fail**. In pgTAP `410` §6.2 the same emptiness excludes 40 rows by way
of their having zero sites, §6.2 carries **no discrimination control**, and it is **already blind to a live
instance**: `app.is_active` sits inside `is_tenancy_admin_of_for`, one hop below its search depth.

**How it was measured.** Manifest read directly; M7's loop body and §6.2's search depth read from source;
the `app.is_active` position confirmed against the live catalog.

**What would close it.** Either populate `hardDenyClasses` from the catalog so the arm has something to
iterate, or replace the loop with an assertion that can fail on the empty case — plus a discrimination
control for §6.2, anchored on a class known to be present, and its search depth raised past the one hop
that currently hides `app.is_active`.

⛔ **What must NOT be mistaken for closing it.** Populating the field without proving the arm can red
reproduces the defect one level up. ⛔ And note the two figures are not in conflict: the field is empty on
all 43 rows, while 40 rows are additionally labelled `not-attributable-until-rekey` — the label is not a value.
