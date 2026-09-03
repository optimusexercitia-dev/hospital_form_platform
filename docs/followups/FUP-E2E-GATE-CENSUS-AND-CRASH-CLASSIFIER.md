# FUP-E2E-GATE-CENSUS-AND-CRASH-CLASSIFIER — the gate's own arithmetic does not sum, and it scores a worker crash as an assertion failure (owner: lead/tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> ### ⭕ HALF-RESOLVED 2026-08-21 (lead, measured on a full gate run) — the arithmetic DOES sum; the census line just does not count skips
>
> Run of 2026-08-21, 19/19 batches, on the DSR remediation branch:
> `1166 passed · 2 failed · 3 flaky · 11 skipped · 0 did-not-run · 1182 collected`.
>
> **1166 + 2 + 3 + 11 = 1182, exactly.** The gate nonetheless printed
> `COVERAGE: accounted for 1171 of 1182 collected tests` — and **1171 = 1166 + 2 + 3**, i.e. the
> `accounted` figure omits the **skipped** bucket. ⭐ So the *"11 tests in no bucket"* this item was
> filed on were never in no bucket: they were **skips, in a bucket the coverage line does not add
> up.** The defect is the reporting definition, not lost tests.
>
> ⚠ **This resolves the ARITHMETIC half only. The item stays OPEN for its other half** — the INFRA
> classifier still has no notion of a worker exit code, so a `0xC0000409` crash would score as an
> assertion failure with tests stranded behind it. ⛔ That half is untouched by this measurement, and
> the fix for it is still **not** "add crash to INFRA": a crash is a third category requiring a re-run
> before any verdict.
>
> ⭐ **Worth keeping regardless of the fix:** `did-not-run` was **0 on every one of the 19 batches**,
> and that — not the pass count — is the number that answers *"did anything get swallowed?"*. It is
> the direct antidote to the serial-abort blindness recorded in
> [[e2e-prod-build-flaky-baseline]]: a serial file that aborts leaves tests unrun, and this field is
> where that shows.


**2026-08-20, the DSR Slice 3 declaring run.** Two defects in `scripts/e2e-prod-gate.sh`, both found by
reading its output rather than trusting the headline:

1. ⛔ **The census does not sum.** `GATE SUMMARY: 1153 passed · 3 failed · 4 flaky · 5 did-not-run` and
   `COVERAGE: accounted for 1165 of 1176 collected` — **11 tests are in no bucket at all.** They are
   neither passed, failed, flaky, nor reported as never-run. A census whose parts do not sum is wrong,
   and this one is the instrument that declares the phase green.
2. ⛔ **The INFRA classifier has no notion of a worker exit code.** It classifies on `server_dead`,
   `conn_errors` and `pgrst_unready`. `ethics-e2-procedure.spec.ts:913` died with
   `worker process exited unexpectedly (code=3221226505)` — `0xC0000409`, a Windows stack-buffer-overrun
   — and was scored as a **real assertion failure**, with 5 further tests stranded behind the dead
   worker and reported as did-not-run. An isolated re-run of the same frozen tree passed 68/68.
   ⭐ **SECOND INSTANCE, DIFFERENT SIGNAL, 2026-09-02 (AE4.9 gate run) — it does not recognise
   `ERR_ABORTED` either.** `sup-supersession.spec.ts:237` (SUP-2) failed as
   `page.goto: net::ERR_ABORTED; maybe frame was detached?` navigating to `/` inside
   `e2e/helpers/auth.ts:133` (`cachedSignIn`), 30 s timeout, on **both** the attempt and its
   retry. The batch reported `server_dead=0, conn_errors=0`, so the classifier scored a
   connection-level abort as the run's **one real failure** and turned `GATE_EXIT=1` — on a run
   in which **no test failed an assertion anywhere**. ⚠ It is the same shape as the crash case:
   a navigation abort is not an expectation that went false. ⛔ And the same caveat applies —
   the fix is not "add `ERR_ABORTED` to the INFRA list", because a genuine app-side failure can
   also abort a navigation; it is to classify by *what the failure is*, not by which strings the
   heuristic happens to know.

⚠ **Consequence, and it cuts both ways.** A crash counted as a defect sends someone hunting a
non-existent bug (this cost a `useFieldIds`-regression investigation before being ruled out on
evidence). ⛔ And the same blindness could equally hide a real defect behind "infra" once the classifier
is taught about crashes — so the fix is **not** "add crash to the INFRA list", it is *classify a crash
as its own third category: neither pass nor defect, and REQUIRING a re-run before any verdict.*

**Related in kind, same session:** `FUP-AUTHZ-HARNESS-PRECONDITIONS` — a verdict emitted about a
substrate that was not in the state the instrument assumed. This is the same family in the E2E gate.
