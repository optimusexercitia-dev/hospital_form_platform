# FUP-E2E-PIN-RECORDS-COUNTS-NOT-IDENTITIES — the baseline can only be diffed arithmetically, and the evidence is destroyed before anyone can check (owner: tester/lead; filed 2026-08-23, found when the AFF2 gate tried to compare flaky tests by identity)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-23 · status open

_**Detail rotated VERBATIM from the Follow-ups section of PROGRESS.md (retired 2026-09-03, ADR 0185) on 2026-08-26**, restoring that index line to its declared one-line form during a size rotation. Nothing was summarised away — the text below is the removed substring exactly as it stood:_

> Measured 2026-08-23 — the `d885f621` row says **"2 flaky"** and names neither, its linked triage doc has **zero** occurrences of "flaky"; and `e2e-prod-gate.sh:57` sets `GATE_LOGDIR="${TMPDIR:-/tmp}/e2e-prod-gate"` with **`batch-N.log`** names — **not run-scoped**, so each run overwrites the prior run's logs by batch number. ⛔ *A total that matches is not a list that matches* — here built into the **instrument**. ⚠ A **new** flake and a **recurring** one are therefore indistinguishable in the gate record forever. Fix: name flaky tests in the summary row + make `GATE_LOGDIR` run-scoped

The `e2e:prod` declare-green step works by diffing a run against a **pinned baseline**. AFF2's pin is the
2026-08-23 run at `d885f621`: *"1185 p · 2 f · 2 flaky · 8 DNR · 20 batches"*. When AFF2's own run also
produced **2 flaky**, the obvious reading is parity. It is not a reading anyone can justify.

**Two measured facts, which together make it unknowable:**
1. **No document names the pin's flaky tests.** The Test Run Summary row says *"2 flaky"*; the triage doc it
   links (`case-split-assertion-integrity.md`) details the two **failures** and contains **zero** occurrences
   of the word *flaky*. The identities were never written down.
2. **The raw logs cannot supply them either.** `scripts/e2e-prod-gate.sh:57` sets
   `GATE_LOGDIR="${TMPDIR:-/tmp}/e2e-prod-gate"` with batch files named **`batch-N.log`**. The directory is
   **not run-scoped**, so every run overwrites the previous run's logs *by batch number*. Both runs happened
   on 2026-08-23, so AFF2's `batch-1.log` overwrote the pin's before anyone thought to look.

⛔ **So "2 then, 2 now" establishes same-COUNT and nothing about same-IDENTITY.** That is the
*a total that matches is not a list that matches* trap — hit twice already this week — except here it is
**built into the instrument** rather than into one person's enumeration. AFF2's two were named
(`act-role-assumption.spec.ts:157` and `phase2-auth-shell.spec.ts:268`, both pre-existing session/auth specs,
neither in any AFF2-touched file, both recovered on retry); the pin's two cannot be.

⚠ **The consequence is permanent, and worth stating flatly: a NEW flake and a RECURRING one are
indistinguishable in the gate record.** A run that silently trades two stable tests for two newly-unstable
ones reports as parity. Flakiness is precisely the property that needs identity tracking, because its
**count** is the one thing about it expected to vary run to run.

**Fix — two small changes, neither urgent:**
- **Name flaky tests (file + title) in the Test Run Summary row**, not just the count. Nothing else has to
  change for a pin to become diffable.
- **Make `GATE_LOGDIR` run-scoped** (a timestamp or commit sha in the path) so a run's evidence survives the
  next one. ⚠ The script already reasons carefully about `batch-N-unrun.log` stubs at `:366-368`; the
  **cross-run** collision was simply never considered.

⭐ Found because `tester` was asked to compare by identity and **reported it as unverifiable rather than
assuming parity**. The honest answer is what produced the finding — a confident "same two, parity" would have
closed the question and left the instrument broken.

> ### ⭐ SECOND FAILURE MODE OF THE SAME DEFECT, measured 2026-08-25 (PDF·P3 gate)
>
> This item predicted that a non-run-scoped `GATE_LOGDIR` **destroys** evidence by overwriting
> `batch-N.log` between runs. It does — and it also does the **opposite**, which nobody had named:
> **the directory is never cleaned, so stale logs from earlier gates inflate any count taken from it.**
>
> `tester` was one step from reporting **20 infra retries** for a run that had **2**. `grep -c` over
> `*-rerun.log` counted 18 files left behind by previous gates — `batch-21-rerun.log` was sitting on
> disk while the run was still on batch 6. ⚠ **Nothing about the output looked wrong**; it took a
> second, independent method (mtime-scoped to the run start, plus `classified INFRA` lines in the gate
> log itself) to contradict it, and the two agreed at 2.
>
> ⛔ **The generalisable form — third variant of this phase's recurring family:** *a count taken from
> a source that is not scoped to the question.* The command was correct and answered a real question
> ("how many rerun logs exist on this disk"), which was simply not the question asked ("how many
> retries did THIS run need"). Same shape as a zero from a broken matcher and an empty capture from a
> shape-mismatched pattern: **the output is well-formed, plausible, and about something else.**
>
> ⇒ Strengthens the existing fix shape: **run-scoping `GATE_LOGDIR` fixes both directions at once**
> — no cross-run overwrite, and no cross-run contamination of counts. Until it lands, ⛔ **never take
> a per-run figure from that directory without scoping it by mtime and corroborating it against the
> gate log.**
