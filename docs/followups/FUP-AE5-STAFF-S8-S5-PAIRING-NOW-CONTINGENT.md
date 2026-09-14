# FUP-AE5-STAFF-S8-S5-PAIRING-NOW-CONTINGENT

**Filed:** 2026-09-14 (unit `AE5-STAFF`, T7; lead ruling L20) · **Owner:** backend
**Severity:** medium — no live defect today; a derivation that was STRUCTURAL is now CONTINGENT on
a catalog fact, and nothing gates that fact.
**Status:** open

## What changed

`app._case_caps`'s S8 arm (`administrativo_read_cases`, ADR 0134 D6, bounded by Amendment 4) sets
`read_case_content` for an appointed Administrativo. Amendment 4 §A4.2 derives its safety
**structurally**: S8's guard is `app.member_can_for(v_commission, 'read_cases', p_uid)`, whose
third conjunct was `app.is_member_of_for(v_commission, p_uid)` — *literally the call that assigned
`v_member`* for S5. So `v_member` could not be false while the S8 guard was true, and an appointee
always held content (S8) **and** deliberation (S5) on an ordinary case.

Lead ruling L20 moved S5 onto `app.can_cases_deliberation_read_in_commission` — a PERMISSION check
— while `app.member_can_for` still asks the MEMBERSHIP question. The two predicates are no longer
the same call, so the derivation is no longer structural.

## Why it still holds today, measured

Measured in the live catalog 2026-09-14:

- the only two commission-tier roles present in `public.memberships` are `staff` and `staff_admin`;
- both hold `commission.cases.deliberation.read` in `authz.role_permissions`.

So `app.is_member_of_for(commission, uid)` still implies the permission, and S5 still pairs with
S8. That is a fact about the **catalog**, not about the **text**.

## The hazard

A future commission-tier role that does **not** hold `commission.cases.deliberation.read` would
set **content without deliberation** for an appointee — which is
`app.is_oversight_only_reader`'s exact bit shape, and the collision Amendment 4 §A4.2 exists to
close. Nothing currently reds on that: no gate asserts the implication, and the S8 comment now
records the contingency in prose only.

## Closes when

Either

* a gate asserts the implication directly — every role that can appear as a commission-tier
  `public.memberships.role` holds `commission.cases.deliberation.read` — shown able to red by
  planting a commission-tier role without the code and observing `_case_caps` produce
  content-without-deliberation for an appointee; or
* S8's guard and S5's assignment are re-united on one predicate, restoring the structural
  derivation, with the same plant used as the discrimination half.

⛔ A gate that merely re-states the current two-role catalog is not a closure: the hazard is a
role that does not exist yet, so the plant is the whole proof.

## Where the contingency is recorded

Inside `app._case_caps`'s S8 comment block, rewritten by `20261003007470_ae5_staff_t7_rekey.sql`.
That comment previously claimed `member_can_for`'s third conjunct **is**
`app.can_cases_deliberation_read(v_commission, p_uid)` — false in two ways at once: T7's
mechanical substitution had rewritten the comment text along with the code, and `member_can_for`
was never rewritten at all. Read the live body, not the migration (ADR 0078).
