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

**Updated:** 2026-09-05 (QA fix loop, iteration 2 of ≤5 — docs only)

### Objective
Make `scripts/door-sweep-cases.sh` — the instrument CLAUDE.md §6 step 1 makes every phase and
every AE5 increment run — derive the diff-scoped case list by PROPERTY, read the whole
declaration notation, attribute what it swept to an increment, and let the periodic full sweep
re-baseline without destroying the committed findings file's hand-authored material (Batches
2–3 need that re-baseline).

### Done since start
Eleven build commits; QA at `de955981` returned **1 BLOCK / 6 MAJOR / 8 REC**, iteration 1
closed all of them, and QA's re-review at `7e1f0d62` disposed **every** one ✅ FIXED (F-REC-4 is
the lead's playbook edit) — F-BLOCK-1 fixed and proven able to fail on the three real historical
losses (`MERGE_VERIFY` over the committed pre-fix outputs, rc 2 ×3). It left **one** blocking
item, F2-BLOCK-1, **documentation-only**: the fix loop rewrote the merge helper and the marker
parser, then edited ADR 0190 in six hunks that missed **D8 and D9** — the two sections describing
what had just been rewritten — so the ADR still carried the pre-fix merge rules, including
verbatim the clause whose implementation *was* the blocking defect. Iteration 2 corrects D8, D9,
D5's body, option E and D11, plus dated corrections beside two archived closures, each with the
superseded text kept visible. ⛔ **No code, no migration, no script, no gate re-run** — the diff
is entirely `docs/`.
Measured, PINNED, on `731abda0^..4d5c6bd9`: 42 tokens → **18** cases, tier 1 = **39**.

### In progress
Nothing. Iteration-2 gate, codes read BARE: `npm run lint` **0** (eslint 0/0 + all 13 gates),
`lint:adr-index` **0** (body-only edits, so `adr:index` was not owed), `lint:registers` **0**
with ratchets unchanged. No `test:db` or authz arm is owed for a docs-only diff. ⚠ The grep
census was re-run after the first attempt proved a DEAD INSTRUMENT: `grep -rniF` aborts here
(SIGABRT, rc 134) and printed zero hits that would have read as "none found".

### Next
QA delta check → PO → Record. The six follow-up closures are unchanged and still **pending QA +
PO**; one new follow-up stands from iteration 1
(`FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` 🟡, backend, body + entry, not fixed).

### Blockers
None. ⚠ Four open items for the lead/PO: (1) three of the six closures rest on the follow-up
BODY's condition because the REGISTER field read `PO to rule` — that field is the PO's; (2) a
real full re-baseline will produce a LARGE CARRIED block — QA's structural bound on the door file
is **2 ≤ CARRIED ≤ 26** of its 37 hand-annotated rows plus every out-of-domain gate; nothing is
lost and everything is flagged, but it must be re-filed by hand and budgeted into Batch 2;
(3) QA's non-blocking F2-REC-1/2/3/5/6/7 are **not** in this commit (two are script-header
sentences, three are wrong numbers, one is the hub's `adrs:` frontmatter) — they need placing;
(4) the 34-scenario self-test is still in no gate — that is F-REC-4, the lead's playbook edit.
