# ADR 0128 — "I could not look" gets its own exit code, its own name, and its own acknowledgement

- **Status:** ✅ ACCEPTED 2026-08-19
- **Closes:** `FUP-DM5-NO-ANSWER-VS-NOTHING` **instance 1** — the last unfixed instance of
  the class, and the one its own body called *"the remaining surface"*.
- **Amends:** ADR **0120 D9** (the manifest tool's operator contract). Does not touch D9's
  ordering invariant, which is untouched and still binding.
- **Subject:** `scripts/storage-manifest.mjs` — `capture`'s exit codes and flags.

## Context

`capture` classified every bucket into exactly two buckets — clean, and *not clean* — and
offered exactly one escape hatch, `--allow-orphans`, which accepted *not clean*. That one
flag therefore accepted two facts that must never be confused:

| what the tool actually observed | what the single flag recorded |
| --- | --- |
| **"I could not look."** No byte-level measurement happened (`UNVERIFIED_NO_LOCAL_PROOF`, `UNVERIFIED_PROOF_ERROR`) | acceptable |
| **"I looked, and the API and the volume disagree."** (`ORPHANED_BYTES`, `MISSING_BYTES`, `DIVERGED_BOTH_WAYS`, `BUCKET_ABSENT_ORPHANED_BYTES`) | acceptable |

On Supabase Cloud the local volume proof **cannot exist** — measured, not inferred: every
Cloud surface is metadata-bound
([cloud-orphan-probe-2026-08-18.md](../progress/cloud-orphan-probe-2026-08-18.md)). So every
bucket verdicts `UNVERIFIED_NO_LOCAL_PROOF` and a **perfectly healthy project exits 1**. The
only route to a usable exit code was `--allow-orphans` — which also silenced the genuine
findings the tool exists to produce. **The operator who wanted an exit code had to buy
blindness with it.**

⚠ **A second conflation nobody had filed, found by diffing the flag's name against its
reach:** `--allow-orphans` equally accepted `MISSING_BYTES` (bytes destroyed while the
metadata still advertises the file as present and servable — under Rule 12 the *worse*
direction) and `DIVERGED_BOTH_WAYS`. Neither is an orphan. A flag that accepts more than its
name says is this same class one layer up.

## Decisions

**D1 — Three classes, not two, and they PARTITION the verdict codomain.**
`CLEAN_VERDICTS` · `UNPROVEN_VERDICTS` ("I could not look") · `DIRTY_VERDICTS` ("I looked and
found a disagreement"). Every verdict has exactly one home. This is the part aimed at the
*next* instance rather than this one: the original defect was a codomain that grew to nine
verdicts while the classification stayed binary, so each new verdict silently inherited
"not-clean ⇒ suppressible".

**D2 — `capture` exits `3` for UNPROVEN.** `0` clean · `1` **dirty (a finding)** · `2` error ·
**`3` unproven (no answer)**. The distinction now exists at the only place an automated caller
can see it. A Cloud run's *normal* outcome is 3, and 3 does not mean anything is wrong.

**D3 — DIRTY OUTRANKS UNPROVEN.** A run that is both exits **1**, including under
`--allow-unproven`. A finding never hides behind a no-answer. This single rule is the whole
content of the fix; everything else is the vocabulary that lets it be stated.

**D4 — Two acknowledgements, each naming exactly one fact.** `--allow-unproven` accepts the
absence of a proof and leaves every dirty verdict fatal — this is what a Cloud run wants.
`--allow-dirty` accepts a **proven** divergence, for deliberately recording a known-divergent
state as a baseline. **There is deliberately no flag that accepts both without saying so**; an
operator who wants both writes both, and the manifest records which were used.

**D5 — `--allow-orphans` is REFUSED by name, never aliased.**
Aliasing it to `--allow-unproven` was the one-line option and was **rejected**: the flag's
defect was the *muscle memory* of reaching for it to get a green bar, and an alias keeps that
working. The refusal costs one read of a message and buys the decision the single flag never
let anyone make. Pinned by selftest **C23**, which also requires the message to name both
successors — a refusal that does not say what to use instead gets worked around, not read.

**D6 — The outcome is written INTO the manifest** (`manifest.outcome`: per-class counts,
`accepted`, `exitCode`, `byteProofAvailable`). The runbook's standing rule — *never automate on
the exit code or the headline* — was correct against a binary signal that could not say why it
was non-zero. ⚠ It does **not** certify bytes: `accepted` naming `unproven` is precisely the
statement that no byte proof was obtained.

**D7 — `selftest`'s pure controls run BEFORE the docker gate.** `selftest` used to
`process.exit(2)` on the docker gate before running anything, so on every machine a **Cloud
operator** uses, the number of controls that ran was **zero** — while a third of them needed
nothing but the functions under test. The pure half now always runs; the byte-level half
reports **SKIPPED with a count** when docker is absent, and the command still exits non-zero.
*"Nothing failed" is not "nothing ran."*

## Controls — all observed RED against the pre-fix behaviour before being accepted

| control | pins |
| --- | --- |
| **C19 / C19b** | the three sets partition the codomain (C19), and `ALL_VERDICTS` is checked against what `verdictFor` *actually returns* rather than against itself (C19b) |
| **C20** | `--allow-unproven` does **not** silence a dirty verdict — **the filed defect** |
| **C21** | its permissive twin: it *does* accept an unproven-only capture, and its absence yields **3**, not 1 |
| **C22 / C22b** | dirty outranks unproven; `--allow-dirty` is narrow in the other direction too |
| **C22c** | an unclassified verdict fails **closed** and neither flag can accept it (the runtime half of C19) |
| **C23** | the retired flag is refused, not aliased, and the message names both successors |
| **R6-capture / R10 / R10b / R10c** | the same claims end-to-end through argv → real bucket → real volume |

**Red-first evidence (2026-08-19).** Three mutants of the shipped file were built and run:
restoring the pre-fix binary classification reddened **C20, C21, C22, C22b, C22c** (13/18);
re-admitting `--allow-orphans` as an alias reddened **C23** (17/18); removing one verdict from
its class set reddened **C19** (17/18). Unmutated: **18/18**.

**Green evidence (2026-08-19, local stack up).** `selftest` **26/26** (18 pure + 8 byte-level).
`rehearse` **25/25**, with the four CLI arms measured rather than reasoned:
`R6-capture` blind → **exit 3** `UNVERIFIED_NO_LOCAL_PROOF` against its sighted twin `CONSISTENT`
exit 0 · `R10` a real orphan **under `--allow-unproven`** → **exit 1**, `accepted: []` ·
`R10b` same orphan under `--allow-dirty` → exit 0, `accepted: ["dirty"]` ·
`R10c` blind under `--allow-unproven` → exit 0, `accepted: ["unproven"]`,
`byteProofAvailable: false`. **R10 is the load-bearing one** — before this change that exact
state exited 0.

## Consequences

- ⚠ **`--allow-orphans` in any script or runbook step now exits 2.** The only occurrences were
  documentation, updated with this change; no CI or gate invoked it.
- `docs/deployment/phi-disposal-runbook.md` §6 carried the old semantics as a **rule** for Cloud
  operation; it is rewritten. The refusals it states are unchanged in substance.
- ⛔ **This does not manufacture a proof that does not exist.** On Cloud there still is none, and
  ADR 0121 **D4**'s `unavailable_on_platform` remains the honest disposal-record value. What
  changes is that the *tool* now says which of the two things happened, in a form a caller can
  act on. That is the whole content of the `NO-ANSWER-VS-NOTHING` class: an observable proxy
  substituted for the property that matters, always failing in the reassuring direction.
- **The transferable rule, stated for the next reviewer:** *a classifier that can return a
  reassuring value must have a distinguished "could not determine" value, and the reassuring set
  must be provably disjoint from it.* Where an acknowledgement exists, it acknowledges one class
  — never "everything that is not clean".
