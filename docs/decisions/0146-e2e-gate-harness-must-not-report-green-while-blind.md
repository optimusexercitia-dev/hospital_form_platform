# 0146 — The E2E gate harness must not report green while blind

**Date:** 2026-08-25 · **Status:** Accepted (PO, 2026-08-25) · **Owner:** backend + tester
**Supersedes:** nothing. **Amends:** nothing.
**Relates:** ADR 0067 (lint gates) · 0079 (standing invariants) · 0124 (the progress contract) ·
`docs/testing/e2e-prod-build-gate.md` · the follow-ups
`FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH` and
`FUP-E2E-GATE-CLASSIFIER-BLIND-TO-WORKER-CRASHES`.

## Context

`npm run e2e:prod` is the only artifact that can declare Phase Gate step 2. PDF·P3's run stood at
**RED (UNRUN)** with 36 tests never executed and **zero assertion failures**, and the phase spent
real time proving the collapse was pre-existing Windows infrastructure rather than a product defect.
Investigating it exposed defects in the **instrument**, not the subject — and they share one shape:
**the gate could report a number that reads like coverage while measuring less than it claims.**

Four were measured. Two were fixed as harness behaviour; **two are false-GREEN mechanisms**, found
by building reproductions rather than by reading the script.

## Decision

**A gate is not allowed to be green and blind at the same time. Where the harness cannot know, it
must say so in the run output, and where it can be wrong in the passing direction, that path is
closed.** Concretely:

1. **`free_port` selects listeners structurally, never by matching the State word.** The old
   `netstat -ano | grep ":$PORT "` matched the port in the **Foreign** column, returning client PIDs
   with zero LISTENING rows — and `taskkill //F` on those killed **Playwright workers**. The
   replacement requires: TCP, local port **equal** (not substring), foreign endpoint a wildcard, PID
   numeric and non-zero.
   ⛔ **`grep LISTENING` was rejected, and the reason is the decision.** The State column is
   **localized** — a pt-BR Windows host prints `ESCUTANDO` — so a literal match **fails OPEN**:
   `free_port` would stop killing the stale server, `curl /login` would then succeed against it, and
   the batch would silently run **against a stale build**. LISTENING is instead identified as the
   only TCP state whose foreign endpoint is the wildcard, reading only columns that cannot move.
2. **Evidence is retained per batch and per attempt, and surfaced on the path that classifies.** One
   truncating `server.log` meant the `server_dead` case — *the condition the INFRA classifier exists
   to detect* — left no server-side artifact. Logs are now per batch/attempt, tailed on the INFRA
   path rather than only on start failure, and `gate-exit` is written by a `finish()` function wired
   into every exit plus INT/TERM, **seeded `RUNNING` at startup** so the file is never simply absent.
3. **Both measured false-green mechanisms are closed** (see below), each pinned by its own
   reproduction.
4. **All 13 pre-existing exit codes are preserved byte-for-byte**, and batching, retries,
   classification thresholds and reconciliation arithmetic are untouched. This is the boundary the
   PO's earlier ruling drew — *"not authority to change what the gate MEASURES"* — and it is
   respected in the direction it was drawn: **these changes can only make the gate stricter.**

## The two false greens, measured

- **A — `start_server` can attach to a foreign or stale listener.** The wait loop probes
  `curl /login` **before** `kill -0 "$SERVER_PID"`. If the spawned server dies instantly
  (`EADDRINUSE`) while something else already answers the port — an engineer's `next dev`, or a
  previous run's orphan **serving a stale build** — curl succeeds on the first iteration and
  `start_server` returns 0. Measured on a reproduction: **`GATE GREEN`, `gate-exit` = 0, and
  `server_dead` printed zero times**, because the classifier only evaluates it when failures > 0.
  ⇒ Check liveness **before** the first probe; a build nonce answers the second, different question
  (*are these the bytes I built*) that a port check cannot.
  ⭐ **Three questions, three mechanisms, deliberately not conflated:** *is my process alive*
  (`kill -0`, re-checked **after** the port answers), *is my process the one answering* (the listener
  on the port is owned by my pid — the same parser from Decision 1), and *are these the bytes I
  staged* (a nonce written into the staged `public/` tree and fetched back with the `BUILD_ID` that
  answered). A port check answers none of them on its own, which is how A existed at all.
  ⚠ **Bounded, and the bound must not be over-read:** the nonce proves the answering process serves
  the tree **this run staged** — *not* that the tree is fresh relative to source. It narrows the
  documented `REBUILD=1` stale-build trap; it does not close it.
  ⛔ **Arms that cannot CONCLUDE warn and proceed, and there is a `SERVER_IDENTITY=warn` escape
  hatch that downgrades even a definitive mismatch. Both are decisions, not implementation detail,
  and the honest reason is on the record:** the served-nonce path could not be exercised without a
  real build, and hard-failing an ~80-minute gate on an arm nobody had ever run would be the worse
  failure. ⚠ This repo's own lesson applies against itself here — *an escape hatch for the
  unmeasurable also silences the measured* — so the hatch is **off by default**, and the first real
  run is treated as the arm's first exercise rather than as evidence it works.
  ⭐⭐ **The arm's THIRD answer is part of the contract, not an implementation detail — and the first
  real build proved why.** *"I did not receive a nonce"* and *"I received one and it differs"* are
  different facts, and the arm shipped conflating them: a smoke run against a real build had the
  middleware auth gate (ADR 0007) redirect the nonce request, so the arm received
  `/login?redirect=…`, called it a **definitive mismatch** — its strongest verdict — and took the
  batch down. **13/13 keystone assertions had passed**, because every fixture fed it a *server* and
  none fed it an *auth gate*: the suite proved the logic, the real build proved the assumption.
  ⛔ Fixed as a **discrimination** problem — conclude *mismatch* only on a nonce-shaped body;
  redirect / HTML / 401 / empty ⇒ inconclusive — and **never** by downgrading mismatches to
  warnings. The keystone now pins **both** directions, so a future "just make it warn" collapses it.
  The same conflation then turned up in the sibling ownership arm, where a listener owned by a
  **child** of our own server read as *owned by a stranger* and hard-failed.
  ⛔ **Do not fix this class by widening the app.** Adding the nonce path to the middleware matcher,
  and attaching `BUILD_ID` to the unauthenticated health endpoint, were both rejected: the middleware
  is the security boundary, so the harness adapts to the app and never the reverse. The nonce lives
  under `_next/static` — excluded by **name** rather than by extension, and staged *with* the build
  output, which is a better answer to *are these the bytes I staged* anyway.
  ⚠ **Smoke-run first, always.** One spec against a real build cost 6 minutes and found what the
  keystone suite could not; the same discovery inside the full run would have cost ~80.
- **B — a failed `--list` silently disables coverage reconciliation for that batch.**
  `expected_tests` had **no fallback**, unlike `pack_batches`, which guards `[ -z "$n" ] &&
  n=$BATCH_TESTS` for exactly this reason. With `exp=0` the per-batch identity check is skipped
  *and* `TOTAL_EXPECTED += 0`. Measured: a batch that really held 60 tests ran 3, exited 0 →
  **`GATE GREEN`, `COVERAGE: accounted for 3 of 0`.** In a 21-batch run the other batches supply
  real numbers, so the identity breaks in the direction that **hides missing tests**.
  ⇒ Give it the fallback — and ⛔ **make the fallback loud.** A guessed denominator nobody is told
  about is the same defect with a nicer number.

## Consequences

- ⭐ **Every claim here is pinned by a reproduction, and the reproductions are committed** — the
  parser keystone runs over **captured real `netstat` output** in both directions, with five mutants
  each reddening a specific group (including an emit-nothing mutant that reds the positive controls
  — the vacuity proof), and a section that re-runs the **old** selector and asserts it misbehaves, so
  the fixtures cannot silently stop reaching the defect. The retention harness and the false-green
  reproductions ship too: **a reproduction of a known false green is worth more than its fix**,
  because it is what catches the fix being undone.
- ⛔ **Bounds, stated rather than implied.** No run against a real Next standalone server, real DB or
  the real suite — so retention of a **real** V8 death is *expected* rather than shown. The `lsof`
  POSIX branch is unexercised and labelled so in-code. An unwritable `$GATE_LOGDIR` is untested. And
  *"no Playwright worker is killed any more"* is **NOT** demonstrated: only that the selector no
  longer returns client PIDs. `FUP-…-WORKER-CRASHES`'s *firing UNOBSERVED* status is unchanged.
- ⚠ **Shell and awk are covered by no repo gate.** `npm run lint`'s ten gates see JS/TS, CSS vars,
  migrations, the trackers and the ADR index — the file that decides whether a phase may close is
  checked only by `bash -n` and the two keystones above. Recorded as a known hole rather than fixed
  here; the keystones are the mitigation.
- The Windows collapse itself (p ≈ 0.57 per server start) is **not** addressed by any of this. It
  remains pre-existing infrastructure that batching mitigates and does not eliminate, and it must
  never be attributed to the phase under test.

## Alternatives rejected

- **`grep LISTENING` / `grep -v` on the State column** — fails open on a localized host, in the
  direction that runs the suite against a stale build. See Decision 1.
- **Suppressing the `server_dead` INFRA classification to make runs cleaner** — that is the
  carve-out the PO's ruling forbids, and it converts a visible infrastructure red into an invisible
  one.
- **Leaving A and B as follow-ups** — considered, because both were discovered while fixing something
  else. Rejected: a gate whose green can be false is not a gate, and the phase's remaining step is
  precisely to trust one green from it.
