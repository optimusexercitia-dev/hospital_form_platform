# FUP-E2E-GATE-DISCARDS-SERVER-LOG-ON-MID-BATCH-DEATH

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

> ⭐ **READ THIS BEFORE INVESTIGATING ANY GATE COLLAPSE (added 2026-08-25, PDF·P3):** the string
> `⨯ Error: The destination stream closed early.` (digest `504373718`) is **NOT a server-death
> signature**, and four documents in this repo say it is. Measured: it appears in **every** run of
> the print spec including the clean 11/11 ones; both PDF routes return a fully materialized
> `Uint8Array` with all audit work awaited **before** the bytes, so the failure direction is
> **over**-audit and a truncated PHI document discloses less, not more. ⛔ Its cause is **UNKNOWN**:
> the abandoned-response-body explanation was proposed by QA pass 2 (N-4), acted on, and
> **falsified** — draining every named site RAISED the count. Do not re-attribute it without a
> measurement. Detail: [phase-p3-review.md](../reviews/phase-p3-review.md) § N-4 and the
> `drainBody` docblock in `e2e/pdf-printing-cases.spec.ts`.
> ⚠ **And it is not ONE signal:** the print spec emits digest **`504373718`**; the 2026-08-25 gate
> run's retained server logs carry **`2566810473`** — same message, different sites, so any future
> attribution must say WHICH.
> ⭐⭐ **That run also disproves the death-signature reading from the other direction:** the batch-7
> server that **DIED** logged the error **twice** (351-byte log, no FATAL, no stack), and its re-run
> server, which came back **56/56 clean**, logged it **six** times. A signal more frequent on the
> healthy server cannot be the death signature.
 — the one failure mode the gate detects is the one whose evidence it deletes (owner: tester + backend)

> `scripts/e2e-prod-gate.sh:308` redirects each batch's standalone server to a **fixed**
> `server.log` with a **truncating** `>`, so every batch overwrites the last. The file is surfaced
> at exactly one place — line 412, on `start_server` **failure**.
>
> ⇒ A server that **fails to start** gets its log tailed. A server that starts cleanly and then
> **dies mid-batch** — the `server_dead` condition **the INFRA classifier exists to detect** —
> leaves **no retained server-side artifact at all.**
>
> **Verified 2026-08-25, not taken on report:** `server.log` occurs at exactly **2** lines in the
> script; truncating redirects to it = **1**, appending = **0**. ⭐ **And per-batch naming was never
> unavailable** — the same script already writes `batch-$BATCH_NO.log`, `batch-$BATCH_NO-unrun.log`
> and `reset-batch-$BATCH_NO.log`. The server log is the **lone exception to a convention the script
> itself established**, and it is the exception for the one artifact a collapse investigation needs.
>
> **Consequence, measured across two full gates.** Batch 6 collapsed in run 1 (retry recovered) and
> again in run 2 (**retry failed**: 15 passed, 17 failed, 36 did-not-run, `accounted 69/69`).
> Every reading available in either run was **client-side** — `page.goto: net::ERR` ×33,
> `server_dead=1`, `conn_errors=33`, **0** strict-mode violations, **0** assertion failures. All of
> those say *"the server was gone"*; **none says why.** Batch 7's server truncated batch 6's log at
> 07:32:53, seconds after it died.
>
> ⛔ **Three causes are indistinguishable from outside, and they prescribe opposite remedies:**
>
> | cause | remedy | cost of guessing wrong |
> | --- | --- | --- |
> | V8 heap ceiling | `--max-old-space-size` | `BATCH_SIZE=4` masks it and halves throughput forever |
> | **unhandled exception in app code** | ⛔ **it is a product DEFECT** | the classifier books a real bug as INFRA, indefinitely |
> | plain capacity | `BATCH_SIZE=4` (runbook's own remedy) | — |
>
> ⭐ **The middle branch is why this is 🔴 and not 🟡.** A genuine application crash presents to this
> gate as pure infra, in both runs, with the evidence that would distinguish it already deleted. The
> host was measured clean at the time — **no orphan processes** (all `node.exe` 1.5 min old against a
> run started 29 min earlier) and **12.2 GB of 32.5 GB free** — so whole-machine exhaustion is out,
> which makes the two per-process causes *more* likely, not less.
>
> ⚠ **Do not seize on `Error: The destination stream closed early`.** It appears in a **currently
> healthy, passing** batch's log — a client aborting a response mid-flight — and is noise, not a
> death signature.
>
> **Fix:** per-batch filename (`server-batch-N.log`, matching the existing convention) **and** a
> `tail` on the **INFRA-classification** path, not only the start-failure path. ⛔ Prove it by
> forcing a mid-batch server death and confirming the artifact survives — a retention fix that is
> never observed retaining anything is the same vacuity as a classifier arm that only ever passes.
>
> **Owner:** `tester` (fault injection) + `backend` (script).
>
> ---
>
> ### ⭐⭐ SECOND FINDING, SAME CLASS — `GATE_EXIT` is lost for exactly the runs that need it
>
> The gate's exit code is captured by a `; echo "GATE_EXIT=$?"` clause **in the launching wrapper**,
> not by the script. The harness killed that wrapper in **both** full runs (2026-08-25), so the token
> never appeared either time and the exit code had to be **derived** from the verdict string via the
> `:505-537` mapping.
>
> ⛔ **This makes the reporting contract unsatisfiable, not strict.** The lead required *"`GATE_EXIT`
> read from the appended variable, never inferred from summary prose"* — a rule that assumes the
> wrapper outlives an ~80-minute run. It demonstrably does not, twice. A contract requiring an
> artifact the environment reliably destroys yields either a violated contract or a
> "not available", and neither is the evidence it was written to get. **The contract must key on the
> verdict line, or the script must persist the code itself.**
>
> ⭐ **THE UNIFYING MECHANISM, and why these are one item:** in both findings **the artifact that
> proves the outcome is not written durably by the thing that produces it** — the server log goes to a
> fixed name the next batch truncates, the exit code goes to a shell the harness reaps. Neither
> survives the run it describes. ⚠ **Both are invisible while everything passes**, and both are gone
> at precisely the moment someone needs them.
>
> **Fix (same shape as above):** the **script** writes `gate-exit` and `server-batch-N.log` into
> `$GATE_LOGDIR` as it goes. Nothing downstream of the script should have to survive for the run's
> own evidence to exist.

---
