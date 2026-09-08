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

⚠ **A checked box means the CONDITION IS MET AND PROVEN, not that the register entry is closed.**
All five entries are still `Status: open` on purpose — closure is a Record-step action taken after
PO approval, and closing earlier would assert an approval that has not happened (QA r3 minor: the
boxes read as unmet while the summary said "built").

- [x] `FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE` 🟡 — `hubHasLedgerRow`
      tolerates `**` around the id **and** the verdict regex becomes case-insensitive and tolerant
      of a leading emoji, **both proven able to fire**; then the workaround rows are re-bolded so no
      row is load-bearing on its formatting. ⛔ Not by rewriting rows to DROP their bold.
      **PO ruling 2026-09-08: the 6 workaround rows only** — derived as *unbolded ∧ after the first
      bolded row*, never hand-listed. ⚠ The plan's "six of 76" is refuted as a statement about the
      ledger — measured **@ `6810d95b`**: 81 rows, 52 unbolded, 29 bolded. ⛔ Those are dated figures,
      not current ones; the ledger has moved four times since and every count here is derivable from
      `lint:registers`. The rows predating the bolding convention are not the workaround class.
- [x] `FUP-ADR-CROSS-LINKS-HAVE-NO-GATE` 🟠 — `Closes when` was literally `PO to rule`.
      **PO ruled 2026-09-08: gate + repair, one work item.** A target-resolution check reaches
      `docs/decisions/`, and all broken links are repaired in the same change. ⛔ The gate may not be
      allowlisted past its own findings — the entry's own bar. ⚠ The entry's own count was stale and
      its "11" was off by one against its own enumeration; the number measured at the branch cut is
      in the record, and **zero** remain — ⛔ which is the point: gate 9 now derives it every run, so
      no prose here needs to. `exists()` had to become a `readdirSync` membership test, or the gate
      would be green on NTFS and red on a case-sensitive CI.
- [x] `FUP-AE2-MISSING-FROM-THE-PHASE-LEDGER` 🟠 — (a) AE2's row, marked **reconstructed**; and (b)
      the general question, **derived**, never by eye. **PO ruled 2026-09-08: (a) plus recording the
      derivation here; the rest is spun off to its own worktree.** ⚠ (b)'s answer is **no** — AE2 is
      the only unambiguous case among 10 record-with-verdict gaps, a ~14-member undecided umbrella
      mass, and rows with no record at all — the polarity nobody asked for. ⚠ The recon said **5**;
      the spun-off session’s own derivation found **7** and said so. ⛔ Derive, do not quote.
- [x] `FUP-DOCS-CONSOLIDATION-CLOSURE-DROPS-THE-CLOSES-WHEN-FIELD` 🟡 — EITHER the rotation moves the
      entry block as well as the body, OR a gate asserts an archived entry carries `**Closes when:**`
      — ⛔ confirm which gate owns register shape first (it is **13**, `lint:registers`; gate 7
      disclaims it in its own header). **Proven able to fire**: archive one entry without the field
      and watch it red. ⚠ Retrofitting is explicitly NOT required.
- [x] `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` 🟠 **+**
      `FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN` 🟠 — two entries, ONE
      mechanism; closes on the **first**, the stricter. An empty-but-set `CASES` is a FINDING exit,
      never a full run, in **both** harnesses (the write arm already landed it in ADR 0192);
      **proven able to fire**; and the recipe reads the deriver's EXIT CODE before substituting its
      stdout. ⛔ **Ported, not copied.** ⛔ Do not consolidate the two ids to close this.
      **PO ruled 2026-09-08 — the clause named two homes that COULD NOT host the fix at the time:**
      the proof went where it could run (the door harness's own `SELFTEST=1` block, mirroring ADR
      0192's Arm 3), and the recipe fix EDITS **ADR 0079 § The recipe**, where the substitution
      actually lived. ⚠ **Past tense on purpose:** after this batch **both** named homes DO host it —
      `door-sweep-selftest.sh` gained the two-polarity runner and `lead-playbook.md` §4 the
      exit-code-first recipe. A later reader must not see a shipped deviation that did not ship.

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
  sweeps **refuted three written figures** (the ledger's row/unbold counts, the broken-link total,
  the archive's `Closes when` population). ⛔ Each was correct when written and got a dated note
  beside it, never a rewrite — and the recon's own replacements were later refuted too, which is
  why this summary names **no counts at all**. Derive them from `lint:registers`.
- Two close conditions **named homes that could not host their fix**; the PO ruled four scope
  questions, and the non-AE2 ledger gaps were spun off to a worktree and merged back.
- **A sixth defect, found by opening the unit:** gate 13's branch check could not pass on Windows —
  `cmd.exe` keeps the quotes in `--format='%(refname:short)'`, so branches arrive as `'main'`.
  ⭐ Those quotes were `3057ac1c`'s fix for `/bin/sh` on macOS: **the same check, the same message,
  the opposite platform.** Fixed shell-free; rc 0 real / rc 1 planted-absent / rc 0 reverted.
- **All five follow-ups built.** Gate 9 resolves link **targets** case-exactly and every dangling
  link is repaired; the `complete` gate reads a bolded id and a decorated verdict, including a bare
  `## Verdict` heading with the verdict on the next line; a ninth ratchet
  `archiveMissingClosesWhen`, its domain re-derived by *property* after the first cut was bounded
  by a syntax; AE2 plus six further reconstructed ledger rows, every row 9 cells; and `CASES` made
  three-state across **all four** sweep harnesses plus their four `p0-authz-invariant.sh` callers.
- ADR **0194** placed (amends 0192); ADR **0079 § The recipe** EDITED to the two-step form.
- ⛔ **SEVEN claims of this unit's own shipped correct in DIRECTION and unmeasured in MAGNITUDE** —
  twice inside the correction of the previous one, and the seventh *beside* it: the removal was
  scoped to the phrase the last round argued about instead of to the class. ⭐ Structural, not
  careless — a number in prose has no gate. Repair: no live count is stated in this unit's files;
  the derivation is stated instead (`live-facts-measure-dont-quote`). Equal counts are also not
  the same set.
- **PO ratified the `DSR` row 2026-09-08** — the objection was *procedural*, not *factual*; cell 3's
  self-strike clause is rewritten at the Record step.

### In progress

QA fix loop 4. Four rounds, every one CHANGES REQUESTED and every one correct; ⭐ round 4 states the
code is done and could not be broken, and every finding from rounds 2–4 was **documentation about
measurements**, not a gate defect. Gate at the tip is complete and green: `lint` 0/0 · `typecheck` · `test`
151 files/2,056 · `test:db` 262 files/8,882 on a fresh reset · four authz arms **INVARIANT HOLDS** ·
`SELFTEST` PASS 42 · deriver **rc 3 NOT-APPLICABLE**, `SCOPE:` quoted, stdout 0 bytes ·
migrations/seed/`src` diff **EMPTY**, so E2E has no subject.

### Next

1. QA re-review round 3.
2. PO approval, then the Record step: `DSR` cell 3 first, then close the five follow-ups on their own
   quoted clauses, flip `FUP-AE2`'s status, hub → `complete`, `git merge --ff-only`.

### Blockers

None. ⚠ `LEDGER-COMPLETENESS` stays `in_progress` with `reviews: []` until round 3 lands: QA ruled it
must **not** be flipped `complete` on a CHANGES REQUESTED verdict, and gave it a ledger row instead
so its branch can still be deleted at Record.
