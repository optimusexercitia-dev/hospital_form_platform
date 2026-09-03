# FUP-E2E-GATE-CLASSIFIER-BLIND-TO-WORKER-CRASHES — a host-resource collapse is booked as failures against the phase under test (owner: tester + backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> `scripts/e2e-prod-gate.sh`'s infra classifier keys on `server_dead` / `conn_errors` /
> `pgrst_unready`. A Playwright **worker process** dying and a **browser target** crashing match
> **none** of those, so a host-resource collapse is recorded as ordinary test failures attributable to
> whatever phase is under test.
>
> **Measured 2026-08-25 (PDF·P3 gate, `615afaf0`).** Batch 13 reported `16 passed, 27 failed,
> 14 did-not-run` and was **not** classified INFRA. Error census of that batch:
> `worker process exited unexpectedly` ×53 · `browserContext.newPage: Target crashed` ×1 ·
> **strict-mode violations 0** · assertion failures **0**. The 27 were booked against
> `phase-multitenancy` (13), `phase11-interviews` (13) and `phase10-meetings` (1) — **three files the
> phase never touched.** Re-run in isolation against the same prod build: **57/57 pass, 0 flaky**, and
> the `worker process exited` signature never reappeared.
>
> ⭐ **Impact — the headline verdict was wrong by 5.7×.** The gate read
> `GATE RED — 34 real failure(s)` when the attributable count was **6**. A reader triaging from the
> summary would have spent it on three unrelated files. This is the *"~320 of ~370 E2E failures were
> infra, against 3 real regressions"* problem the classifier exists to solve, **recurring through a
> signature the existing fix does not recognise.**
>
> ⚠ **It inflates TWO summary fields, not one:** the 14 masked tests in that batch also counted
> toward the summary's `did-not-run 29`, so an unrecognised infra event corrupts both the failure count
> and the coverage story.
>
> ⚠ **And it makes the reassuring field the misleading one:** that same run's summary read
> **`0 infra`** while **3** `server_dead` retries had occurred — zero because each retry *succeeded* and
> absorbed its failures. **Green-after-retry and green-first-time are different facts and the summary
> cannot distinguish them.**
>
> **Suggested fix:** add `worker process exited unexpectedly` and `Target crashed` to the infra
> signature set. ⛔ **Prove the detector can FAIL before trusting it** — a classifier arm that only ever
> passes is vacuous, per the gate doc's own fault-injection checklist
> ([e2e-prod-build-gate.md](../testing/e2e-prod-build-gate.md), *"each must fail and pass in the right
> direction"*).
>
> **Owner:** `tester` (signature + fault injection) + `backend` (script).

---
