---
id: CAN-MANAGE-PROFESSIONAL-SELF-CHECK
title: "`app.can_manage_professional`'s self-check arm — a third-party predicate whose first arm answers about the caller, given its reachability analysis, the PO's ruling, and (if ruled) the migration that makes it answer about `p_uid` (pre-AE5 Batch 8)"
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 8 of the follow-up batches ruled 2026-09-04"
branch: authz-can-manage-professional-self-check
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/can-manage-professional-self-check.md
reviews: []
adrs: ["0079", "0155", "0190", "0191", "0192", "0193"]
handoff: ~
fup: ~
---

# CAN-MANAGE-PROFESSIONAL-SELF-CHECK — the predicate AE5's `org_admin` increment substitutes through, made to answer the question it is asked

## Acceptance criteria

The unit closes **one** open follow-up in `docs/followups/follow-ups-open.md`, on its own
`Closes when` clause, quoted **there**, not paraphrased here. Nothing else counts as closure.

⚠ **This batch is PO-gated by construction and — unlike Batch 7 — it is a MIGRATION if the PO
rules for a fix.** The clause is literally `Closes when: PO's, once BUG-PROF-INACTIVE-001 is
green.` `BUG-PROF-INACTIVE-001` is `fixed` in `docs/bugs/BUGS.md` (2026-09-01, pgTAP 404,
migration `20261003007190`), so the precondition holds and the deliverable is *the reachability
analysis that makes a ruling possible*, the ruling, and then whatever the ruling orders.
⛔ A measurement alone does not close it; ⛔ a ruling taken without the reachability analysis the
follow-up's body names as **not yet done** closes it on an unexamined blast radius.

⚠ **A checked box means the CONDITION IS MET AND PROVEN, not that the register entry is closed.**
The entry stays `Status: open` until the Record step, after PO approval.

- [ ] `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM` 🟠 — the function is parameterised on a third
      party (`p_uid`) but its first arm is `coalesce(app.is_admin(), false)`, which reads
      `auth.uid()`: the arm answers about the **caller**, never `p_uid`. Owed, in order:
      1. **Reachability analysis** from the **live catalog** (never migration text — ADR 0078):
         every caller of `app.can_manage_professional`, split self (`auth.uid()` passed) vs
         third-party; the body's 2026-09-01 figure (13 callers, 12 self, 1 third-party —
         `app.can_read_professional_profile`) is a **dated measurement to re-derive**, not a fact
         to quote. Each third-party path: which principal can reach it, through which door
         (`prosecdef` beside `pg_policies`), and what the wrong answer lets them do.
      2. **The PO ruling** on disposition (fix now / defer with a written re-open condition /
         other), taken **after** step 1 with the measurement in front of them.
      3. **If ruled fix:** a migration that makes the arm answer about `p_uid`; a pgTAP
         **differential-oracle** cell proving the defect is gone that was RED before the
         migration (the BUG-PROF-INACTIVE-001 precedent — one predicate change per migration so
         the fix stays attributable); the **diff-scoped door sweep over BOTH arms** on the derived
         case list; E2E if the reachable path is a UI path.

**Gate.** `npm run lint` 0 errors / 0 warnings · `typecheck` · `npm run test` · `test:db` on a
fresh reset · the four authz arms with domains quoted · `SELFTEST=1` on the deriver **and** the
door harness · the diff-scoped deriver over `main...HEAD` with its `SCOPE:` line quoted, its exit
read **bare** before any substitution · `git diff --name-only main... -- supabase/migrations
supabase/seed.sql src` — ⛔ **NOT empty if the PO rules fix** (this batch is a migration), in
which case the sweep is owed **both arms** over the derived cases and Batch 7's empty-pathspec
assertion does not apply. ⛔ Someone other than the builder runs the arms at the tip.

## Current state

**Updated:** 2026-09-09

### Objective
Give `FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ARM` the reachability analysis its body says was
never done, put the disposition to the PO with that measurement in front of them, and — if ruled
fix — land the one-predicate migration with its red-first pgTAP cell and both-arm sweep.

### Done since start
Unit opened 2026-09-09 (branch off `main` @ `4fe0c464`, ADR **0200** reserved). Full plan
returned and lead-spot-checked: **both** arms caller-keyed, **0 reachable third-party paths**
(the FUP's consequence refuted at head), a second defect site in `can_read_professional_profile`,
subject-keyed twins `is_admin_for` / `is_org_admin_of_for` already exist. PO ruled **R1 fix now ·
R2 both sites · R3 tightening declared**; lead rulings L1–L11 written (record, same date).

### In progress
`backend` building: pgTAP `415` RED-first at head, then the migration (both functions, landing
assertions both directions), manifest row + regenerated projection, ADR 0200 (`Amends: 0193`).

### Next
Lead runs the tip gate (fresh reset → `test:db` → four arms → deriver bare → BOTH-arm sweep with
`unset CASES` → `e2e:prod`), then QA review, fix loop, PO approval, Record step.

### Blockers
None. The clause's precondition (`BUG-PROF-INACTIVE-001` green) holds.
