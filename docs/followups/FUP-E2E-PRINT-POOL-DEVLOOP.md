# FUP-E2E-PRINT-POOL-DEVLOOP — the print spec's fixture pool is claimed by POSITION, so a second run without a reset reds a human but never CI (owner: tester)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status parked

- 🟡 **FUP-E2E-PRINT-POOL-DEVLOOP** — `submittedResponseIds` ([e2e/helpers/pdf-printing.ts:133](../../e2e/helpers/pdf-printing.ts)) claims responses **by position** (`responses?…&order=id.asc&limit=N`) with **no filter for "has no print yet"**. Run `npx playwright test e2e/pdf-printing.spec.ts` twice against the same DB generation and the second run reds at `:47` — *"Panel starts empty for this fresh fixture"* — because index 0 was minted and revoked by the first. **Mechanism proven**, not suspected: BUG-DM5-S3-ENV-FIXTURE-POOL-1 measured 9 pre-existing `printed_documents` rows carrying this spec's own revoke sentence verbatim, against **zero** `printed_documents` inserts in `seed.sql` — tester

> **Why no gate will ever catch this.** `scripts/e2e-prod-gate.sh:50` sets `RESET="${RESET:-1}"` and runs
> `supabase db reset --local` **before every batch**, and the batch runs `--workers=1`. So the failure is
> invisible to CI **by construction** and lands only on a human in the quick dev loop — which is exactly
> how it was first filed, as an apparent product defect during an S3 gate sweep.
>
> ⛔ **NOT `FUP-GATE-PDFP1-FLAKE`, and neither closes the other.** That item is the *same assertion*
> failing **inside a gate**, where the reset-per-batch and single-worker facts are precisely what
> near-refutes the pool hypothesis; its mechanism is still UNPROVEN. Same line, two contexts, two
> mechanisms — one measured, one not.
>
> ⚠ **THE OBVIOUS FIX IS A TRAP — do not "just filter the pool".** Making `submittedResponseIds` skip
> already-printed responses **breaks the sibling tests**: they claim indices 1–5 and depend on the
> position→response mapping being stable across calls, so once the first test mints on index 0 a
> filtering helper shifts every later claim by one. Shapes that work: a **dedicated fixture** for `:38`
> alone, leaving the positional helper untouched for the rest; or an **identity-scoped** cleanup that
> deletes `printed_documents` for exactly the claimed response id — *by identity, never by position*
> (the standing "a positional cleanup eats seed rows" rule).
>
> **Discharge criterion — the fix's own test, not a green suite.** Two consecutive
> `npx playwright test e2e/pdf-printing.spec.ts` runs **with no reset between them**, both green. The
> *second* run is the assertion; a single green run proves nothing, because a single run has always
> passed. And the sibling tests must be green in **both** runs — that is the regression risk the
> filtering fix would have shipped.
