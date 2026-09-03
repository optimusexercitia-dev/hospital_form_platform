# FUP-AE2-397-DENY-CELLS-SQLSTATE-ONLY — `397 §§ 2/3`'s ten deny cells assert SQLSTATE only, in the suite that documents having been bitten by exactly that (owner: backend; filed 2026-08-28 by QA r3 F1)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-28 · status open

**Measured.** `app.grant_role_impl` carries **12** `42501` raise sites over **7 distinct messages**,
and `397 §§ 2/3`'s ten deny cells assert the SQLSTATE alone. So a refusal arriving from a *different
arm* — the shape ADR 0167 Amdt 2 created by moving the platform admin's refusal one statement earlier
— satisfies them.

⛔ **The suite documents this exact hazard about itself.** `§ 5.2` was repaired for it during AE2's
increment C; `§§ 2/3` were not, so the file now contains both the lesson and the unrepaired instance.

⚠ **The obvious fix is only PARTIAL, and that is the finding:** adding the message narrows 12 → **6**,
because six sites share the string `sem permissão`. Distinguishing those six needs an actor axis, not
a message assertion — do not record "add the message" as a closure.

**Not blocking:** `§ 0.3` / `§ 0.4` are strong structural pins (QA r3 re-derived their subject: 2
`is_admin_for` sites in grant, 1 in revoke, sub-arms identical), so a *deleted* arm still reds.
