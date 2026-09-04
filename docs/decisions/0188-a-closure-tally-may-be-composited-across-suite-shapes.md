# ADR 0188 — A closure tally may be COMPOSITED across suite shapes, and must be stated as one

**Status:** accepted
**Date:** 2026-09-04 (raised by the C2 closure review, which found the ruling implicit and unwritten)
**Area:** authorization / mutation-coverage measurement / gate records
**Related:** ADR [0187](./0187-c2-closes-on-disclosure-and-the-blind-set-is-labelled-by-property.md)
(C2's closure conditions) · ADR [0184](./0184-c2-sweep-runs-against-the-current-branch-schema.md)
point 5 · ADR [0153](./0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) (a subset
run writes to scratch; the baseline is updated by merge) · ADR
[0079](./0079-authz-door-blindness-standing-invariant.md) (a verdict is meaningless without its
domain) · `docs/reviews/c2-tier1-closure-review.md` (the review that required this)

> **Number.** 0188 = the highest number on **any** live branch + 1, verified by enumerating
> `docs/decisions/` across every `refs/heads` and `refs/remotes` ref rather than trusting the
> index's next-free line: `main` tops out at **0187**, `origin/main` and `origin/HEAD` at **0186**,
> `origin/authz-c2-tier1` at **0180**; one worktree. No `0188-*.md` exists on any ref. This project
> has taken the index's next-free number into a collision twice (0180, 0183).

## Context

C2 closed at **COVERED 170 · BLIND 1 · ERROR 0 = 171**. ⛔ **That tally was never produced by a
single sweep.** Its 171 rows were measured across six different suite shapes as the work proceeded:

| shape | what was measured at it |
| --- | --- |
| `Tests=8685` | the original full sweep, 2026-09-02 — 106 COVERED rows still stand from it |
| `8764` | the anchor fix's 6-enforcer subset |
| `8788` | `assume_role` and `set_professional_link_state` after Phase B1 |
| `8819` | batch A's 18 keystones |
| `8866` | batch B's 21 keystones, then the 25-enforcer ERROR/tail-drift sweep |
| `8876` | the four residual abort sites |

A full 171-enforcer re-sweep at the measured ~87 s/run costs **~8 hours**. The question the review
forced into the open: **is a composite tally admissible at all, and if so on what conditions?**

## Problem

A mutation verdict is a statement about a *tree*: "with this door's anchored raises removed, the
suite went red." Change the tree and the statement is, strictly, about a tree that no longer exists.
Every phase of this work changed the tree. So either the tally is a composite — and the conditions
under which compositing is sound must be stated — or nothing short of an 8-hour sweep can ever close
a unit of this kind, which would make the closure condition unmeetable in practice.

The failure to avoid is the one this project keeps finding: **a composite presented as a single
measurement**, where the reader cannot see that the parts came from different instruments.

## Decision

### D1 — a composite tally is admissible, under three conditions, all of which must be checked

1. **No assertion deleted or weakened anywhere in the range.** Measured for C2: zero deleted
   `throws_ok`, zero `'CODE','message'` → NULL narrowings, zero changed expected values, and every
   `plan()` change upward.
2. **No migration and no `src/` change in the range** — the doors themselves are byte-identical to
   what the earlier rows were measured against. This is the stronger condition and the one that
   actually carries the argument; ⛔ "only the allowlist lines were deleted" is *not* it, and was
   literally false when written.
3. **The unproven direction is named and shown to be conservative.** Adding assertions is not
   shape-neutral: a new arm that raises under some *other* door's mutation aborts its file and turns
   that door's COVERED into **ERROR** (LEARN-081). So the reachable movements are ERROR→COVERED,
   BLIND→COVERED, and COVERED→ERROR. **COVERED→ERROR cannot manufacture a false COVERED** — it
   downgrades a real verdict to unmeasurable. ⇒ a composite can *overstate how many rows carry a
   live verdict*, and can never *assert coverage that was not measured*.

### D2 — the composite must be STATED as a composite, with the shapes it spans

A gate record citing a composited tally names the shapes its rows came from and the conditions
above. ⛔ **A tally written as though one sweep produced it is non-conforming**, even when every
row is individually sound. This is ADR 0079's rule about domains applied to time rather than to
population: a verdict without its instrument is not a verdict.

### D3 — classes count DOORS; property labels count ARMS; a record stating both says which

ADR 0187 D2's labels attach to a **raise**, while the A1/A2/B classification attaches to a **door**.
A door may therefore be class A2 and still carry a labelled state arm — `public.cancel_event` is
exactly that. C2's true figures: **A1 12 / A2 13 / B 14 = 39 doors**, and **16 labels across 15
doors** (the 14 class-B doors plus `cancel_event`). Stated without the distinction the two read as a
contradiction, and the closure review flagged it as one.

## Considered options

- **Require a full re-sweep before any closure.** Rejected: ~8 h per attempt, and every fix during
  the gate restarts it. It would not buy correctness — it would buy a *fresher* composite, since the
  tree changes again the moment a finding is fixed.
- **Freeze the tree for the duration of a closure.** Rejected as unworkable here: the closure's own
  findings required 25 statement edits, 39 keystones and 4 abort repairs. A freeze would have meant
  closing on a tree known to be defective.
- **Re-sweep only the rows whose files changed.** Attractive, and partly what happened — but it does
  not close the loop, because a row's verdict can be disturbed by a change to a file the *other*
  door's mutation enters, not only its own. D1's condition 3 covers that case by argument, and the
  argument is cheap where the re-sweep is not.
- **Accept the composite silently.** Rejected — that is the defect, not the fix.

## Consequences

- C2's 170/1/0 stands as a **composite**, and its record now says so with the six shapes listed.
- ⚠ **A residual this ADR does not remove:** the harness records a **suite-level** flip, not which
  assertion flipped. So a COVERED verdict attributes coverage to the *door*, never to a specific
  keystone — a keystone can be redundant with a pre-existing arm and the verdict cannot tell. The
  closure review names this as the highest-value instrument fix available, and it is not done.
- The 106 rows carried from `Tests=8685` remain the oldest evidence in the file. They are sound
  under D1 but they are also the rows **least** re-measured, and a future sweep should prefer them
  when spending budget.
- ⛔ Nothing here licenses compositing across a **schema** change. D1 condition 2 is a hard gate: a
  migration in the range voids the composite, because the door under test is no longer the same
  function. The C2 range contained none.
