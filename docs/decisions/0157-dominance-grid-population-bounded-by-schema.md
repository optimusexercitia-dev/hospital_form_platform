# 0157 — The dominance grid's population was bounded by SCHEMA, not by the property

**Status:** Accepted · 2026-08-26
**Supersedes:** nothing. **Amends:** 0079 (the standing door-audit invariant — a fourth
population-boundary failure, sibling to Amendment 7's `ARM=wrapper` finding), 0097 (D18 —
the dominance grid `303` that finding 9 established now adjudicates 19 further doors).

## Context

AFF4 B9 was asked to add the new `void_affiliation` door to the D18 dominance grid
(`supabase/tests/303_dominance_grid.sql`, "every gate admitting `is_hospital_admin_of`
also admits `is_org_admin_of`"). Measuring the grid's live population first — rather than
appending an assertion to it — showed the door was not in that population, and neither was
any other door built since AFF.

`303`'s gate set is *RLS policies in `public`* ∪ *`prosecdef` functions in `public`*, and
its population filter tests each gate's own `prosrc` for a hospital arm. The **actor-kernel
triple** (ADR 0098 §W2.1) puts the authority predicate in `app.<door>_impl`; the
client-callable `public.<door>` wrapper only delegates, so its body names neither
`is_hospital_admin_of` nor the literal `'hospital_admin'`. The `app` kernel was never a
candidate either — the gate set is `public`-only. Measured on the live catalog: the door
population was **13**; resolving each wrapper to its kernels makes it **32**.

⛔ **BLIND, NOT VULNERABLE.** All 45 gates in the widened population resolve as compliant —
zero gaps, before and after. What was broken is the detector's reach.

The file's own header claimed the population is "DERIVED FROM THE CATALOG at run time …
so a gate added next phase is adjudicated automatically". That sentence was false for every
door built in the triple shape, and nothing could contradict it: an empty verdict and a
clean verdict read identically.

## Decisions

**D1 — the grid resolves each `public` DEFINER door to its EFFECTIVE body**: its own source
plus the source of every `app` function it names. One hop, which is what the triple
guarantees; a transitive closure was measured and rejected (population 45 → 152, ~52 s
versus ~0.9 s, and it adjudicates doors on authority they do not express).

**D2 — built in two stages, for a measured reason.** Folded into the classifier's
`with recursive`, the same logic planned catastrophically (1 s → 53 s); split out but
resolving every door against every `app` function it was still 20 s. Narrowing to the doors
that can possibly enter the population, then resolving only those in full, restores ~1 s.
A 20× slowdown in a per-phase-gate suite is how a correct check gets deleted later.
⚠ The narrowing is exact, not an approximation: population entry *requires* a hospital arm,
so a door reaching no hospital-bearing kernel cannot enter however its org side resolves.

**D3 — the widening carries its own non-vacuity assertion** (`1.7`): 15+ real doors must be
in the population ONLY because a kernel was resolved. Without it a `strpos` typo or a schema
rename makes the resolution a silent no-op and `1.2` keeps reporting "no gaps" unchanged.

**D4 — two synthetic controls for the new shape** (`2.6`/`2.7`): a `public` wrapper whose
only hospital arm sits in an `app` kernel, with and without an org arm, anchored on things
correct by construction. Before the widening neither was in the population at all.

**D5 — absence is asserted with its reason** (`1.9`): AFF4's four org-tier doors are
correctly ABSENT, because D2 gives them no hospital_admin arm to dominate. Asserting the
absence means a future author who adds a hospital arm lands in `1.2` instead of in a
silence that looks the same.

## Consequences

- The generalisation, stated for the third time on this project: **a population's boundary
  must be the PROPERTY, not a location.** ADR 0079 Amendment 7 found an INVOKER wrapper in
  front of a DEFINER body escaping the door sweep because every arm bounded its domain by
  `prosecdef`; this is the same failure bounded by *schema*. Both were invisible for the
  same reason — the arm returned a clean verdict over a domain that excluded the subject.
- `303` goes `plan(12)` → `plan(17)`; runtime 1 s → ~3 s.
- ⚠ This does NOT widen the grid to `app`-schema kernels as gates in their own right. They
  are resolved only through a reachable `public` door, which is the property the invariant
  is about — an unreachable kernel dominates nothing.
- Not a substitute for `ARM=census`: the census asks whether a gate has ever been swept;
  this asks whether a swept gate satisfies dominance.
