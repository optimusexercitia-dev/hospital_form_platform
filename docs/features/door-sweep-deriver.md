---
id: DOOR-SWEEP-DERIVER
title: Door-sweep case deriver — select gates by PROPERTY, read the whole declaration, scope the increment, and let a full run keep the hand-authored baseline (pre-AE5 Batch 1)
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 1 of the follow-up batches ruled 2026-09-04"
branch: authz-door-sweep-deriver
plan: ~
progress: ../progress/door-sweep-deriver.md
reviews: []
adrs: ["0079", "0148", "0153", "0173", "0182"]
handoff: ~
fup: ~
---

# DOOR-SWEEP-DERIVER — the diff-scoped sweep's case deriver

## Acceptance criteria

The unit closes **five** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure. Four
live in `scripts/door-sweep-cases.sh` (the §6 step-1 instrument every AE5 increment will run);
the fifth in the full-run emit path of the sweep harness that writes the committed baseline.

- [x] `FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE` 🟠 — gates selected by a **property**,
      not a name filter (or the exclusions printed with their reason); `BASE=9a4bbd22^ TIP=9a4bbd22`
      must stop deriving zero cases. ⛔ Not by widening the filter to admit one name.
- [x] `FUP-DOOR-SWEEP-MARKER-BLIND-TO-CONTINUATION-LINES` 🟠 — the `door-sweep-targets:` parser
      consumes continuation lines, or rejects an unmatched continuation loudly; `20261003007250`'s
      three targets derive **from the declaration path**, provable with its `create or replace`
      lines removed from consideration. ⛔ Not by reformatting `…007250`.
- [x] `FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION` 🟠 — `alter function … security definer`
      is grepped like `alter policy`, the altered function's return type resolved from the **live
      catalog**; a `prosecdef` flip on an existing boolean gate derives that gate.
- [x] `FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE` 🟠 — the deriver takes an explicit
      scope (migration-id floor or path prefix) **or** prints per-file provenance (committed-range ·
      working-tree · untracked), so a union can never again be recorded as one increment's
      coverage. ⛔ Not by dropping the working-tree/untracked sources.
- [x] `FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS` 🟡 — a **full** sweep merges
      generated rows into `docs/reviews/authz-door-audit-findings.md` and the hand-authored
      material (the `<!-- … -->` subset block, the RENAME note, the skipped-policy annotations)
      survives byte-for-byte. ⛔ Not by extending the subset guard to full runs.
- [x] Every new selection/parse arm **proven able to fire** on its own reproducer (`9a4bbd22`;
      `…007250` declaration-only; a planted `ALTER FUNCTION … SECURITY DEFINER` on a boolean gate
      in a scratch migration never committed; a two-increment working tree; a full-run emit over a
      copy of the baseline), each paired with a clean negative control.
- [x] Gate: `npm run lint` green; `npm run test:db` on a fresh reset green; the four authz arms
      hold; the diff-scoped door sweep **not owed** (no policy or `prosecdef` gate changes — if that
      turns out false, it is owed, both arms — derived, for the first time, by the fixed deriver).

## Current state

**Updated:** 2026-09-05 (QA fix loop, iteration 1 of ≤5)

### Objective
Make `scripts/door-sweep-cases.sh` — the instrument CLAUDE.md §6 step 1 makes every phase and
every AE5 increment run — derive the diff-scoped case list by PROPERTY, read the whole
declaration notation, attribute what it swept to an increment, and let the periodic full sweep
re-baseline without destroying the committed findings file's hand-authored material (Batches
2–3 need that re-baseline).

### Done since start
Eleven build commits, then the QA review at `de955981` returned **CHANGES REQUESTED — 1 BLOCK,
6 MAJOR, 8 REC**. Iteration 1 closes all of them (F-REC-4 is the lead's playbook edit):
`6474a625` the merge helper · `4d5c6bd9` the deriver · this one (docs). **F-BLOCK-1 was real
and reproduced first**: the helper classified every `| `-leading line as a verdict row and
built its protected set with `grep -vE '^\| '`, so all three of QA's measured losses — a note
truncated at an escaped `\|` (727→579 B, 1106→570 B), a hand table deleted whole (165→161
lines), a hand row with an empty note vanishing — happened at bare rc 0 reporting everything
preserved. Now: 0 bytes lost on all three, and the verifier is proven able to see them by
being fed the PRE-FIX helper's own committed output (rc 2 ×3). The merge now has 18 self-test
scenarios; the same suite against `de955981`'s helper is **13 FAIL, bare rc 1**.
Measured, PINNED, on `731abda0^..4d5c6bd9`: 42 tokens → **18** cases, tier 1 = **39**.
⛔ No production function, policy, migration or seed changed; no full sweep was run; the four
committed findings baselines are byte-identical to `main`.

### In progress
Nothing. Iteration-1 gate on a fresh `supabase db reset --local`, all codes read BARE — results
in the record's `### 2026-09-05 — backend: QA fix loop, iteration 1`. ⚠ Two of QA's five
could-not-verify items were settled by MEASUREMENT rather than argument, and one of them
refuted an assumption the merge rested on: the generator's file list is **not** a prefix of the
committed note (0 of 2 byte-exact on a real 2-case door run), so the splice rule is now
whitespace-tolerant and everything else is carried whole.

### Next
QA re-review → PO → Record. The six follow-up closures are unchanged and still **pending QA +
PO**; one new follow-up was filed this iteration
(`FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` 🟡, backend, body + entry, not fixed).

### Blockers
None. ⚠ Two open items for the lead, both in the report: (1) three of the six closures rest on
the follow-up BODY's condition because the REGISTER field read `PO to rule` — that field is the
PO's; (2) on a real full re-baseline most hand-annotated door rows will land in the CARRIED
block rather than being spliced, because the generator's file lists have grown since those
notes were written. That is the safe direction — nothing is lost and everything is flagged —
but it is a large CARRIED block for a human to re-file, and Batches 2–3 should expect it.
