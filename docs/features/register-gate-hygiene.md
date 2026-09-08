---
id: REGISTER-GATE-HYGIENE
title: Register and gate hygiene — the complete-gate regexes learn bold ids and real verdict lines, ADR link TARGETS get resolved, AE2 re-enters the ledger, an archived closure keeps its `Closes when`, and the door arm stops reading an empty `CASES` as a full sweep (pre-AE5 Batch 6)
status: complete
kind: feature
program: DOCS
phase: "Pre-AE5 remediation — Batch 6 of the follow-up batches ruled 2026-09-04"
branch: ~   # merged to main 2026-09-08 at the Record step; branch deleted
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/register-gate-hygiene.md
reviews: ["../reviews/register-gate-hygiene-review.md", "../reviews/register-gate-hygiene-rereview.md", "../reviews/register-gate-hygiene-review-r3.md", "../reviews/register-gate-hygiene-review-r4.md"]
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
