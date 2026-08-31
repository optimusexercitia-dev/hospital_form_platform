# 0170 — case deletion is not a client capability: DELETE on `public.cases` is revoked from `authenticated`

**Status:** Accepted · 2026-08-31 (PO ruling)
**Amends:** 0132 (DOOR-1's `RECORD ONLY` disposition of 2026-08-21 is **lifted** — the door is
closed rather than carried)
**Relates:** 0017 (the Cases RLS/grant surface), 0024 (`guard_case_status`' terminal-DELETE bound),
0078 (`cases_staff_admin_write`'s `FOR ALL` shape), 0079 (the diff-scoped door sweep this owes),
0131 (the erasure-reach bound), 0155 / 0162 (the PA-F8 diff rule)

## Context

ADR 0132 rules that **an ethics proceeding record carries no erasure entitlement at any stage**
(Decision 1) and names the seven case-scoped `ethics_*` tables as non-erasable (Decision 3). The
same ADR records the contradiction as **DOOR-1 — `DELETE FROM cases` cascades the whole evaluation
away**, and disposes of it: *"RECORD ONLY — do not fix them in this change… accepted and open, not
absent and not closed."*

**Re-measured on the live catalog at head `20261003006800` (2026-08-31), not read from migration
text:**

- `has_table_privilege('authenticated', 'public.cases', 'DELETE')` = **true**;
- `cases_staff_admin_write` is **`FOR ALL`** on
  `app.is_staff_admin_of(commission_id) AND NOT app.is_case_excluded(id, auth.uid())`;
- `app.guard_case_status`' DELETE arm raises **only** for `old.status in ('completed','cancelled')`
  — three of five statuses, i.e. **every in-flight proceeding**, are deletable;
- all **seven** `ethics_*` FKs to `cases` carry `confdeltype = 'c'` (CASCADE).

**The measurement that decides the remedy: nothing deletes a case row.** No client `.delete()` on
`cases` anywhere in `src/` or `e2e/`, and **zero** database functions whose comment-stripped
`prosrc` matches `delete\s+from\s+(public\.)?cases`. The capability is unused.

**Provenance: the grant was never a decision.** It is one of **158** identical
`GRANT ALL ON TABLE … TO "authenticated"` lines emitted alphabetically by the squashed baseline
(`supabase/migrations/20260620000000_baseline.sql:23322`); no `grant delete on public.cases` and no
revoke exists in any of the 499 migrations. ⭐ The contrast is the finding: ADRs 0036 / 0037 / 0038 /
0064 each **explicitly** revoke DML from `authenticated` on PHI tables. `cases` was simply never in
that set.

## Decision

1. **`revoke delete on public.cases from authenticated`.** This closes DOOR-1 and the unaudited
   case-deletion Rule 11 gap in one move, at near-zero regression risk, because no product or
   database path exercises the capability.
2. **Its own gated increment, landing BEFORE AE4.3's `staff_admin` matrix is approved** — ADR 0162 /
   PA-F8 disposition (a), *fixed in a preceding, independently gated increment*. It owes migrations,
   pgTAP keystones, and an ADR 0079 diff-scoped door sweep over the touched surface.
3. ⛔ **The revoke PRE-EMPTS `cases_staff_admin_write`'s DELETE arm** — the
   `FUP-EVENT-PATIENT-POLICY-PREEMPTED` shape, where confidentiality rests on an absent grant while
   a `FOR ALL` policy still reads as the control. The increment **must pin the absence executably**
   (assert `authenticated` holds no DELETE on `public.cases`), so a future `grant` cannot silently
   re-arm a policy nobody has evaluated against current requirements.
4. **pgTAP `110` §9 is RE-BASED, not deleted.** It asserts `23514` as `authenticated`; after the
   revoke the refusal arrives as `42501` **from a different arm**. Per
   `FUP-AE2-397-DENY-CELLS-SQLSTATE-ONLY` a SQLSTATE-only deny is satisfied by the wrong arm, so the
   re-base keeps the terminal-state guard under test at a privileged role **and** adds a separate
   grant-absence assertion. One assertion may not carry both claims.
5. `app.guard_case_status`' DELETE arm stays. It becomes unreachable for `authenticated` and remains
   defence-in-depth for privileged paths.

## Consequences

- **AE4.3's `staff_admin` matrix does not encode a case-delete permission.** Without this, deriving
  the matrix from current behaviour would have written a capability an accepted ADR forbids into the
  new system's regression oracle — precisely the trap PA-F8 exists to prevent.
- ADR 0132 gains an inbound `Amends` edge, so DOOR-1's `RECORD ONLY` line is no longer the last word
  visible from that file.
- ⛔ **Explicitly NOT in scope, and both stay open:** the general case-deletion audit gap on
  privileged paths, and the absence of audit triggers on the `ethics_*` tables — DOOR-1's *"zero
  audit rows naming any ethics entity"* half is narrowed by this decision, not discharged.
