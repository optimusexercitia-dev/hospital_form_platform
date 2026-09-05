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
adrs: ["0079", "0153", "0171", "0189"]
handoff: ~
fup: ~
---

# HARNESS-CRASH-SAFETY — mutation-harness crash safety

## Acceptance criteria

The unit closes **four** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure.
(⚠ As of **2026-09-04** all four have been rotated out of that register: read their `Closes when`
clauses and their filed bodies in `docs/followups/follow-ups-archive.md`.)

- [x] `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE` 🔴 — **CLOSED 2026-09-04.** — `restore_inflight` verifies
      the restore (exit status **and** ~~body hash against `$INFLIGHT.body`~~) before clearing the
      sentinel, and leaves it intact on failure; ~~the `DEGEN` preflight gains an arm that sees an
      enforcer whose live anchored-raise count is **below** the worklist's recorded `nraise`~~; both
      arms **proven able to fire** by a deliberate strand.
      — **amended 2026-09-04 (F1, ADR 0189 D3):** the struck clause is **vacuous by construction**
      (the worklist derives live count *and* recorded `nraise` from the same `prosrc` in the same
      instant, and a fully stranded enforcer leaves the population altogether), so it was built
      instead as **arm 4a** (residue shape with no anchor-class errcode, measured **0** on a clean
      tree) **+ arm 4b** (persisted worklist expectation; a **reduction** reds, `NOT RUN` when no
      source). The original words are kept struck rather than rewritten: an amendment must read as
      an amendment.
      — **amended 2026-09-04 (QA F-MAJOR-4a):** the *other* struck phrase, in criterion 1, is the
      body-hash half. The probe compares `md5(pg_get_functiondef(oid))` read **from the catalog**
      against the md5 `snapshot()` captured **from the catalog** before the mutation; it never
      hashes `$INFLIGHT.body`, because per ADR 0189 D1 *"that file is what we are trying to apply,
      so comparing it against itself proves nothing about the database."* Both halves of criterion
      1 were vacuous as filed — the exit-status half needed `ON_ERROR_STOP=1` first.
- [x] `FUP-AUTHZ-HARNESS-PRECONDITIONS` 🔴 — **CLOSED 2026-09-04.** — the harness asserts **both** verdict preconditions:
      baseline green (already) **and** keystone present in the swept domain; a `PASS` with the
      subject absent is an `ERROR`, never a verdict. Proven able to fire.
- [x] `FUP-AUTHZ-HARNESS-TRANSACTIONAL` 🔴 — **CLOSED 2026-09-04 BY PO RULING.** — ⛔ the filed fix "CANNOT BE BUILT" (the probe is a
      separate process). Its close condition offered two exits — self-heal via a marker, **or** a
      PO ruling that the detect-only posture is accepted, recorded on the entry — and the **second**
      was taken: the PO ruled **detect-only** on Q2, self-healing is explicitly not a requirement,
      the marker was **buildable and not built by decision**, and the ruling's re-open trigger ("a
      harness ever run against a database with more than one owner") is carried on the archived
      entry (ADR 0189 D7).
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
- **ALL FOUR follow-ups CLOSED**, each on its own `Closes when` clause, each rotated verbatim to
  `docs/followups/follow-ups-archive.md` with its body file retired. Three closed on a mechanism
  **proven able to fire** on a planted strand — exit code and message recorded, each paired with a
  clean-tree negative control in the same session; `FUP-AUTHZ-HARNESS-TRANSACTIONAL` closed on the
  PO's **detect-only** ruling (Q2), self-healing explicitly not a requirement, the marker
  **buildable and not built by decision**, its re-open trigger riding on the archived entry.
  ⚠ Two of the four register rows carried the consolidation placeholder `Closes when: PO to rule`
  and were closed on their **body files'** conditions — now **disclosed** on both closure notes.
- A restore is believed only when the **catalog agrees** (psql rc **and** a probe re-read); a
  failed restore **keeps** the sentinel; `RECOVER=1` in C2 and verified in both `p0-*` siblings.
- `DEGEN` arm 4 (residue shape + persisted worklist expectation); both verdict preconditions
  asserted and printed; `SUITE=` is a subset (an ADR 0153 violation found and fixed in passing);
  tail drift bounded by `RESET_EVERY` + reset-and-retry-once, **measured** at ≈ +28 min on a
  ≈ 9.5 h sweep (≈ +5 %).
- **QA review APPROVED** (4 MAJOR + 4 RECOMMENDED, none blocking). **Fix-loop iteration 1 landed**
  — commits `8d7f01db` (script) + the docs commit: arm 4a strips comments and is no longer blind to
  `app.assert_patient_required_fields` (measured 439/438/1 → **439/439/0**, clean tree still 0);
  a **SUBSET run never resets** (the guard is `SUBSET`, not the counter — a `SUITE=` spike fired 8
  destructive resets); `BASE_S_OVERRIDE` honoured only under `SELFTEST=1` and forced into SUBSET;
  both preflight arms now fail **closed** on a query that cannot answer; `Tests=` settled at
  **8876** by measurement. Every fix re-proven with a bare exit code and a negative control.
- ⛔ **No production function, policy, migration or seed changed** — measured:
  `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` is **empty**, so the
  diff-scoped door sweep is not owed.

### In progress
- Nothing. Both fix-loop commits are landed and the gate has been re-run on a fresh reset.

### Next
- **QA re-check** of fix-loop iteration 1 (this unit creates and edits nothing under
  `docs/reviews/`) → **PO approval** → the **Record step**. ADR 0189 stays `**Status:** proposed`
  until the PO approves it there.

### Blockers
- **None.**
- ⚠ Two **stated limitations**, not blockers. (1) Arm 4b's `NOT RUN` path is unproven — it needs
  both baseline sources absent, which a working tree cannot produce without a change outside this
  unit's scope. (2) The **retry net is no longer provable on a subset run**: its mechanism is the
  reset, so the F-MAJOR-2 gate makes its 2026-09-04 end-to-end proof unreproducible without a real
  full sweep. Its gate polarity is proven instead against the shipped `periodic_reset` text with an
  instrumented reset command, and the report note no longer claims a reset that did not happen.
