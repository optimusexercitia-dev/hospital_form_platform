# 0211 — `staff` gets its own single-role wrapper, and the cutover is proven without a candidate twin

**Status:** proposed
**Area:** authorization / AE5 increment 1
**Related:** 0174, 0201, 0207

---

## Context

AE5 increment 1 substitutes `staff` into the `authz` catalog through the AE4 per-role template
([`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § Phase AE5, Proposed order item 1;
ADR [0207](./0207-the-role-catalog-holds-roles-administrativo-is-a-capability-provider.md) D6 rules
`staff_admin` the already-authoritative baseline, so `staff` is item 1). The template's cutover step
is *"atomic wrapper cutover (to `holds_role`, layer 1)"* — for `staff_admin` that was one
`create or replace` per wrapper, turning `app.is_staff_admin_of(_for)` into a delegation to
`authz.holds_role(…, 'staff_admin', …)`.

**`staff` has no wrapper to cut over, and the difference is structural rather than incidental.**
Measured on the live catalog 2026-09-13 (`pg_get_functiondef`, comment-stripped; ⛔ no migration file
was read — ADR [0078](./0078-authorization-capability-model.md), LEARN-057):

```sql
app.is_member_of(p_commission_id uuid)                     -- prosecdef=t, STABLE
  select app.is_active((select auth.uid()))
     and app.has_role_any('commission', p_commission_id, (select auth.uid()));

app.is_member_of_for(p_commission_id uuid, p_user_id uuid) -- prosecdef=t, STABLE
  select app.is_active(p_user_id)
     and app.has_role_any('commission', p_commission_id, p_user_id);
```

Neither names a role. `app.has_role_any` is satisfied by **any** commission-tier membership row, so
these are **role-SET** predicates: `staff` ∪ `staff_admin` ∪ any future commission role. Three further
facts, all measured, bound the decision:

1. **No commission-scope predicate names `staff`.** `prosrc ~ '''staff'''` over `app`/`public`/`authz`
   returns **3** functions — `app.grant_role_impl`, `app.revoke_role_impl`,
   `public.appoint_administrativo` — and all three name it to *administer* the role, never to
   exercise it. **Zero** policies carry the literal.
2. **`authz.holds_role` has exactly two live dependents**, `app.is_staff_admin_of` and
   `app.is_staff_admin_of_for`, each a one-line delegation. That is the shape a `staff` cutover must
   mirror, and there is nothing today for it to mirror *into*.
3. ⛔ **There is no `candidate_holds_role`.** The `authz` schema holds ten functions and none is a
   candidate twin of `holds_role`, whose body requires `r.state = 'authoritative'`. The permission
   plane has a candidate evaluator (`authz.candidate_has_permission`, which also admits
   `test_validation`); **the role plane does not.**

Fact 3 is what makes this ADR necessary rather than a naming note: the AE4 template's confidence came
from differentialling the new path *before* the cutover, and for a role wrapper that pre-flight does
not exist.

## Problem

Three questions, and the third only becomes visible once the first two are answered:

- **P1.** What does `staff`'s enforcement re-key point *at*, given no single-role predicate exists?
- **P2.** How is the cutover proven correct, given the role plane has no `test_validation`-aware
  evaluator to differential against?
- **P3.** What happens to `app.is_member_of(_for)` itself — the predicate **82 live catalog objects**
  depend on (40 policies + 42 function bodies; measured, against the ~200 hits a `supabase/migrations`
  text grep reports, which counts history)?

## Decision

### D1 — `staff` gets its own single-role wrapper, `app.is_commission_staff_of(_for)`

Two new `SECURITY DEFINER` functions, mirroring the `staff_admin` pair one for one:

```sql
create or replace function app.is_commission_staff_of(p_commission_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select authz.holds_role((select auth.uid()), 'staff', 'commission', p_commission_id);
$$;

create or replace function app.is_commission_staff_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select authz.holds_role(p_user_id, 'staff', 'commission', p_commission_id);
$$;
```

- **`search_path = ''` + a schema-qualified body**, per ADR
  [0208](./0208-the-candidate-fanout-is-structurally-dominated-and-empty-search-path-is-the-sole-forward-convention.md)
  D4. ⛔ These are NEW DEFINERs, so the frozen non-empty-path population may not grow by two; pgTAP
  `419` + gate 18 hold the path and `421` holds the body.
- **The caller-keyed / subject-keyed PAIR is created together**, per ADR
  [0200](./0200-professional-identity-predicates-answer-about-their-subject.md): a predicate
  parameterised on a principal owes its `_for` twin, and every site is re-keyed onto the member of
  the pair whose subject matches the question the site asks (matrix § 5.4 declares that per site).
- ⛔ **The wrapper is layer 1 — the assignment-projection layer — and is NOT a permission check.**
  ADR [0174](./0174-authz-holds-role-chokepoint-and-authoritative-state-gate.md)'s argument stands and is the reason this is a
  wrapper at all: a role question cannot be routed through a permission resolver, because a sentinel
  code breaks on its own revoke and *"holds any staff-granted permission"* becomes true for a
  `staff_admin` the moment the two roles share a code — which, after AE5 increment 1, **18 of them
  do**. The enforcement sites are re-keyed to layer-3 `app.can_*` authorizers carrying their
  permission code as a greppable literal (T7); this wrapper exists for the residual role questions
  that are genuinely about the role.

### D2 — the cutover is proven by a THREE-PART obligation, because no candidate twin exists

⛔ **Not by a pre-flight differential** — there is none to run (fact 3). The proof is assembled from
three parts, and no one of them is sufficient:

1. **The migration's own snapshot/assert block**, mirroring `20261003007210:117-119`: **name ·
   signature · `prosecdef` · volatility · `search_path` · ACLs** captured before the
   `create or replace` and asserted after. This is what makes the change *atomic* rather than merely
   *applied* — it refuses a rewrite that silently changed a security property.
2. **A pgTAP differential under `test_validation`, run against the CONSTRUCTED equivalent rather
   than against a candidate twin.** `authz.holds_role` refuses a non-`authoritative` role, so the
   pre-cutover comparison cannot call it. It CAN, however, compare the wrapper's intended semantics
   to the legacy predicate restricted to the same role:

   > for every seeded principal × every commission,
   > `app.has_role_any('commission', C, u)` **restricted to `staff` rows**
   > ≡ what `app.is_commission_staff_of_for(C, u)` will answer once `staff` is `authoritative`.

   The restriction is the whole content: `has_role_any` is a SET predicate and the wrapper is not, so
   an unrestricted comparison would report every `staff_admin`-only membership as a divergence.
   ⚠ This is a **constructed** oracle, and its bound is stated rather than hidden: it proves the
   wrapper agrees with the legacy predicate's `staff` slice, **not** that `holds_role` behaves under
   `test_validation` — it cannot, because `holds_role` refuses that state by design.
3. **PA-F8-STAFF-2's condition, asserted rather than assumed.** The hat-grain difference between
   `has_role_any` (the hat may match ANY role held in the scope) and `holds_role` (the hat must match
   the code asked about) is unreachable **only** while two structural facts hold, and both are
   asserted in the cutover's pgTAP:
   - `memberships_one_commission_role_uq` — `UNIQUE (principal_id, commission_id) WHERE commission_id
     IS NOT NULL` — measured 2026-09-13 to raise `23505` on a second commission-tier row for one
     principal, which is what makes the dual-role state unconstructible;
   - `memberships_scope_shape`'s commission tier is exactly `{staff, staff_admin}`.

   ⛔ Dropping the index or widening the tier re-opens the divergence **silently**. That is why the
   condition is a cell, not a sentence.

⭐ **Why the three are not redundant.** (1) sees a changed security property and nothing about
answers; (2) sees a changed answer and nothing about properties; (3) sees neither — it guards the
premise under which (2)'s equivalence is total rather than sampled.

### D3 — `app.is_member_of(_for)` STAYS a role-set predicate until both commission roles are authoritative

⛔ **This increment does not touch it.** Re-expressing it as
`holds_role(u,'staff',…) OR holds_role(u,'staff_admin',…)` is answer-preserving — measured: the two
are hat-equivalent by index (D2 part 3), and `authz.assignment_facts` applies the same `app.is_active`
and `expires_at` terms `has_role_any` does — but `holds_role` returns **false for a non-authoritative
role**, so performing the re-expression while `staff` is `legacy` or `test_validation` would silently
delete every plain member's reach across **82** catalog objects.

The re-expression is therefore sequenced: it lands in the increment that flips `staff` to
`authoritative`, **after** the flip, in the same migration, with the same snapshot/assert block.
⚠ Until then `is_member_of(_for)` is the live predicate for the member surface and the 82 dependents
stay on it; the matrix's per-site declarations (§ 5.4) are what say which of them the T7 re-key moves
to a layer-3 authorizer instead.

## Considered options

**For D1.** *(a) A single-role wrapper (chosen).* Mirrors the proven AE4 shape; one `create or
replace` per side; the pair is created together so no site has to choose between a caller-keyed and a
subject-keyed arm. *(b) Re-express `is_member_of` directly as the two-arm disjunction.* Rejected for
D3's reason — correct only after both roles are authoritative, and doing it early is an 82-object
silent revocation. *(c) Route the role question through a permission code.* Rejected by ADR 0174, and
AE5 increment 1 makes its failure concrete: `staff` and `staff_admin` now share 18 codes, so
"holds a staff-granted permission" no longer distinguishes them at all.

**For D2.** *(a) Build a `candidate_holds_role` twin.* Rejected as scope the increment does not need
and a second evaluator to keep in agreement forever — the AE4.4 corrections split candidate from
runtime for the PERMISSION plane deliberately, and duplicating that split on the role plane doubles
the surface for one increment's convenience. *(b) Cut over and rely on the E2E suite.* Rejected: an
E2E green after a wrapper swap is evidence about the paths the suite happens to walk, and the fixture
audit (`docs/testing/ae5-staff-fixture-gaps.md`) measured how few of `staff`'s coordinates it reaches.
*(c) The three-part obligation (chosen).*

## Consequences

- T6 (the cutover migration) owes all three parts of D2; a green from any one of them is not the
  proof. ⛔ The `staff` flip to `authoritative` and the wrapper's `create or replace` land in the SAME
  migration — `holds_role` returns false for a non-authoritative role, so a wrapper created before the
  flip is a wrapper that denies everyone.
- T7's re-key points sites at layer-3 `app.can_*` authorizers, not at this wrapper. The wrapper is for
  the residual role questions; the matrix § 5.4 table names which site is which.
- ⚠ **`app.is_member_of` carries an unreachable `PUBLIC EXECUTE` ACL entry that its own `_for` twin
  does not** (measured 2026-09-13). The new pair must be created with the `_for` twin's ACL shape, not
  the bare one's, or the increment propagates a stray grant. ⛔ Not a licence to REVOKE the existing
  one — that is filed, and a revoke also removes a function from `ARM=floor`'s domain.
- ⚠ Neither `is_member_of`, `is_member_of_for` nor `has_role_any` carries a header comment today, so
  the three-deep template clause (ADR 0193 D5 · ADR 0200 · ADR 0201 D3) has **no carrier** on the
  predicates this increment cuts over. The new pair carries it from birth.
- D3 leaves a dated obligation on a later increment. It is named here rather than left implicit
  because *"re-express `is_member_of`"* reads like tidy-up and is in fact the moment the member
  surface changes evaluator.
