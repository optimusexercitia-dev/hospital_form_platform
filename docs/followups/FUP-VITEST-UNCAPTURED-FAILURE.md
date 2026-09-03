# FUP-VITEST-UNCAPTURED-FAILURE — one unit test failed once and **nobody knows which** (owner: backend/lead; **filed only because QA found it was missing from the record entirely**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

**2026-08-20, DSR Slice 3.** A full `npm run test` run reported **1447 passed / 1 failed of 1448**. The
failing test's name, assertion and cause were **not captured**, and the run was not preserved. It has
passed on every run since (five-plus, all 1448/1448).

> ### ⭕ SECOND OCCURRENCE 2026-08-21 — partly captured, and with a probable cause
>
> During the DSR operational-remediation round, `backend` observed **1 failed / 1506** in *"a
> printed-documents actions test"*, did not investigate, and **reported it** rather than letting it
> disappear — which is this item working as intended, one notch short of its ask.
>
> **What is known this time, and it is more than last time: the file family is named.** What is
> still missing is the test name and the assertion.
>
> **Probable cause, stated as probable and not as diagnosis:** `git status` at that moment showed
> `frontend` **mid-write** on `referralId/page.tsx` and two DSR test files — a concurrent-write race
> against a running vitest, not a product defect. ⚠ That is a *hypothesis consistent with the
> evidence*, not a finding; nobody re-ran it against the same tree state, and nobody can.
>
> **Re-measured by the lead immediately after the tree settled: `npm run test` → 1506/1506, exit 0,
> 106 files.** Clean.
>
> ⭐ **The generalisable half:** running the full unit suite while another agent is writing source
> produces failures that are real observations of an unreal state. Two agents, one working tree,
> is the same hazard class as two agents and one local database — and unlike the database, nothing
> announces it. ⛔ Do not reconcile a test count taken during another agent's write.

⛔ **"Passed on every run since" is not a diagnosis.** The test cannot be named, so it cannot be
re-examined, and nothing distinguishes *a fixed flake* from *a real intermittent defect that has not
recurred yet*. The honest state is **undiagnosed**, and it must not be quietly graded as resolved by the
passage of green runs.

⚠ **Why this is filed at all:** the lead stated twice that it "stays a work item" and **never wrote it
down**. QA found every occurrence in the record was a flat *"vitest 1447"* — the failure had been
verbally acknowledged into non-existence. *A work item that lives only in a report is not a work item.*

**If it recurs:** ⛔ **capture the full vitest output BEFORE re-running.** A re-run destroys the only
evidence, and the re-run is the reflex.
