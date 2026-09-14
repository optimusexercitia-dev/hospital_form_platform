# FUP-AE5-STAFF-MEMBER-PREDICATE-REEXPRESSION-DEFERRED

**Filed:** 2026-09-14 · unit `AE5-STAFF`, T7 · owner **backend** · severity **medium**
**Register entry:** [follow-ups-open.md](follow-ups-open.md)

## What

`app.is_commission_staff_of(_for)` was created by T6 (migration `20261003007460`) and has **zero
callers** — measured comment-stripped on the live catalog: **0 policies, 0 function bodies**. T7
does not change that, and the reason is structural rather than an oversight: T7's layer-3 doors
compose **`authz.has_permission` alone**, because the enforcement manifest's own validator refuses a
re-keyed row whose authorizer composes a non-permission grant path that is not a declared
`residualLegacyAuthority`. The wrapper is an implementation detail *inside* those doors' answer.

Its first callers can therefore only arrive with ADR
[0211](../decisions/0211-staff-gets-its-own-single-role-wrapper.md) D3's re-expression:

    app.is_member_of(c) := app.is_commission_staff_of(c) OR app.is_staff_admin_of(c)

## Why it is deferred — the reason is WITNESSING, not size

`425`, the differential every other T7 site is proven by, is a **grant-deletion** oracle: it removes
an `authz.role_permissions` row and requires the door to flip. The re-expression lives on the
**role** plane, where deleting a grant moves `is_member_of` by exactly nothing — before or after.

⛔ **The single change that would give this wrapper its callers is the one change T7's polarity
pair is structurally blind to.** It needs a differential of a different shape — a
membership-deletion pair — which is a different fixture, a different suite and a different
red-first order. That is what the named unit is for.

## Measured, so the deferral is not hiding a risk

- **Available.** Exactly **two** commission-scoped roles exist (`staff`, `staff_admin`) and, since
  T6, **both are `authoritative`** — D3's stated precondition.
- **The twin is already the same shape.** `app.is_staff_admin_of` is
  `select authz.holds_role((select auth.uid()), 'staff_admin', 'commission', p_commission_id)`.
- **Answer-preserving.** The membership plane and the assignment-facts plane agree on **22 of 24**
  commission tuples. The two that differ are precisely `gap.deactivated` (`is_active = false`) and
  `suspenso.temp` (suspended): `app.is_member_of` filters them with its own wrapper-level
  `app.is_active(auth.uid())`, `authz.assignment_facts` filters them at the FACTS level. Same
  answers, different level — the distinction pgTAP `426` § A2 already measures across all four
  principal states.
- **The hat is identical on both sides** (`has_role_any` and `holds_role` carry the same trailing
  term; the `_for` forms ignore it for a third party). PA-F8: R-2/P1's hat gate already covers that
  behaviour change and it is **not re-opened here**.
- **82 dependents** ride on the predicate today: **40 policies + 42 function bodies**.

## ⛔ This entry IS the renewal of A3's allow-list

T6's condition **A3** allow-listed the wrapper as a zero-caller authority with owner `backend` and
expiry **`T7`**. Deferring past T7 moves that expiry, so it is moved HERE and in ADR 0211 D1's
amendment, and the new bound is a **unit name**, not a date and not "a later increment".

⚠ An allow-list that outlives its own expiry with no clause naming a new bound is exactly the
failure A3 was written to prevent. If this follow-up is ever closed without the caller census moving
off zero, the allow-list has been dropped rather than discharged.
