# FUP-AE5-STAFF-QUALITY-OVERSIGHT-LOCKED-COUNT-IS-ORDER-DEPENDENT

**Filed:** 2026-09-15 (unit `AE5-STAFF`, R-7 production gate subset, by the lead) · **Owner:** tester
**Severity:** low — the production build and the seed are correct; the assertion reds whenever a spec that creates a locked case shares its batch and runs first.
**Status:** open

## The finding

`e2e/quality-oversight.spec.ts:343` asserts that the «Casos restritos» KPI equals the literal `'1'`. The card
shows `lockedCases` from `src/lib/queries/quality.ts`, which counts the `explicit_grants_only` cases of the
reviewer's commissions. The spec's own comment at `:329–332` explains why it derives «Casos visíveis» and «Em
aberto» from what renders: sibling specs in the same batch mint CCIH cases first. The locked count was left as
a literal.

On 2026-09-15 a subset production gate put `ethics-e3a-surfacing` and `ethics-e4-participants` ahead of
`quality-oversight` in one batch. Both create ethics cases through the real `create_case` RPC, and ethics
cases inherit `explicit_grants_only`. The KPI read `9` where the literal expects `1`, in
`quality-oversight.spec.ts:309` and `:1061`.

Two measurements on the same seed decided it:
- A fresh reset reads exactly one CCIH `explicit_grants_only` case.
- `quality-oversight` alone as its own production gate reads `GATE GREEN — 21 passed, 0 flaky, accounted 21/21`.

In the full `e2e:prod` runs the spec shares a batch with no ethics spec, which is why it was green there.

## Closes when

The locked-count assertion no longer depends on which specs share its batch. Either derive the expected value
from the database's own count of `explicit_grants_only` cases for the reviewer's commissions, read through the
service role before the assertion, or pin the literal to the seeded case by id. Show it green when
`quality-oversight` runs after `ethics-e3a-surfacing` and `ethics-e4-participants` in one batch, and red when
the UI count is wrong.
