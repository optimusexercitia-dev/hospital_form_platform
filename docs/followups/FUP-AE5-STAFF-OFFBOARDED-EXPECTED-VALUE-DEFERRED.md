# FUP-AE5-STAFF-OFFBOARDED-EXPECTED-VALUE-DEFERRED

**Filed:** 2026-09-15 (unit `AE5-STAFF`, R-7, by the lead) · **Owner:** lead
**Severity:** medium — a principal-state class that the `staff` differential cells do not exercise.
**Status:** open

## The gap

The AE5-STAFF fixture-gap list (`docs/testing/ae5-staff-fixture-gaps.md` § 8) names the `offboarded`
principal state. Its mechanism exists (ADR 0163), and backend measured on 2026-09-15 that 32 seeded
profiles already hold no live affiliation. But the generated cells vector excludes the class, because
no expected value per coordinate was ever approved. The matrix approval of 2026-09-13 approved the
coordinate set and explicitly did not approve per-class expected values.

So `staff`'s authorizers are not differentially tested for a principal whose affiliation has ended.
Other suites may cover the state for other roles, but no AE5-STAFF cell asserts it.

## The ruling that deferred it

PO ruling R-7 on 2026-09-15, verbatim: "Proceed with (a), and defer offboarded". The record is
`docs/progress/ae5-staff.md` § Open rulings, R-7.

## Closes when

The PO states the expected value of each `staff` coordinate for an `offboarded` principal. The cells
vector includes the class with those values, a fixture binds one offboarded `staff` principal without an
id shared across cases, and one cell is shown able to red by giving that principal a live affiliation.
