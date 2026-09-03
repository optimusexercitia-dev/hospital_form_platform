# FUP-AE4-ORACLE-APPROVAL-SCOPE-STATED-THREE-WAYS — the regression oracle cites its own PO approval at 42, 33 and 43 rows

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

Three statements of the same approval, in the same artifact family: the header says **"PO-APPROVED AT 42 ROWS"**;
line 250 says the PO **"approved this matrix at 33 rows… nine rows of delta"**; the catalog holds **43**.
Whichever is right, two are wrong, and a gate record citing "the PO-approved matrix" inherits the ambiguity.

**How it was measured.** Read directly from the matrix document and cross-checked against
`authz.permissions` on the live catalog during the Gate AE4 review.

**What would close it.** One sentence, PO-confirmed, naming the count approved, the date, and what the
delta rows are — then every other statement of it deleted rather than corrected, so a fourth cannot appear.

⛔ **What must NOT be mistaken for closing it.** Reconciling the arithmetic (42 + 1, or 33 + 9 + 1) is not a
ruling: it explains how the numbers *could* relate without establishing which one the PO actually approved.
