# FUP-AE5-MATRIX-ARM3-CELLS-INCREMENT-ONE-NAMES-TWO-DIFFERENT-ROLES

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-10 · status open

**The observation, measured at three heads that disagree.** *"AE5 increment 1"* is used as an
ordering anchor by at least three live sentences, and it does **not** name the same role in all of
them:

- `docs/progress/ae5-opening-adr.md:519-520` — *"AE5's increment **1** is `staff_admin`, which is the
  only role already `state = 'authoritative'` … so 0202 gates increment **2**, not 1."*
- `docs/progress/ae5-opening-adr.md:522`, **two lines later** — *"AE5's **eleven** increments = 12
  catalog roles − `staff_admin`."* ⇒ if `staff_admin` is **subtracted out** of the increments, it
  cannot also **be** increment 1. The same paragraph asserts both.
- `docs/plans/authz-evolution.md:1178-1180` — the **Proposed order** is numbered from 1 and its
  item **1 is `staff`**, not `staff_admin`.
- `docs/plans/authz-evolution.md:1174` and `docs/plans/pre-ae5-remediation.md:396-398` repeat the
  first reading verbatim (*"increment 1 is `staff_admin`, the only already-`authoritative` role"*).

**Why it is a finding and not a quibble.** Two live sequencing clauses are keyed on the phrase:
ADR **0202** is *"due before increment **2**"* and unit **`AE5-MATRIX-ARM3-CELLS`** is *"due before
increment **1** runs its matrix"*. Under reading A (increment 1 = `staff_admin`) increment 1 is a
role that is **already `authoritative`**, so its matrix either already ran or never will — and a
prerequisite due *"before"* it is, on its face, **already late**. Under reading B (increment 1 =
`staff`, per the Proposed order) both clauses are unambiguous and neither is late. ⇒ the ambiguity
does not change what to build; it changes whether a reader believes a gate was **missed**, and it
shifts ADR 0202's own due point by one role.

**Reach, stated rather than left to alarm.** ⛔ **Nothing is blocked and nothing is late today.**
Measured 2026-09-10: **0 of 11** AE5 role increments exist — `docs/progress/phase-ledger.md` carries
no AE5.x role row, `docs/features/INDEX.md` carries exactly one AE5-prefixed forward row (this
unit), and no branch exists for any increment. So both readings agree on the only thing that
currently matters: nothing has started, and this unit precedes all of it. The defect is latent and
will bite the first session that quotes the phrase to justify an ordering.

**Why no gate catches it.** The phrase is prose in three files; no gate parses increment numbering,
and `lint:registers` checks a register's *shape*, never the agreement of two sentences about the
same ordinal. This is the `409` § 3.7 shape — a sentence that reads as settled while two of its
homes disagree.

**Not fixed in this unit, deliberately.** Choosing which reading is correct is a **PO sequencing
ruling**, not a measurement: it decides whether `staff_admin` occupies an increment slot at all, and
that answer moves ADR 0202's due point. This unit's own scope (arm-3 divergence enumeration) is
unaffected under either reading, so ⛔ it does not get widened to absorb a decision it does not own.
