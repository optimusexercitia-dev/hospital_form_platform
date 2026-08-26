# ADR 0153 — A subset door-sweep writes to scratch; the committed baseline is never opened for write

- **Status:** ACCEPTED 2026-08-26 (AFF4 pre-step P3).
- **Amends:** 0079 (retires Amendment 1's operational hazards 1 and 2).
- **Source follow-up:** `FUP-DOOR-SWEEP-DESTROYS-ITS-OWN-BASELINE`.

## Context

`p0-authz-door-audit.sh` emitted its report through a truncating redirect onto the **committed**
`docs/reviews/authz-door-audit-findings.md`. The diff-scoped run CLAUDE.md §6 step 1 mandates **every
phase** sweeps only that phase's gates, so the redirect replaced the full audit with the subset —
measured 699 → 90 lines during AFF3, and 700 → 89 again in this ADR's own positive control.

**The failure mode is self-concealing.** `FROMFINDINGS=1 ARM=wrapper` — itself a phase-gate arm —
compares the committed file against an allowlist and re-measures nothing. Against a truncated file it
sees fewer gates, finds every one allowlisted, and reports `HOLDS`. **The arm gets greener as the
baseline gets emptier.** The only thing standing between a phase and this was that the operator
remembered an instruction buried in an unrelated item's body — the shape this repo exists to convert
into a check.

## Decision

- **D1 — with `CASES=` set, `FINDINGS` and `BLINDS_TSV` resolve to scratch under `$WORK`**
  (`*-findings.SUBSET.md`, `blinds*.SUBSET.tsv`). The committed path survives in `FINDINGS_COMMITTED`
  so the messages promising it is untouched can name it. A full run is unchanged.
- **D2 — the intent is also measured, not only stated.** `FINDINGS_COMMITTED` is `cksum`-ed at startup
  and re-checked in an EXIT trap; a mismatch escalates to exit 2. Repointing a variable states the
  intent; the trap observes the outcome. *An exclusion is only as strong as its weakest mutator.*
- **D3 — the fix is bounded by the PROPERTY, not the filename in the follow-up.** The property is
  *"writes a repo-tracked artefact through a truncating redirect, in a filterable run mode, that a
  later arm reads back as a baseline."* Four sweeps hold it and all four are fixed:
  `p0-authz-door-audit.sh`, `p0-authz-rowdoor-audit.sh`, `p0-authz-writepath-audit.sh`,
  `p0-authz-invoker-audit.sh` — the last being the one `FROMFINDINGS=1 ARM=wrapper` actually reads.
  Fixing only the named script would have been *sweeping one sibling axis and reading it as the class*.
- **D4 — `p0-authz-invariant.sh` clears `CASES` for all four child invocations.** It never declared the
  variable, so an **exported** `CASES` in the operator's environment was inherited into every child: each
  would run a subset, and the arm would compare a *narrower* BLIND set against the full allowlist and
  find nothing unaccounted for. Same silent-greening as the truncation, by a different route.

## The proof, and why the first attempt did not count

⭐ **The first positive control was vacuous and said so.** `CASES="referral_note_types_select"` matched
no gate: `ARM-DOMAIN predicate=0/111 policy=0/225`, exit 3 `UNPROVEN`, and the committed file survived
**for the wrong reason** — a run that measured nothing is indistinguishable, by after-state alone, from
a guard that worked. Re-run with `accreditation_frameworks_select` (a gate really in the worklist):

| same command, same case, same fresh-reset DB | committed baseline |
| --- | --- |
| **pre-change** script (`git show HEAD:…`) | **DESTROYED** — 700 → 89 lines, `cksum` moved |
| **post-change** script | **byte-identical** — `git diff --stat` empty, `cksum` unchanged |

and the fixed run **really produced** its subset report: 89 lines at the scratch path, 5 verdict rows,
`PARTIAL RUN` banner, `blinds.SUBSET.tsv` present and `blinds.tsv` absent. Both halves are required —
*"nothing changed"* is otherwise indistinguishable from *"nothing ran."* Baseline for both:
`supabase db reset` + `npm run test:db` → Files=222, Tests=7418, `Result: PASS`.

## Consequences

- ADR 0079 Amendment 1's hazards 1 and 2 are struck through and marked closed **in place**, with an
  explicit ⛔ against re-adding *"always `git checkout --` it afterwards"*: it is now false for a subset
  run, and the durable form is the **measurement** (`git diff --stat` on the findings file after a
  sweep), which is right whether or not this change is ever reverted.
- `docs/lead-playbook.md` carries the same retired instruction and is corrected in the same commit.
  ⚠ **CLAUDE.md §6 step 1 also points at "the findings-file restore"** and needs the PO's approval to
  touch — flagged, not changed.
- ⛔ **Still open, deliberately:** a **full** sweep writes through the same truncating redirect, and the
  committed findings file is **not purely generated** — it carries a hand-merged comment block of subset
  verdicts, a trailing `## Note — a RENAME moves a gate's verdict` section, and inline annotations on
  the skipped-policy bullets. A full run destroys those. Same class, different run mode; filed as
  `FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS`, whose fix is *merge instead of replace*.
  All four scripts now print a startup warning counting those blocks.
