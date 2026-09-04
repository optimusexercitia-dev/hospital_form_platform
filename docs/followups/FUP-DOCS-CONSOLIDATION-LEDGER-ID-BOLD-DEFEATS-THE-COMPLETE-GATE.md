# FUP-DOCS-CONSOLIDATION-LEDGER-ID-BOLD-DEFEATS-THE-COMPLETE-GATE

**Filed:** 2026-09-04 (Gate AE4 Record step — hit for real) · **Owner:** lead
**Severity:** medium — it blocks a correct `complete` and the message names the right rule, so it
costs time, never truth. But the workaround now in the tree **is an inconsistency**, and the next
person to touch it will most likely "fix" it.

## The mismatch

ADR 0186 D8 lets a hub reach `status: complete` on **either** a phase-ledger row **or** a linked
review whose verdict line says APPROVED. Both satisfiers are narrower than the tree they read:

- **`hubHasLedgerRow`** (`scripts/check-docs-registers.mjs`) builds `^\| *<id> *\|`. Every existing
  row in `docs/progress/phase-ledger.md` writes its id **bold** — `| **AE3** |`, `| **QO·B** |` —
  which that regex cannot match. The convention and the gate disagree.
- **`REVIEW_VERDICT_APPROVED_RX`** is `/^#{0,6} *\*{0,2}Verdict:[\s*]{0,4}APPROVED\b/m` — **case
  sensitive**, and tolerant of `#` and `*` but of nothing else before `Verdict:`.
  `docs/reviews/authz-ae4-gate-rereview.md` opens `# ✅ VERDICT: APPROVED`, which fails on both the
  emoji and the capitalisation despite being an unambiguous approval.

⚠ **It went unnoticed because it had never been exercised.** Ledger rows long predate hubs, and the
phases holding bold rows (AE0–AE3, QO·B …) have no hub at all. **AE4 is the first hub whose
completion depends on a ledger row**, so a mismatch this old surfaced only now.

## What is in the tree right now

`| AE4 | …` — **unbolded, alone among 76 rows**, purely to satisfy the regex. That is a workaround
wearing the shape of a style inconsistency: an editor who tidies it to match its neighbours silently
reds the AE4 hub, and the error will point at ADR 0186 D8 rather than at their edit.

## Closes when

The matchers accept the tree's own conventions — `hubHasLedgerRow` tolerates `**` around the id, and
the verdict regex becomes case-insensitive and tolerant of a leading emoji — **and** the AE4 row is
re-bolded, so no row is load-bearing on its formatting. ⛔ Do **not** close it by rewriting 76 ledger
rows to drop their bold: the convention is older than the gate and reads better.

⚠ Both widenings must be **proven able to fire** — a matcher loosened without a test that a
non-matching row still reds is how a gate quietly stops gating.

## Related

- ADR [0186](../decisions/0186-documentation-consolidation-one-home-per-fact.md) D8 — the rule.
- `docs/progress/phase-ledger.md` — the AE4 row.
- `docs/reviews/authz-ae4-gate-rereview.md` — an APPROVED verdict the gate cannot read.
