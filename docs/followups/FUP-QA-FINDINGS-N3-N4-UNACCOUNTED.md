# FUP-QA-FINDINGS-N3-N4-UNACCOUNTED — two QA findings have ZERO hits in the live register (owner: lead; rotated from the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185) on 2026-08-27, measured 2026-08-26)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

A line in the Now section of PROGRESS.md (retired 2026-09-03, ADR 0185) asserted: *"Five QA findings (N-1…N-5) + four P3 follow-ups are OPEN in
§ Follow-ups"*.

**Measured 2026-08-26 at the AFF4 Record step, against the live file:** findable are **N-1, N-2,
N-5** and **TWO** `FUP-P3-*` lines. ⛔ **N-3 and N-4 have ZERO hits anywhere in PROGRESS.md.**

Either they were resolved and the claim was never updated, or they were **lost**.

**What must happen:** ⛔ **recover N-3 and N-4 from the originating review** before anyone quotes
the old claim, then either file them as follow-ups with bodies or record them as resolved with the
event that resolved them. Until that is done, neither disposition is known.

⚠ **Direction matters, and it is why this one is worth the recovery cost.** This error ran **WIDER
than reality** — the opposite of the usual tighter-so-it-reads-as-care drift. It **concealed two
items by asserting they were already indexed**, which is strictly worse than omitting them: a
reader checking "are these tracked?" got a yes. **Approval was given AROUND these two, not over
them.**

⭐ The general shape, which is not specific to N-3/N-4: *a claim that work is already registered is
itself a claim that needs measuring* — and it is the one kind of register error that a reader of the
register cannot detect, because the register is what they would check.
