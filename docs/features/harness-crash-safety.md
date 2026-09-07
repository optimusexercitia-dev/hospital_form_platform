---
id: HARNESS-CRASH-SAFETY
title: Mutation-harness crash safety — a killed sweep may never leave a door open without a trace (pre-AE5 Batch 0)
status: complete
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 0 of the follow-up batches ruled 2026-09-04"
branch: ~   # landed on main 2026-09-04; PO approved at fc33a497 on the QA re-review, ff-merged
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/harness-crash-safety.md
reviews: ["../reviews/harness-crash-safety-rereview.md", "../reviews/harness-crash-safety-review.md"]
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
