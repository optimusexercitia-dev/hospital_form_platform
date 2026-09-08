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

- Preconditions measured, not assumed: `git status` clean, `origin/main..main` = 0, no `in_progress`
  hub. Unit opened; branch `authz-register-gate-hygiene` cut off `main` @ `6810d95b`.
- Four read-only recon sweeps landed (record § 2026-09-08). Three of them **refuted a written
  figure**: the ledger is 81 rows / 52 unbolded (not 76 / 6); the broken ADR links are 14 (not 13,
  and the entry's own "11" is off by one against its own enumeration); the archive holds **27**
  register-style `Closes when` fields of 174 entries (the entry measured 3 on 2026-09-04 — the gap is
  the interim practice working, ⛔ not a number to overwrite).
- Two close conditions found to **name homes that cannot host their fix** — `door-sweep-selftest.sh`
  never runs an audit harness, and neither the playbook nor CLAUDE.md contains the substitution.
- PO ruled all four scope questions (record § 2026-09-08). The non-AE2 ledger gaps are spun off.
- **A sixth defect, found by opening the unit:** gate 13's branch check could not pass on Windows —
  `git()` interpolates into a shell and `cmd.exe` keeps the single quotes, so branches arrive as
  `'main'`. ⭐ Those quotes were `3057ac1c`'s fix for `/bin/sh` on macOS: **the same check redding
  with the same message on the opposite platform.** Fixed shell-free (`execFileSync`, argv array);
  proven rc 0 real / rc 1 planted-absent / rc 0 reverted, read bare.

### In progress

Nothing built from the five follow-ups yet. The plan for the mutation-harness item is the next
artifact; the only code change so far is the gate-13 unblock above.

### Next

1. Plan the empty-`CASES` port **in full** before editing it — `backend` returns the plan, the lead
   approves with rulings in one scratch file. ⛔ Never the build first.
2. Build the four register/gate items, each with a planted-red proof and a clean-tree negative
   control.
3. ADR **0194** (highest on any live branch + 1 — `main` and `authz-enforcement-manifest` both at
   0193, so no collision), amending 0079 and 0186.

### Blockers

None. The four PO rulings that gated scope are given.
