---
id: DOOR-SWEEP-ARM-LABEL-CORRECTION
title: "The door sweep's two arms are named PREDICATE and POLICY — a prior record's \"arm 2 (FROMFINDINGS=1)\" row corrected by dated marker, the playbook recipe names the knob's owner"
status: gated
kind: fup-fix
program: AUTHZ
phase: "pre-AE5 remediation — a gate-record correction owed by DEFINER-SEARCH-PATH-NARROW-FIX's door-sweep finding (docs-only)"
branch: door-sweep-arm-label-correction   # cut from main @ 8949e491
plan: ../plans/authz-evolution.md
progress: ../progress/door-sweep-arm-label-correction.md
reviews: ["../reviews/door-sweep-arm-label-correction-review.md"]
adrs: ["0079", "0105", "0190"]
handoff: ~
fup: FUP-DEFINER-SEARCH-PATH-NARROW-FIX-DOOR-SWEEP-ARM-2-ROW-WAS-ARM-1-RELABELLED
---

# DOOR-SWEEP-ARM-LABEL-CORRECTION — one run, two rows, and the label that concealed it

Closes `FUP-DEFINER-SEARCH-PATH-NARROW-FIX-DOOR-SWEEP-ARM-2-ROW-WAS-ARM-1-RELABELLED`. The unit
`ARM3-HAT-TERM-FIX` recorded the door sweep as *"arm 1 (CASES=…)"* and *"arm 2 (FROMFINDINGS=1
CASES=…)"*, two rows with identical verdicts. `FROMFINDINGS` is `p0-authz-invariant.sh`'s knob and
selects its WRAPPER arm; `p0-authz-door-audit.sh` never reads it, so the second row was the first run
again. The sweep's real two arms — **predicate** and **policy** — both ran in that one invocation, and
nothing was skipped; what was wrong was a **label**, and a label is a claim (ADR
[0079](../decisions/0079-authz-door-blindness-standing-invariant.md) names the wrapper arm's knob;
ADR [0105](../decisions/0105-rename-is-tenancy-admin-of.md), *"Historical documents are NOT rewritten"*,
governs how a record is corrected). Docs-only: no migration, no `src/`, no test.

## Acceptance criteria

- [x] **AC-1 — the marker, beside the rows, never over them.** `docs/progress/arm3-hat-term-fix.md`
      carries a dated `⚠ CORRECTION 2026-09-11` blockquote directly under each of its two gate blocks
      (the `:137` and `:424` rows, byte-unchanged) saying the row was the predicate arm repeated and
      naming the policy arm's verdict from the same invocation (`ARM-DOMAIN predicate=1/127
      policy=0/226 out-of-domain-bool=35`).
- [x] **AC-2 — the recipe names the arms and the knob's owner.** `docs/lead-playbook.md` §4 names the
      door sweep's two arms **predicate** and **policy**, from ONE invocation, quoted by the
      `ARM-DOMAIN` line; names `FROMFINDINGS=1` as the WRAPPER arm's knob only; forbids the *"arm 2
      (FROMFINDINGS=1)"* row.
- [x] **AC-3 — the ledger row re-read.** `ARM3-HAT-TERM-FIX`'s *"door sweep both arms CLEAN 1/1
      COVERED"* cell carries a dated re-reading: TRUE as predicate + policy of one invocation.
- [x] **AC-4 — the claim re-measured, not inherited.** `grep -cE '\$\{?FROMFINDINGS'` over the door
      audit → **0** reads today; the entry's own quoted instrument (a non-existent `scripts/` path) is
      corrected in the closure note, not silently.
- [x] **AC-5 — register, lesson, gates.** Entry moved verbatim to the archive with its closure note;
      LEARN-104 filed; `npm run lint` 0/0.

## Current state

**Updated:** 2026-09-11

### Objective

Make the prior unit's record say, beside the mislabelled rows, what the run actually was; make the
recipe say which script reads `FROMFINDINGS`; re-read the ledger row against that.

### Done since start

AC-1 – AC-5 built. The knob's non-read re-measured on the live script. Entry archived with the
correction of its own misquoted instrument. LEARN-104 filed. Detail: the [record](../progress/door-sweep-arm-label-correction.md).

### In progress

QA r1 **APPROVED** (0 BLOCK / 0 MAJOR / 1 MINOR, corrected) → awaiting human approval.

### Next

On approval: hub → `complete`, ledger row appended, `phase(DOOR-SWEEP-ARM-LABEL-CORRECTION): complete` commit, fast-forward `main`.

### Blockers

None.
