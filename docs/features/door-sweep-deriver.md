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
reviews: ["../reviews/door-sweep-deriver-rereview.md", "../reviews/door-sweep-deriver-review.md"]
adrs: ["0079", "0148", "0153", "0173", "0182", "0190"]
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

**Updated:** 2026-09-05 (QA fix loop iteration 4 — F3-BLOCK-1 closed, denominator restored to 399)

### Objective
Make `scripts/door-sweep-cases.sh` — the instrument CLAUDE.md §6 step 1 makes every phase and AE5
increment run — derive the diff-scoped case list by PROPERTY, read the whole declaration notation,
attribute what it swept to an increment, and let the periodic full sweep re-baseline without
destroying the committed findings file's hand-authored material (Batches 2–3 need that).

### Done since start
Eleven build commits. QA at `de955981` returned **1 BLOCK / 6 MAJOR / 8 REC**; iteration 1 closed
all of them and the re-review at `7e1f0d62` disposed **every** one ✅ FIXED — F-BLOCK-1 proven able
to fail on three real historical losses (`MERGE_VERIFY` over the committed pre-fix outputs, rc 2
×3). It left one blocking item, F2-BLOCK-1, **documentation-only**: the fix loop rewrote the merge
helper and the marker parser, then edited ADR 0190 in six hunks that missed **D8 and D9**, the two
sections describing what had just been rewritten. Iteration 2 corrected D8, D9, D5's body, option
E and D11, each keeping the superseded text visible; iteration 3 closed QA's seven non-blocking
F2-RECs. Iteration 4 closes QA's delta check at `ee037fa3`: the blocking denominator, the hand
suffix re-measured at **579 characters / 587 bytes**, D9's graded-block claim narrowed to the two
harnesses that have a graded block, a header pointer to a function name that never existed,
"rows" → "row lines" where the helper itself says so, the `reviews:` frontmatter, and D11's
control — **discharged** by QA's measured pre-unit-deriver run (`PASS 20 · FAIL 14 · SKIPPED 0`,
bare rc 1, deriver half 2/16). Per-site old → new detail is in the record.
Measured, PINNED, on `731abda0^..4d5c6bd9`: 42 tokens → **18** cases, tier 1 = **39**.

### In progress
Nothing. Phase-Gate step 1 was **re-read at the tip `ee037fa3`** on a fresh `supabase db reset
--local`, so the gate rows measure the final commit rather than argue from `7e1f0d62`. Every code
BARE, every DB step detached: reset **0**; `npm run test:db` **0** (`Files=262, Tests=8876`,
`Result: PASS`, the parked deadlock flake measured absent, not assumed); `ARM=census` **0** (581
gates / 625 verdicts); `ARM=hat` **0** (7/7 self-test **and** its 4 enumerated findings);
`ARM=floor` **0** (63); `FROMFINDINGS=1 ARM=wrapper` **0** (BLIND 41); self-test **0**
(`PASS 34 · FAIL 0 · SKIPPED 0`). **No BLIND, no ERROR**, every figure identical to the
pre-fix-loop baseline. Iteration 4 is docs plus a **proven** comment-only helper edit, no arm re-owed.

⛔ **The verdict-row denominator is 399** — the ORIGINAL number, restored. Iteration 3 raised it to
400 by assuming ONE table header; `emit_body` emits **two** tables and the baseline carries both,
`:112` and `:262`. Measured three independent ways, all 399 (commands and the 397/1/1 separator
histogram in the record). `:282` is a genuine verdict row, not something a header rule swallows —
the helper keys baseline headers on exact text from the generated file, never on delimiter
adjacency. **No code defect: the classifier was right and only the prose was wrong.**

### Next
QA sign-off → PO → Record. The six follow-up closures are unchanged and still **pending QA +
PO**; one new follow-up stands from iteration 1
(`FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` 🟡, backend, body + entry, not fixed).

### Blockers
None. ⚠ Three open items for the lead/PO, item (3) **closed 2026-09-05**: (1) three of the six
closures rest on the follow-up BODY's condition because the REGISTER field read `PO to rule` —
that field is the PO's; (2) a real full re-baseline will produce a LARGE CARRIED block — QA's
structural bound on the door file is **2 ≤ CARRIED ≤ 26** of its 37 hand-annotated rows plus every
out-of-domain gate; nothing is lost and everything is flagged, but it must be re-filed by hand and
budgeted into Batch 2; ~~(3) the `hat` arm's DOMAIN half is unrecorded~~ — **CLOSED**, re-run at
the tip and recorded as measurement, not back-fill (4 findings named, over 1091 functions and 283
policies); (4) the 34-scenario self-test is still in no gate — that is F-REC-4, the lead's
playbook edit. ⚠ One non-blocking observation for the lead: `act-hat-blind-sweep.sh:18` states its
population as "app+public" while the predicate at `:195` reads `('app','public','authz')` — a
stale prose line in the file that defines a domain, out of scope here.
