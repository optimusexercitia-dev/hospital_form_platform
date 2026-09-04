---
id: HARNESS-CRASH-SAFETY
title: Mutation-harness crash safety — a killed sweep may never leave a door open without a trace (pre-AE5 Batch 0)
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 0 of the follow-up batches ruled 2026-09-04"
branch: authz-harness-crash-safety
plan: ~
progress: ../progress/harness-crash-safety.md
reviews: []
adrs: ["0079", "0153", "0171", "0184", "0189"]
handoff: ~
fup: ~
---

# HARNESS-CRASH-SAFETY — mutation-harness crash safety

## Acceptance criteria

The unit closes **four** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure.

- [x] `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE` 🔴 — **CLOSED 2026-09-04.** — `restore_inflight` verifies
      the restore (exit status **and** body hash against `$INFLIGHT.body`) before clearing the
      sentinel, and leaves it intact on failure; the `DEGEN` preflight gains an arm that sees an
      enforcer whose live anchored-raise count is **below** the worklist's recorded `nraise`; both
      arms **proven able to fire** by a deliberate strand.
- [x] `FUP-AUTHZ-HARNESS-PRECONDITIONS` 🔴 — **CLOSED 2026-09-04.** — the harness asserts **both** verdict preconditions:
      baseline green (already) **and** keystone present in the swept domain; a `PASS` with the
      subject absent is an `ERROR`, never a verdict. Proven able to fire.
- [ ] ⏸ `FUP-AUTHZ-HARNESS-TRANSACTIONAL` 🔴 — **STAYS OPEN**, awaiting the PO ruling on Q2. — ⛔ the filed fix "CANNOT BE BUILT" (the probe is a
      separate process). Closes on the **residual**: self-heal after process death via a marker
      that cannot disagree with the neutralization — or a PO ruling that the detect-only posture
      is accepted, recorded on the entry.
- [x] `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` 🟠 — **CLOSED 2026-09-04.** — drift is **bounded**, not
      merely detected: periodic reset + `BASE_S` re-capture inside the sweep, or the
      reset-and-retry-once fallback on a `SHAPE changed` / `not green` ERROR.
- [x] `.claude/rules/mutation-harnesses-are-not-killable.md`'s "a kill is CAUGHT" claim and
      `.claude/rules/c2-neutralizer-has-no-crash-safety.md` are corrected/retired **in the same
      commit** as the mechanisms that invert them (the sentinel FUP's own close condition).
- [x] Gate: `npm run lint` green; `npm run test:db` on a fresh reset green; the four authz arms
      hold; the diff-scoped door sweep is **not** owed (no policy or `prosecdef` gate changes —
      if that turns out false, it is owed, both arms).

## Current state

**Updated:** 2026-09-04

### Objective
Make every mutation harness in `supabase/tests/mutation/` unable to leave an authorization door
open **silently** after process death, and unable to emit a verdict whose preconditions did not
hold — before AE5's eleven per-role increments each run these harnesses again.

### Done since start
- **Three of the four follow-ups CLOSED**, each on its own `Closes when` clause, each detector
  **proven able to fire** on a planted strand with the exit code and message recorded, and each
  paired with a clean-tree negative control in the same session
  (`docs/progress/harness-crash-safety.md` § 2026-09-04 carries every witness):
  `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE`,
  `FUP-AUTHZ-HARNESS-PRECONDITIONS`, `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS`.
- A restore is believed only when the **catalog agrees** (psql rc **and** a probe re-read); a
  failed restore **keeps** the sentinel; `RECOVER=1` in C2 and verified in both `p0-*` siblings.
- `DEGEN` arm 4 (residue shape + persisted worklist expectation); both verdict preconditions
  asserted and printed; `SUITE=` is a subset (an ADR 0153 violation found and fixed in passing);
  tail drift bounded by `RESET_EVERY` + reset-and-retry-once.
- `.claude/rules/c2-neutralizer-has-no-crash-safety.md` retired verbatim to
  `docs/progress/rules-archive.md`; `mutation-harnesses-are-not-killable.md` corrected in the
  commit where its claim became true. ADR **0189** drafted; `LESSONS.md` gained LEARN-084/085 and
  LEARN-082's enforcer is now the harness, not the rule file.
- ⛔ **No production function, policy, migration or seed changed** — measured:
  `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` is **empty**, so the
  diff-scoped door sweep is not owed.

### In progress
- Nothing. The build is at a clean commit boundary awaiting the lead's review of ADR 0189
  (`**Status:** proposed`) and of the commit set.

### Next
- Lead review → QA → PO. Then the Record step.
- ⏸ Commit 5 (`FUP-AUTHZ-HARNESS-TRANSACTIONAL`'s residual — a committed marker row) is **not
  built**: it awaits the PO's ruling on Q2. That entry stays **open**, with the pending ruling
  recorded on its `**Status:**` line.

### Blockers
- **PO ruling Q2** gates the fourth follow-up; everything else in the unit is complete.
- ⚠ One branch is unproven and says so: arm 4b's `NOT RUN` path needs both baseline sources
  absent, which a working tree cannot produce without a change out of this unit's scope.
