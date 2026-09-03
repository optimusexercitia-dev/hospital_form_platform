# FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-24 · status open

⚠ **NEW — a harness ceiling the same widening exposed.** Filed 2026-08-24 (lead).

`app.event_current_custodian` came back **ERROR**: `run-shape != baseline (Files=218 Tests=7199)`.
The cause is exact — with the gate open, `140_patient_safety.sql` fails its test 11 and then
**ABORTS** (`Bad plan. You planned 35 tests but ran 11`), so the denominator moves and §7.15
withholds a verdict rather than recording one against a run whose assertions did not all execute.

✅ **The harness is right and must not be loosened.** ⚠ But **ERROR here means *unclassifiable*, not
*unprotected*** — the suite plainly DID notice (test 11 reddened). ⛔ And it is not a pass either:
CLAUDE.md §6 requires ERROR to be covered in the phase's mutation audit.

⭐ **The class matters more than this one case.** Widening the arm by property admits BROADER gates
— capability resolvers, audit gates — and a broad gate is exactly the kind whose opening makes some
file abort. Expect more of these, not fewer, as the arm's domain grows.

**Decide between:**
- **(a)** a bespoke neutralization per case (what ADR 0079 Amendment 1 already prescribes for
  value-returning raise-guards) — precise, and it does not touch the classifier; or
- **(b)** teaching the classifier a fourth outcome for "shape moved AND the suite went FAIL", which
  is strictly more information than ERROR — ⛔ but it must never collapse into COVERED, because the
  failing assertions may belong to a different gate entirely.

**Owner:** backend.

---
