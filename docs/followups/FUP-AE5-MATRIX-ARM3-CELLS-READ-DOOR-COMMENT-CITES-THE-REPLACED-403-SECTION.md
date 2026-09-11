# FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-11 · status open

**The defect.** The live body of `app.can_read_professional_profile(uuid, uuid)` (read from `pg_proc`,
never from migration text) carries, above its arm-3 `return exists` clause:

```
-- term at all and its cells are exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3).
```

Unit `AE5-MATRIX-ARM3-CELLS` **replaced** `403` §7.3 (the old *"arm 3 cannot grant in this fixture"*
sentinel occurs 0 times) and oracled arm 3 in §7.3/§7.3b/§7.4/§7.5/§4.1b, so the comment now
cites the exact section that no longer says what it claims, in the body of a live gate. ⚠ The unit's
own record **quoted this comment as evidence** (record entry 2026-09-10, *arm 3 derived*) and then
falsified it without returning — found by QA at the review. **A comment is an assertion that goes
stale silently**; this one was made stale by the unit that read it.

⚠ **It is a COMMENT, not an arm — behaviour is unaffected**, and the *no org term* clause in the same
comment is still true (D3 confirmed against the live catalog).

**Why it was not fixed in the unit.** The unit is ruled *no migration* (vectors and pgTAP only); a
comment-only migration is not free (`migrations-forward-only`), and Batch 10's precedent for the same
shape (`FUP-ADMIN-ARM-IS-ACTIVE-CAN-CREATE-PROFESSIONAL-COMMENT-NAMES-A-REMOVED-ARM`) is *file it*.

**Ruling (PO, 2026-09-11).** **Carrier confirmed:** the fix of
`BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE` carries the correction,
because that fix must re-emit this exact body. The comment was re-read from `pg_proc` at the ruling
and still carries the stale parenthetical (behaviour unaffected). The PO also **ratified the fix
constraint** the unit measured by mutation (bug body, *mutant C extends the caveat*): the fix may add
**neither an org check nor a role-keyed hat check inside arm 3** — `403` §7.5 reds on the first and
§4.1b on the second — so the likely shape is evaluating the hat term **before** the arms. That
ruling is written into the bug body; this follow-up only cites it.

**Closes when:** the migration that fixes that bug re-emits `app.can_read_professional_profile` with
the parenthetical corrected (arm 3's `grant_keyed` cells oracled by `403` §7.3/§7.3b with a PO value
per class; the hat-substitution class a filed bug pinned by §7.4) — ⛔ never a standalone
comment-only migration. If an earlier migration legitimately re-emits the body first, it carries the
correction and this closes there instead.

**Origin.** Filed at unit `AE5-MATRIX-ARM3-CELLS`'s QA review (finding 2, MAJOR); full record:
[`docs/progress/ae5-matrix-arm3-cells.md`](../progress/ae5-matrix-arm3-cells.md).
