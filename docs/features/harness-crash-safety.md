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
adrs: ["0079", "0153", "0171", "0184"]
handoff: ~
fup: ~
---

# HARNESS-CRASH-SAFETY — mutation-harness crash safety

## Acceptance criteria

The unit closes **four** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure.

- [ ] `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE` 🔴 — `restore_inflight` verifies
      the restore (exit status **and** body hash against `$INFLIGHT.body`) before clearing the
      sentinel, and leaves it intact on failure; the `DEGEN` preflight gains an arm that sees an
      enforcer whose live anchored-raise count is **below** the worklist's recorded `nraise`; both
      arms **proven able to fire** by a deliberate strand.
- [ ] `FUP-AUTHZ-HARNESS-PRECONDITIONS` 🔴 — the harness asserts **both** verdict preconditions:
      baseline green (already) **and** keystone present in the swept domain; a `PASS` with the
      subject absent is an `ERROR`, never a verdict. Proven able to fire.
- [ ] `FUP-AUTHZ-HARNESS-TRANSACTIONAL` 🔴 — ⛔ the filed fix "CANNOT BE BUILT" (the probe is a
      separate process). Closes on the **residual**: self-heal after process death via a marker
      that cannot disagree with the neutralization — or a PO ruling that the detect-only posture
      is accepted, recorded on the entry.
- [ ] `FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` 🟠 — drift is **bounded**, not
      merely detected: periodic reset + `BASE_S` re-capture inside the sweep, or the
      reset-and-retry-once fallback on a `SHAPE changed` / `not green` ERROR.
- [ ] `.claude/rules/mutation-harnesses-are-not-killable.md`'s "a kill is CAUGHT" claim and
      `.claude/rules/c2-neutralizer-has-no-crash-safety.md` are corrected/retired **in the same
      commit** as the mechanisms that invert them (the sentinel FUP's own close condition).
- [ ] Gate: `npm run lint` green; `npm run test:db` on a fresh reset green; the four authz arms
      hold; the diff-scoped door sweep is **not** owed (no policy or `prosecdef` gate changes —
      if that turns out false, it is owed, both arms).

## Current state

**Updated:** 2026-09-04

### Objective
Make every mutation harness in `supabase/tests/mutation/` unable to leave an authorization door
open **silently** after process death, and unable to emit a verdict whose preconditions did not
hold — before AE5's eleven per-role increments each run these harnesses again.

### Done since start
- Branch cut off `main` @ `7c85e713`; hub + record opened.

### In progress
- `backend` briefed; full plan required before any script change (the harnesses mutate live
  gates on the shared local stack).

### Next
- Plan review → build red-first (each detector shown to FIRE on a planted strand before it is
  trusted at 0) → gate → QA review → PO → Record.

### Blockers
- None. ⚠ Long sweeps must run **detached, never under a tool timeout** — the rule this unit
  exists to make unnecessary is still binding until it lands.
