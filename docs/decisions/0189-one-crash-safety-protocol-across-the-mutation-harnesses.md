# ADR 0189 — One crash-safety protocol across the mutation harnesses: a verified restore, a bounded sweep, and both preconditions of a verdict

**Status:** proposed
**Date:** 2026-09-04 (unit HARNESS-CRASH-SAFETY, Batch 0 of the pre-AE5 follow-up batches)
**Area:** authorization / mutation harnesses / crash safety
**Amends:** ADR [0171](./0171-c2-tier1-regrain-and-the-command-door-neutralizer.md) (the C2
neutralizer's design — its restore, its preflight and its subset rule) · ADR
[0153](./0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) (what counts as a
*subset* run: narrowing the DOMAIN counts too, not only narrowing the cases)
**Related:** ADR [0079](./0079-authz-door-blindness-standing-invariant.md) (a verdict is
meaningless without its domain) · `FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE` ·
`FUP-AUTHZ-HARNESS-PRECONDITIONS` · `FUP-AUTHZ-HARNESS-TRANSACTIONAL` (**closed 2026-09-04 by PO
ruling**, D7 — archived in `docs/followups/follow-ups-archive.md`) ·
`FUP-C2-NEUTRALIZER-TAIL-DRIFT-INVALIDATES-LATE-VERDICTS` ·
`.claude/rules/mutation-harnesses-are-not-killable.md` · record
`docs/progress/harness-crash-safety.md`

> **Number.** 0189 = the highest number on **any** live branch + 1, verified by enumerating
> `docs/decisions/` across every `refs/heads` and `refs/remotes` ref rather than trusting the
> index's next-free line: `main` tops out at **0188**, `authz-harness-crash-safety` at **0188**,
> `origin/authz-c2-tier1` at **0180**. No `0189-*.md` exists on any ref. This project has taken
> the index's next-free number into a collision twice (0180, 0183), so the number is re-verified
> at commit time.

## Context

Five harnesses under `supabase/tests/mutation/` mutate the **live, committed** catalog and then run
the pgTAP suite as a **separate process**. That commit-then-restore design is *required* by the
probe's process boundary (ADR 0171; the 2026-08-17 amendment on
`FUP-AUTHZ-HARNESS-TRANSACTIONAL`) — a neutralization held inside an uncommitted transaction is
invisible to `supabase test db`, so every case would classify COVERED and the sweep would be 100 %
green and 100 % vacuous.

The price of that design is that **process death can leave an authorization gate open**. On
2026-09-04 it did: a C2 sweep launched under a 10-minute tool timeout was killed mid-run, and
`public.cancel_event` sat with both anchored `HC044` custody raises rewritten to `null;` for about
four minutes. Local dev database only, single owner, and the ADR 0153 baseline guard held
throughout. ⛔ **The exposure is not the finding; the silence is** — both of that harness's
crash-safety mechanisms failed for its own mutation shape.

Four open follow-ups converge on the same instrument. This ADR records the protocol they close on,
and — as importantly — records **two of their own close conditions as measured vacuous**, so that
the next reader does not implement the vacuous version in good faith.

## Problem

1. **A recovery path disarmed by the failure it exists to survive.** `restore_inflight` truncated
   the sentinel *unconditionally* after `psql_f`. A kill takes the restoring `psql` in the same
   process group, so the restore does not happen and the record that it must be redone is erased in
   the same breath. Measured that day: `INFLIGHT.sql.body` still held the real 1194-byte body at
   09:38 while `INFLIGHT.sql` was 0 bytes at 09:39. **All five harnesses had the same shape.**
2. **An exit-status check that reads a constant.** C2's `psql_f` carried no `-v ON_ERROR_STOP=1`,
   so psql exits **0** on a SQL ERROR. Witnessed: `select 1/0;` exited 0 before the fix and 3
   after. "Check the restore's exit status", bolted onto that, is a **dead instrument wearing the
   name of a guard**.
3. **A preflight blind to its own harness's shape.** `DEGEN`'s three forms all match a *whole body*
   replaced by a constant — the boolean-gate audits' shape. The C2 rewrite is `raise … ;` → `null;`
   *inside* an otherwise intact body, which matches none of them.
4. **A verdict with one precondition checked of two.** `FUP-AUTHZ-HARNESS-PRECONDITIONS`: baseline
   green was asserted, keystone-present-in-the-swept-domain was not — and *"nothing noticed the
   gate opening"* is indistinguishable from *"nothing that could notice was running"*.
5. **Drift converted to ERROR instead of bounded.** A ~9.5 h sweep captures `BASE_S` once, at the
   top; the existing guards make late drift visible but the tail is simply not measured.
6. **A subset that was not treated as one.** `SUITE=` narrowed the domain but not the report
   target, so a narrowed run swept the full 171 against a one-file suite **and truncated the
   committed baseline** — a live ADR 0153 violation, found in passing.

## Decision

### D1 — A restore is believed only when the CATALOG agrees

`restore_inflight` clears the sentinel only when **both** hold: `psql_f` exits 0, **and** a probe
re-read **from the catalog** returns exactly the value captured *before* the gate was opened
(`md5(pg_get_functiondef(oid))` for a function; `md5(qual||'|'||with_check)` for a policy).
Anything else — a failure, a mismatch, or a sentinel whose verification sidecars are absent —
**keeps the sentinel** and returns 2.

⛔ **"Cannot verify" resolves to "do not clear".** An escape hatch for the unmeasurable would also
silence the measured.

⛔ The probe never hashes the local restore file: that file is what we are trying to apply, so
comparing it against itself proves nothing about the database.

The snapshot writes its sidecars **before** the sentinel becomes non-empty, because a non-empty
sentinel is what *arms* it: dying between the two leaves a sentinel that cannot be verified, which
refuses — the safe direction.

### D2 — One design, and it NAMES the harnesses it does not cover

C2 gains `RECOVER=1`, ported from `p0-authz-door-audit.sh`, so all three sentinel-bearing harnesses
refuse to start on a contaminated stack and offer the same two remedies in the same words.
`p0-authz-invoker-audit.sh` and `p0-authz-rowdoor-audit.sh` have **no sentinel at all** and are
explicitly **out of scope**, filed as `FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL`
and named in the rule file. ⛔ A fix at three of five sites otherwise reads as a fix of the class.

### D3 — The `DEGEN` preflight gains an arm for THIS harness's residue, in two halves

⛔ **The follow-up's own formulation is vacuous, and is deliberately not what was built.** It asks
for *"an enforcer in the derived worklist whose current anchored-raise count is below its recorded
`nraise` — a per-run derivable property"*. It is not per-run derivable: the worklist derives
**both** columns from the live `pg_proc.prosrc` **in the same instant**, so on a stranded stack the
recorded number is the already-reduced one and the check compares a number to itself. Worse, a
*fully* stranded enforcer loses its last errcode of the class, drops out of the population filter,
and **leaves the worklist entirely** — the total slides 171 → 170 and there is nothing left to
compare against.

- **4a — residue shape, baseline-free.** A bare `null;` in a statement position, in a body that
  carries **no** errcode of the anchor class. `mutate()` is all-or-nothing (it aborts when any
  errcode survives), so a function it stranded has lost *every* anchor-class errcode; that conjunct
  is the discriminator, and it is a **property**, never a name list. ⛔ **Measured on a fresh reset
  before choosing the shape, never assumed:** the residue shape alone matches **3** functions, and
  the obvious narrow shape `then null; end if` matches **1** (`public.confirm_triage`, a deliberate
  no-op branch) — so shipping "this count must be 0" on the obvious shape would have red-flagged a
  clean tree on its first run. With the errcode conjunct the clean-tree population is **0,
  enumerated to zero rows**, and the arm was then proven to return exactly one row against a real
  strand.
- **4b — persisted expectation.** The derived worklist is compared against a recorded one (a
  scratch sidecar, else the committed findings table, which is version-controlled so a wiped
  `TMPDIR` cannot silently disarm the arm). Only a **reduction** fails — a strand always reduces;
  growth refreshes the record and says so. With neither source the arm prints **NOT RUN**, never
  "clean": an arm that compared nothing must not read like an arm that agreed.

### D4 — Both preconditions of a verdict are asserted AND PRINTED

The report header and the run's summary banner carry `domain:` and `worklist: N of TOTAL` beside
the counts, so a tally cannot be read without the conditions it was measured under. Under a
narrowed `SUITE=`, a mutated run that **passes** is recorded `ERROR — NARROWED DOMAIN`, never
`BLIND`. ⭐ A `COVERED` under a narrowed domain **stays a verdict**: the red-then-green pair proves
the keystone was in the domain and did notice. Only the negative needs the full domain.

### D5 — `SUITE=` makes a run a SUBSET (this is what amends ADR 0153)

ADR 0153's decision is unchanged; its **scope** is. A run is a subset when **either** axis is
narrowed — the cases swept **or** the domain swept — and a subset writes to scratch.

### D6 — Drift is bounded, not merely detected

`RESET_EVERY` (default 20; `0` disables) resets the database inside a long sweep and re-captures
the baseline shape, and any `SHAPE changed` / `did not come back green` ERROR triggers one
reset-and-retry before it is recorded. Every reset is interlocked: it **refuses** while a mutation
is in flight, re-runs the preflight arms afterwards, and re-derives the worklist, aborting if the
tree moved under the run.

### D7 — Detect-only is the accepted posture, by PO ruling — and self-healing is explicitly NOT a requirement

`FUP-AUTHZ-HARNESS-TRANSACTIONAL`'s residual was escalated as question Q2 of this unit's plan and
**ruled by the PO on 2026-09-04: detect-only**. The entry is therefore **closed on the ruling**, not
left open and not parked. The ruling, verbatim:

> "The filed fix (one rolled-back transaction) is unbuildable and would be worse than the bug — the
> probe is a separate process, so every case would classify COVERED against the original gate: a
> sweep 100 % green and 100 % vacuous. The detect-only posture is accepted for the mutation
> harnesses: process death may still leave a gate open, and the guarantee is that it cannot do so
> unnoticed — a verified restore, a sentinel that survives its own failed restore, `RECOVER=1`, the
> degenerate-body preflight before every arm of `p0-authz-invariant.sh`, and
> `supabase db reset --local` as the blunt certain remedy. Self-healing is explicitly not a
> requirement. Re-open if a harness is ever run against a database with more than one owner."

Three things this decision fixes, so that a later reader cannot re-derive them wrongly:

1. **Nothing in this ADR makes a harness self-healing, and none of it is offered as such.** Process
   death can still leave a gate open; the guarantee is that it can no longer do so **unnoticed**.
   ⭐ That is now a *stated requirement boundary*, not an unfinished edge — the difference matters,
   because an unfinished edge invites a future session to "finish" it.
2. ⛔ **The committed marker was measured BUILDABLE, and was NOT built by decision — never by
   inability.** `mutate()` runs its DDL inside a single `DO $outer$ … $outer$;`, so a row inserted
   in that block is atomic with the neutralization; a home outside the `drop … cascade`d `c2n`
   schema was already selected, and the two rejected homes (`comment on function`, `alter database
   set`) were rejected on measured grounds, not taste. The lead's recommendation to the PO was to
   **build** it. It was **considered and not taken** — see Considered options.
3. **Re-open trigger, in the ruling's own words:** *re-open if a harness is ever run against a
   database with more than one owner.* Single-owner local stacks are the only place these harnesses
   run today, and `supabase db reset --local` is the blunt certain remedy there.

⚠ The §2.4 in-flight interlock therefore checks `[ ! -s "$INFLIGHT" ]` **only**. The "zero marker
rows" half of the planned interlock was dropped with the marker: a guard that queries a table which
does not exist is not a weaker guard, it is a broken one.

## Considered options

- **Make the neutralization one rolled-back transaction.** ⛔ Unbuildable here and worse than the
  bug — the probe is a separate process (Context).
- **A committed marker row written inside the mutating transaction** (`c2n_sentinel.inflight(oid,
  label, orig_def, mutated_at)`, in a schema the run does not drop; inserted inside `mutate()`'s
  `DO` block, deleted inside the restore's). ⛔ **BUILDABLE — rejected by PO ruling, not by
  inability** (D7). Its one real advantage, which the file sentinel does not have: **the marker
  cannot be separated from the damage.** A file sentinel is defeated by a different `TMPDIR`, a
  different machine, or a cleaned scratch directory, and it dies with the disk it sat on; a row in
  the same database as the open gate travels with it, and its `mutated_at` **dates** the
  neutralization — closing the forensic gap that `pg_proc` carries no mtime, which is exactly what
  cost this unit's incident its lower bound. Its cost, and the reason the ruling declines to pay
  it: a **persistent scratch schema** in the same database as the production migration lineage,
  surviving every reset that `c2n` does not, needing its own grants, its own pgTAP-surface
  exemption, and its own answer to *"what does an empty table mean — clean, or never armed?"* ⭐ The
  arm-4b `NOT RUN` distinction shows that question is not rhetorical.
- **Detect the strand by live `nraise` vs the worklist's `nraise`, as the follow-up filed it.**
  ⛔ Vacuous by construction — D3.
- **Allowlist `public.confirm_triage` out of arm 4a.** ⛔ Rejected: allowlisting a subject is what
  *makes* an arm blind, and it would blind the arm to a real strand of that very function. The
  errcode conjunct discriminates by property instead, and measures 0 on a clean tree.
- **Keep the exit-status check without `ON_ERROR_STOP`.** ⛔ A check that can only ever read 0.
- **Reset every N enforcers as the ONLY tail-drift fix.** Rejected as *only*: the
  reset-and-retry net also recovers the three enforcers run 1 lost, and costs nothing when nothing
  drifts.
- **A sentinel that records only "attempted".** ⛔ That is what `p0-authz-writepath-audit.sh` had,
  in its own words. "Attempted" and "verified" differ exactly where it matters.

## Consequences

- Every restore path in the three sentinel-bearing harnesses costs one extra catalog read: on a
  171-enforcer sweep, ~171 additional sub-second queries against ~9.5 h of suite runs.
- A failed restore now **stops** the run and leaves the stack contaminated **on purpose**, with the
  sentinel as the record. That is the deliberate trade: a loud stop over a quiet sweep.
- `RESET_EVERY=20` adds **≈ +28 min on a ≈ 9.5 h sweep (≈ +5 %)** — **measured**, not estimated:
  `supabase db reset --local` took **49–54 s** on two runs, one full pgTAP suite **87 s**, and
  worklist re-derivation **≈ 60 s**, over the 8 resets a 171-enforcer worklist fires at N=20. (The
  plan's estimate was +40 min / ~7 %; the measured figure replaces it.) Subsets never reset — the
  counter cannot fire on a worklist shorter than N.
- Sentinels written before this protocol carry no probe sidecar and therefore **cannot** be
  verified; `RECOVER=1` says exactly that instead of reporting a success it did not measure.
- **All four converging follow-ups are now closed** and rotated to
  `docs/followups/follow-ups-archive.md` — three on a built mechanism proven able to fire, and
  `FUP-AUTHZ-HARNESS-TRANSACTIONAL` **on the PO ruling in D7**, with that ruling's re-open trigger
  carried on the archived entry. ⚠ A ruling is a decision, not a measurement: it goes stale the day
  its premise (one owner per database) does.
- Two of the four follow-ups' own close conditions are recorded as vacuous and amended **in place**
  with a dated paragraph beside the original sentence. A register's failure mode is prose rot, so
  an amendment must be visible as an amendment rather than a silent rewrite.
- The harnesses are still **periodic audits, never phase steps**. Nothing here promotes them into
  CLAUDE.md §6, and `p0-authz-invariant.sh`'s four arms are unchanged.
