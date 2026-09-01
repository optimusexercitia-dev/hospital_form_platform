# 0174 — `authz.holds_role`: one chokepoint for the hat, and `authz.roles.state` made load-bearing

**Status:** Accepted · 2026-09-01 (AE4.7b)
**Amends:** 0106 — ACT / the active-role ("hat") condition. Stage 3's gate sentence names
`app.has_role` **by name** as the single site the hat lives at. That is still true for the eleven
`legacy` roles and false for `staff_admin`, whose hat now lives in `authz.holds_role`. The
invariant is unchanged; its site is now per-role and moves at each AE5 cutover.
**Amends:** 0079 — the door-blindness standing invariant. Every arm's domain and the sweep
deriver bounded on `nspname in ('app','public')`; the `authz` schema was outside all of them.
Widened to `('app','public','authz')`, with the three doors that remain outside named per door.
**Relates:** 0155 D7 / 0162 §2 (the AE4 program) · 0172 (the catalog substrate) ·
`FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE` (closed here) ·
`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (**C2**), which still owns the `PRED_DOMAIN` bound

## Context

AE4.6 cut `staff_admin` over to the catalog by re-pointing both wrappers at
`authz.assignment_facts`. That adapter carries **three** of `app.has_role`'s four gates and not the
fourth — the active-role filter is permission-dependent and lives in the resolver — so each wrapper
**hand-copied** the hat conjunct into its own body.

Three consequences, all measured rather than predicted:

1. **pgTAP 315 test 14 and 319 test 5 went red and stayed red.** Both mutate `app.has_role` and
   observe propagation into the wrappers. After the cutover the mutation no longer reaches them:
   they were **orphaned, not wrong**. ⚠ They failed *loudly*. Had the mutation left their
   assertions satisfied, a hat control that no longer tests the hat would have gone green forever.
2. **The conjunct existed in four hand-written phrasings** (both wrappers,
   `authz.has_direct_permission`, `authz.explain_direct_permission`). pgTAP 405 §4.4 could only
   *count the copies*; nothing asserted they agreed.
3. **`authz.roles.state` was inert.** Nothing read it. Flipping a row to `authoritative` changed
   nothing anywhere, so AE4.6's "atomic cutover" was atomic only because the wrapper bodies
   happened to move in the same migration.

AE5 substitutes eleven more roles. Eleven cutovers × four phrasings is the shape that produces a
divergence nobody notices.

## Decision

**D1 — one chokepoint.** `authz.holds_role(p_principal, p_role_code, p_scope_kind, p_scope_id)`
carries all four legacy gates (seat expiry, scope, principal state via the adapter; the hat in its
own body). Both wrappers become one-liners over it. The §6A self / third-party asymmetry is derived
**internally** from `p_principal is distinct from auth.uid()` — never a caller-supplied flag, which
is a thing callers get wrong undetectably — so it is expressed **once** and each wrapper's polarity
falls out. The behavioural assertions in 405 §§2–3 were written against the hand-copied bodies and
pass unchanged, which is the evidence the collapse was behaviour-preserving.

**D2 — the fifth gate: `authz.roles.state = 'authoritative'`.** `holds_role` denies any role the
catalog does not yet own. A premature AE5 delegation therefore fails **closed and loudly** instead
of granting through a half-finished substitution, and the state flip becomes the atomic cutover the
design has been claiming it is. ⛔ Consequence, stated so nobody re-derives it as a bug:
`holds_role` is **not a general role predicate** — it answers FALSE for all eleven legacy roles even
with a live, correctly-scoped membership and the matching hat. `app.has_role` remains the predicate
for those and is untouched.

**D3 — the twin plan, and the hat's site is now per-role.** `app.has_role` keeps its mutation twins
for the legacy population (315's probe moved to a table still reached through it; 319's A5 observable
moved to an arm still routed through it), and the new chokepoint gets its own twins at its own site
(405 §7). ⛔ Neither file mutates the other's subject: a single "the hat lives here" claim is no
longer true of the whole platform, and pretending otherwise is how one of these controls goes silent.

**D4 — domains widened to `('app','public','authz')`**, harness and deriver, with the three doors
still outside named per door: `assignment_facts` (set-returning, no `authenticated` EXECUTE),
`explain_direct_permission` and `rebuild_implication_closure` (prosecdef scalar non-bool = the C2
class). Absence of a verdict is absence of coverage, so the partition is stated, never inferred.
`PRED_DOMAIN`'s name/identity bound is **not** widened here — it stays routed to C2.

**D5 — two new arms.** `ARM=catalog`: every non-`legacy` role has a PO-approved matrix and a
differential-oracle suite (D2 makes the flip cheap, so the arm refuses the state where there is
nothing to compare against). `ARM=sites`: AE4.6's hand census re-derived — every site quoting a
catalog-owned role code is the wrapper family or an allowlisted value-use.

**D6 — `FUP-IS-STAFF-ADMIN-OF-CARRIES-PUBLIC-EXECUTE` closed.** The PUBLIC grant on
`app.is_staff_admin_of` is revoked, asserted by effective privilege on both sides plus an
over-revoke twin. ⚠ pgTAP 320's header listed that grant among "the explicit nine … a decision, not
drift", on the reason that these run inside policies `anon` may evaluate. Measured before the
revoke: of the **64** policies calling it, **zero** are granted to `anon` or PUBLIC, and `anon` holds
SELECT on **zero** `public` tables. It was `create or replace` residue predating AE1.2's global
default revoke — drift wearing a decision's label, inside a list whose purpose is to tell the two
apart. Ratchet re-pinned 237 → 236 with the measurement recorded beside it.

## Consequences

- Each AE5 cutover is a two-line body swap plus a state flip, and `ARM=catalog` blocks the flip
  until the artifacts exist. The mutation twins have one site per role, forever.
- ⚠ **`authz.assignment_facts` is now a visible hat-blind finding.** Widening the hat arm's domain
  surfaced it — the only body in the tree that reads `public.memberships` for a principal and
  carries no hat itself, by design (the filter is many-to-many with permissions and must be applied
  by the consumer). It is allowlisted with a per-caller compensating control and three
  WRONG-THE-DAY conditions, and `authz.holds_role` was added as the hat sweep's **third anchor**
  with a self-test (ST7) proving that anchor check flips when its conjunct is stripped.
- ⚠ **`holds_role` inherits the `ERROR | run-shape!=baseline` verdict** of the two wrappers, by
  construction rather than coincidence: it *is* them, so one neutralization opens both and
  destabilises the suite shape the harness measures against. Covered in substance (genuine failures
  across 20+ suites, read from the run's own log); 405 §7 is the deterministic substitute.
- ⛔ **What this does NOT do:** it does not make the catalog the authority (eleven roles are still
  `legacy`, both `memberships` CHECKs still stand — the catalog remains *authority-elect*, ADR 0162
  §2), and it does not widen `PRED_DOMAIN`.
