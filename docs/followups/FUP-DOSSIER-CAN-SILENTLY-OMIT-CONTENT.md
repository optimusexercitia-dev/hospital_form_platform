# FUP-DOSSIER-CAN-SILENTLY-OMIT-CONTENT — a hash-sealed dossier's answer reads swallow their errors (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-25 · status open

> **Filed 2026-08-25, QA pass 2 finding N-2.** Two halves; the second is the one with teeth.
>
> **(a) Evidence.** `can_read_full_case_content` Axis C composes
> `can_view_printed_document('form_response', …)` with an RLS-mediated TypeScript answer read. If
> the two diverge the failure is **silent in both directions**. QA measured them equal over **975
> cells** with both controls moving — and **no test, in any layer, compares them.** Owed: a
> cross-kind pgTAP vector asserting set-equality of the door and the `answers_select` disjunction.
> ⚠ QA's own first matrix reported 11 false over-grants because `app.has_role`'s act-as hat clause
> is **vacuously satisfied** when called as `postgres` (`auth.uid()` is NULL) — whoever writes the
> vector must supply the hat to **both** sides or reproduce that artefact.
>
> **(b) Correctness.** `getResponseForFill` (`src/lib/queries/responses.ts:844-979`) destructures
> `data` only and **never inspects `error`** on any of its **eight** reads, coalescing with `?? []`.
> A transient failure therefore yields an **answer-less phase** rather than an exception, and
> `buildResponseSections` still returns non-null ⇒ **a hash-sealed dossier can silently omit
> content**, carrying a verification URL that attests to the truncated artifact. The RLS half is
> closed by Axis C; this half is not. ⭐ The same module already models the right shape:
> `getCaseDetailUncached` explicitly throws on `error` for its side reads.
>
> ⚠ **Not a drop-in fix.** `getResponseForFill` also serves the fill wizard, where throwing on a
> transient error changes behaviour from "empty answers" to "broken wizard". The print path wants
> fail-loud and the fill path may not — decide that explicitly rather than flipping the shared
> function. **Owed:** make the dossier path fail loudly, with a test that a read error produces an
> error rather than a short document.
