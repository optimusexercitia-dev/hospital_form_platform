---
id: REGISTER-GATE-HYGIENE
title: Register and gate hygiene — the complete-gate regexes learn bold ids and real verdict lines, ADR link TARGETS get resolved, AE2 re-enters the ledger, an archived closure keeps its `Closes when`, and the door arm stops reading an empty `CASES` as a full sweep (pre-AE5 Batch 6)
status: in_progress
kind: feature
program: DOCS
phase: "Pre-AE5 remediation — Batch 6 of the follow-up batches ruled 2026-09-04"
branch: authz-register-gate-hygiene
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/register-gate-hygiene.md
reviews: []
adrs: ["0079", "0185", "0186", "0190", "0191", "0192", "0193"]
handoff: ~
fup: ~
---

# REGISTER-GATE-HYGIENE — the gates that decide what every other unit's Record step can say

## Acceptance criteria

The unit closes **five** open follow-ups in `docs/followups/follow-ups-open.md` (six ids — one
mechanism carries two), each on its own `Closes when` clause, quoted **there**, not paraphrased
here. Nothing else counts as closure. Four are register/gate hygiene; the fifth is the batch's only
mutation-harness item and ⛔ does **not** share the batch's *"cheap, and the window is structural"*
reasoning (plan §3).

- [ ] `FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE` 🟡 — `hubHasLedgerRow`
      tolerates `**` around the id **and** the verdict regex becomes case-insensitive and tolerant
      of a leading emoji, **both proven able to fire**; then the workaround rows are re-bolded so no
      row is load-bearing on its formatting. ⛔ Not by rewriting rows to DROP their bold.
      **PO ruling 2026-09-08: the 6 workaround rows only** — derived as *unbolded ∧ after the first
      bolded row* (lines 124–129), never hand-listed. ⚠ The plan's "six of 76" is refuted as a
      statement about the ledger: it is **81 rows, 52 unbolded, 29 bolded**; the 46 rows before line
      95 predate the bolding convention and are not the workaround class.
- [ ] `FUP-ADR-CROSS-LINKS-HAVE-NO-GATE` 🟠 — `Closes when` was literally `PO to rule`.
      **PO ruled 2026-09-08: gate + repair, one work item.** A target-resolution check reaches
      `docs/decisions/`, and all broken links are repaired in the same change. ⛔ The gate may not be
      allowlisted past its own findings — the entry's own bar. ⚠ **14** broken today, not 13 and not
      the entry's twice-stated 11; and `exists()` must become a `readdirSync` membership test, or the
      gate is green on NTFS and red on a case-sensitive CI.
- [ ] `FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER` 🟠 — (a) AE2's row, marked **reconstructed**; and (b)
      the general question, **derived**, never by eye. **PO ruled 2026-09-08: (a) plus recording the
      derivation here; the rest is spun off to its own worktree.** ⚠ (b)'s answer is **no** — AE2 is
      the only unambiguous case among 10 record-with-verdict gaps, a ~14-member undecided umbrella
      mass, and 5 rows with no record at all (the polarity nobody asked for).
- [ ] `FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD` 🟡 — EITHER the rotation moves the
      entry block as well as the body, OR a gate asserts an archived entry carries `**Closes when:**`
      — ⛔ confirm which gate owns register shape first (it is **13**, `lint:registers`; gate 7
      disclaims it in its own header). **Proven able to fire**: archive one entry without the field
      and watch it red. ⚠ Retrofitting is explicitly NOT required.
- [ ] `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` 🟠 **+**
      `FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN` 🟠 — two entries, ONE
      mechanism; closes on the **first**, the stricter. An empty-but-set `CASES` is a FINDING exit,
      never a full run, in **both** harnesses (the write arm already landed it in ADR 0192);
      **proven able to fire**; and the recipe reads the deriver's EXIT CODE before substituting its
      stdout. ⛔ **Ported, not copied.** ⛔ Do not consolidate the two ids to close this.
      **PO ruled 2026-09-08 — the clause names two homes that cannot host the fix:** the proof goes
      where it can run (the door harness's own `SELFTEST=1` block, mirroring ADR 0192's Arm 3), and
      the recipe fix EDITS **ADR 0079 § The recipe**, which is where the substitution actually lives.

**Gate.** `npm run lint` 0 errors / 0 warnings · `typecheck` · `npm run test` · `test:db` on a fresh
reset · the four authz arms with domains quoted · `SELFTEST=1` on the deriver **and** the door
harness · the diff-scoped deriver over `main...HEAD` with its `SCOPE:` line quoted, its exit read
**bare** before any substitution · `git diff --name-only main... -- supabase/migrations
supabase/seed.sql src` empty (this batch is not a migration). ⛔ Someone other than the builder runs
the arms at the tip.

## Current state

**Updated:** 2026-09-08

### Objective

Repair the gates and registers that every other unit's Record step runs, in the inter-batch window,
because a gate added mid-phase blocks that phase — and port the write arm's empty-`CASES` fix to the
door arm, which is the one item here that touches a live gate's harness.

### Done since start

- Preconditions measured, not assumed; branch cut off `main` @ `6810d95b`. Four read-only recon
  sweeps **refuted three written figures** (ledger 81 rows / 52 unbolded, not 76 / 6; ADR links 14,
  not 13, and the entry's "11" off by one against its own list; archive 27 of 174, not 3) — each
  correct when written, so each is a dated note beside it, ⛔ never a rewrite.
- Two close conditions **named homes that cannot host their fix**; the PO ruled all four scope
  questions and the non-AE2 ledger gaps were spun off to their own worktree and merged back.
- **A sixth defect, found by opening the unit:** gate 13's branch check could not pass on Windows —
  `cmd.exe` keeps the quotes in `--format='%(refname:short)'`, so branches arrive as `'main'`.
  ⭐ Those quotes were `3057ac1c`'s fix for `/bin/sh` on macOS: **the same check, the same message,
  the opposite platform.** Fixed shell-free; rc 0 real / rc 1 planted-absent / rc 0 reverted.

- **All five follow-ups built.** Gate 9 resolves link **targets** case-exactly and all 14 dangling
  links repaired; the `complete` gate's two regexes read a bolded id and a decorated verdict
  (readable reviews **65 → 102** of 169); a ninth ratchet `archiveMissingClosesWhen` (**121**, domain
  re-derived by *property* after its first cut was bounded by a syntax); AE2 plus six further
  reconstructed ledger rows (**88 rows, all 9 cells**); and `CASES` made three-state across **all
  four** sweep harnesses plus their four `p0-authz-invariant.sh` callers.
- ADR **0194** placed (amends 0192); ADR **0079 § The recipe** EDITED to the two-step form, which is
  where the substitution actually lived.
- ⛔ **Three of this unit's own repairs first shipped correct in DIRECTION and unmeasured in
  MAGNITUDE** — the verdict regex, the ratchet's domain, and gate 11's diagnosis. Each is recorded
  with what the second measurement found.

### In progress

The gate at the tip, run by the lead rather than the builder. Green so far: `lint` **rc 0** (0/0,
eslint running) · `typecheck` **rc 0** · `test:db` **rc 0** on a fresh reset — **262 files / 8,882
tests PASS** · gate 13 **rc 0**, every ratchet at or under cap ·
`git diff --name-only main... -- supabase/migrations supabase/seed.sql src` **EMPTY**, so the sweep
is not owed both arms and E2E is not implicated.

### Next

1. Finish the gate: `npm run test`, the four authz arms with domains quoted, `SELFTEST=1` on the
   deriver and the door harness, and the diff-scoped deriver with its `SCOPE:` line and its exit read
   **bare before any substitution**.
2. QA review → fix loop → re-review.
3. PO approval, then the Record step: close the five follow-ups on their own quoted clauses, flip
   `FUP-AE2`'s status, ledger row, hub → `complete`, `git merge --ff-only`.

### Blockers

None. ⚠ One decision is **banked for the PO at approval**, not blocking: whether the `DSR` ledger row
stays — the spun-off session wrote it outside the option the PO picked, under its principle rather
than inside it, and the row invites its own removal in its own text.
