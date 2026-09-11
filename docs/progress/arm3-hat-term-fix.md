# ARM3-HAT-TERM-FIX — progress record

> Hub: [arm3-hat-term-fix.md](../features/arm3-hat-term-fix.md) · fixes
> `BUG-AE5-MATRIX-ARM3-CELLS-CASE-GRANT-ARM-MAKES-THE-HAT-TERM-UNENFORCEABLE` on the PO-ratified
> shape (bug body § PO ruling on the fix shape and its second duty, 2026-09-11) and carries
> `FUP-AE5-MATRIX-ARM3-CELLS-READ-DOOR-COMMENT-CITES-THE-REPLACED-403-SECTION`. Branch:
> `claude/distracted-kapitsa-0d82de` (worktree), cut from `main` at `adbde005`.

Subjects: `app.can_read_professional_profile(uuid, uuid)` (one forward migration re-emitting the
body), `supabase/tests/403_ae45_differential_oracle.sql` (§7.4 retired by its own route; §4.1/§4.1b
carve-out dropped), the differential-cell generator and its vector (the 10-cell label),
`docs/backend-state/authorization-and-audit.md` (slice + block). ⛔ No `src/` change expected; the
signature does not move.

## Session log

### 2026-09-11 — unit opened; the subject measured from the catalog (lead)

**Tree.** Clean at `adbde005` (`main` and the worktree branch coincide). Local stack up
(`npx supabase status`), head migration `20261003007390`.

**Live body read from `pg_proc`, not migration text.** Four arms in order: arm 1
`app.is_admin_for(p_uid)`; arm 2a `app.can_manage_professional(v_org, p_uid)` **or** 2b
`authz.has_permission(p_uid, 'organization', v_org, 'org.professionals.read')`; arm 3 the
`professional_participants → case_participants(live) → app.can_read_case_committee(cp.case_id, p_uid)`
traversal. The arm-3 comment still carries `exercised-but-not-oracled (ADR 0175 D3 / 403 §7.3)` —
the follow-up's subject, confirmed live.

**The hat term as it exists today** (`app.has_role`, live): `p_user_id is distinct from auth.uid()
or p_role is not distinct from app.active_role()` — role-keyed by construction, so it has no
meaning inside a role-free arm. `app.active_role()` reads the `active_role` JWT claim.

**The vector's coordinates, derived (not quoted) from `authz_differential_cells.psql`.** `403`
binds `active_context` as `matching → staff_admin`, `other_role → quality_reviewer`, else NULL.
Class 5 (`arm3:divergent-defective:hat-unenforceable`, 10 cells): personas `subject_holder` (4),
`other_commission_holder` (4), `cross_org_actor` (2) — every one `other_role` · `self` ·
`grant_keyed` · state `active|pending`. Class 3 (`arm3:divergent-approved:not-a-holder`, 36 cells):
persona `unprivileged` = `f.nobody`, **no membership at all**, 12 cells each at `absent`,
`matching` and `other_role` — all GRANT. ⇒ the only property separating a class-5 DENY from a
class-3 GRANT at the same hat is **whether the caller holds any role**, which is why a hat check
keyed on the *hat alone* (mutant C) reds §4.1b. ⚠ **No holder cell exists at `absent` · `self` ·
`grant_keyed`** — that coordinate is unpinned and the plan must state its value.

**Homes written:** hub (`in_progress`), this record, `docs/features/INDEX.md` regenerated. CLAUDE.md
review queue: no entry newer than the 2026-09-11 processed marker.
