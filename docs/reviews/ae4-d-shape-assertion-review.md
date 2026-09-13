# QA Review — AE4-D-SHAPE-ASSERTION

**Verdict: APPROVED**

## Round 1 (tip `13e871f9`)

**Verdict at round 1: CHANGES REQUESTED**

Reviewer: `qa` · Branch `ae4-d-shape-assertion` @ `13e871f9` (cut from `main @ c71e7c33`).
Scope: `supabase/tests/423_ae4_d_shape_assertion.sql`, `scripts/authz-ae4-p2-invocation-count.sql § 5`,
the hub, the record, `docs/backend-state/authorization-and-audit.md`. No migration, no `src/`
change — confirmed (`git diff --stat c71e7c33..HEAD`).

## Summary

The test engineering itself is strong: all 33 cells (`plan(33)`) have a recorded red-first
witness (verified by reading the file in full, not the record's summary of it), the
run-shape-invariant fix (`d921e8be`) genuinely removed every `raise` from `423` (`grep raise` —
zero live raises, only comments), the `is(NULL,NULL)` vacuity in `5.1` is fixed, `5.3` is no
longer an unfalsifiable cell, and clause 4's split (pgTAP `D ≤ F` / script `U = D ≤ F`) is stated
consistently in the hub AC-4, the record, the `423` header, the P2 script `§ 5` header, and the
seam. ADR 0183 `:114-115`'s hand-copy prohibition is honestly engaged, not hand-waved: I1 executes
catalog text read fresh every run (never stored), and I2 is a genuinely independent artifact
(`authz.scope_reaches`, pinned by `412`), not a restatement of the producer's `CASE`. D3 trigger
3's "`423 § 2.5`" claim checks out at that exact cell (lines 455–480).

The block is **documentation staleness**, not the test itself — two committed facts that the
unit's own later work already contradicts and never went back to correct.

## BLOCK / MAJOR

- **MAJOR — the hub's Current State is stale and states a false blocker.**
  `docs/features/ae4-d-shape-assertion.md` was last touched at commit `a6d52b82` (`git log --
  docs/features/ae4-d-shape-assertion.md`), which predates both the abort-fix (`d921e8be`) and the
  record entry that closed gate step 1 (`13e871f9`, "the set-valued arm CLEAN with `423` in its
  reddened set"). At HEAD the hub still reads (§ Blockers): *"The set-valued arm must return CLEAN
  with `423` in both cases' `reddened:` list before QA"* and (§ In progress) *"backend is making
  `423` capture-then-assert… the arm is re-run by the lead afterwards"* — both already done and
  recorded. CLAUDE.md §7: the hub is the **summary** a reader trusts without opening the record;
  as written it tells a reader gate step 1 is still open when it closed at `13e871f9`. Fix: replace
  the hub's Current State (Done/In progress/Next/Blockers) to reflect the closed gate step 1 before
  Record step.

- **MAJOR — the seam's newly appended slice states a claim the record itself retired.**
  `docs/backend-state/authorization-and-audit.md:1537-1538` (added in `ff18c314`, before the fix)
  reads: *"⚠ `0.2`/`0.3` red by REFUSING (the instrument aborts), a stronger failure mode with a
  weaker witness."* The record's final entry (`docs/progress/ae4-d-shape-assertion.md:494-496`)
  explicitly retires this exact sentence: *"The line … is retired — that was the defect, not a
  bound. Both now emit failing TAP lines carrying their reason."* Verified against the live file:
  `423:313-341` shows `0.2`/`0.3` are ordinary `ok(...)` assertions with `coalesce(...)`, no `raise`
  anywhere in `423` (`grep raise` — zero live occurrences). The appended slice was never re-synced
  after `d921e8be`, so it is committing a now-false technical claim about the instrument into a
  seam file whose maintenance rule (README §7-8) treats a posted slice as **frozen** — better fixed
  now, before it needs its own superseding marker. Fix: correct the bullet (or the whole "Every 33
  cells…" bullet) to match the post-fix behaviour before this slice is considered posted.

Per the posture rule, either finding alone requires `CHANGES REQUESTED`; both are documentation-only
and do not implicate the SQL/RLS content, which I found sound on every clause I checked.

## MINOR

- Clause 2 is asserted as an aggregate bound (`praw ≤ F` per cell, `423:428-433`) rather than a
  literal per-row "one fact ⇒ ≤ 1 candidate." Given the producer's candidate CTE is a scalar
  CASE-per-row (measured, not assumed, in the record), this is equivalent in practice, but the
  file's own stated blind spot (`423:104-105`, *"Either one alone reds"*) is not tested against a
  compensating fan-out/contraction within a single artifact (one fact over-proposes while another
  under-proposes, aggregate unchanged) — an edge case D3's named triggers don't describe either, so
  not blocking, but worth a footnote if a future trigger widens clause 2's cell.
- The Invariants bullet (`authorization-and-audit.md:58`) carries "two COPIES, not one function"
  and the trigger-3/clause-6 status, but "U measured only on the fixture" and "triggers 4–5 prose
  only" sit in the Open Edges bullet (`:70-71`) instead. Nothing is lost, just split across two
  bullets in the same Current State block — a NOTE-level nit, not a defect.

## Could not verify

- I did not independently re-run `docker exec … psql` against the live catalog to reproduce the
  record's own measurements (provider family = `{authz.assignment_facts}`, the 99-cell I1/I2
  agreement table, the P2 `§5` fixture numbers). I read `423` and the P2 script in full and audited
  their logic directly instead, which is what determines whether the *assertions* are sound; the
  record's numeric claims are internally cross-checked (I1 vs I2 agree in all 99 seed cells, and
  independently reproduce ADR 0208's own measured `D` maxima) but I did not re-derive them myself.
- I did not verify AC-9's remaining arms beyond reading the record's quoted output (four authz arms,
  SELFTEST, door sweep, set-valued arm) — those are the lead's gate-step measurements, reproduced
  here as quoted, not re-run by me.

## Round 2 (tip `dd505dfd`)

**Verdict: APPROVED**

All four round-1 items verified by measurement against `git show dd505dfd` (not read off the
record's description of them):

- **MAJOR 1 — hub, CLOSED.** `docs/features/ae4-d-shape-assertion.md` § Current state is re-cut:
  "Done since start" now names gate step 1 CLOSED (set-valued arm CLEAN, `423` in both reddened
  sets, the `d921e8be` fix, the `5.1` vacuity fix, QA r1's verdict); § In progress reads "QA r2 on
  the corrected documents"; § Blockers reads "None." No remaining claim contradicts the record.
- **MAJOR 2 — seam, CLOSED, and the mechanism is the right one.** The stale sentence
  (`:1537-1538`, "red by REFUSING … the instrument aborts") is untouched in place — correct, since
  editing it in place would itself violate the seam's own posted-section rule — and a new
  `⚠ **Superseded 2026-09-13, same unit (commit `d921e8be`)**` paragraph sits directly under it,
  states plainly that the sentence above described the pre-fix defect, names the fix mechanism
  (capture-then-assert, NULL-safe predicates, `plan(33)` always fully emitted) and points at the
  record's two entries. This satisfies the seam's own rule better than an in-place edit would have.
- **MINOR (clause 2 grain) — reasoning holds.** The record's new entry (`docs/progress/…:530-537`)
  gives the actual reason the bound is aggregate rather than per-fact: the live CTE does not expose
  a fact→candidate edge, and reconstructing one to attribute per-fact would itself be the ADR 0183
  `:114-115` hand-copy this unit is built to avoid. `D ≤ F` is stated as an aggregate in ADR 0208 D1
  itself, so asserting it at that grain is asserting the clause, not a weaker proxy of it; the
  compensating-mutation edge case is named as a residual blind spot rather than hidden. Accepted.
- **MINOR (qualifiers split) — CLOSED.** The seam's Invariants bullet (`:58`) now carries "`U = D`
  … measured ONLY by the P2 script at top level on the loaded perf fixture, one principal × one
  kind" and "D3 triggers 4–5 … `prose only`" in the same bullet as the D1 invariant and the
  two-copies-not-one-function qualifier. Nothing left only in Open Edges.

No new finding from reading these three files in full. Gates 13/16/7 reported green by the
coordinator; not independently re-run here (docs-only diff, consistent with round 1's posture).

**Nothing outstanding.**
