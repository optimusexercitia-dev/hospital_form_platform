# 0159 — an invariant backstop runs as DEFINER; two correct decisions can compose into a break

**Status:** Accepted · 2026-08-26
**Amends:** 0151 (D4's containment trigger was implemented SECURITY INVOKER, which made the
invariant unenforceable-and-false-positive for `hospital_admin`; the security context is now part
of D4's mechanism, not an implementation detail.)

## Context

ADR 0151 D4 requires that an **active** hospital affiliation always have an **active** organization
affiliation, and migration `20261003004000` implemented that as a deferred constraint trigger,
`app.assert_hospital_affiliation_has_org`, created **SECURITY INVOKER**.

Its `exists` against `public.organization_affiliations` therefore ran under the **calling user's
RLS**. That table's SELECT policy is
`(principal_id = auth.uid() OR app.is_org_admin_of(organization_id))` — it has **no hospital tier,
by design** (ADR 0151 D1, pinned by pgTAP `375` §4.1, reaffirmed by ADR 0158 D2).

So ADR 0151 D5's one-step rehire was **broken outright for every `hospital_admin`** — 100%
reproducible, through the UI and a raw `affiliate_person` RPC alike:

1. `app.affiliate_person_impl` (DEFINER) correctly creates the active org parent;
2. it then inserts the hospital affiliation;
3. the deferred trigger fires and, reading as the `hospital_admin`, **cannot see the parent row
   created one statement earlier**;
4. it raises a false-positive `23514` and the entire transaction rolls back.

### ⭐ The shape, which is the durable part

**Two individually-correct decisions composed into a break.** A deliberately narrow policy (D1) is
right. A backstop enforcing a data invariant is right. Neither is wrong alone; the defect exists
only in their composition, and it lives in a **security context**, which is not visible in either
decision's own text.

### Why no test caught it

`380` §6 covers D4 containment thoroughly — orphan refused, ended-orphan accepted,
child-before-parent accepted — but **every arm runs as the privileged suite role**. It varies the
**state** and never the **actor**. A containment arm that varies only the state cannot see this
class at all, and its thoroughness on the other axis is exactly what made the gap invisible: a
half-swept class is hardest to see when it is buried under real evidence.

The standing corollary — ***`prosecdef` belongs beside `pg_policies`*** — was not applied to a new
**trigger** function. The census disposition had separately (and correctly) ruled this function
"not an authorization decision (reads no caller identity)", which is precisely *why* it should never
have been running under caller RLS.

## Decision

**D1 — the containment trigger is SECURITY DEFINER** (`20261003004300`), with a pinned
`search_path` and owner-only EXECUTE, both re-asserted explicitly in the same migration.

It **grants nobody anything**: it reads no caller identity (no `auth.uid()`, no `app.has_role`, no
`app.active_role()`), returns `trigger`, is not callable as an ordinary function, and its only
outcome is to raise or not raise. DEFINER simply lets an invariant check **see the data it is
asserting over**.

**D2 — the general rule.** A function that enforces a **data invariant** must not read that data
through the caller's RLS. Invariants are properties of the *database*, not of a viewer; an invariant
evaluated through a viewer's lens is not an invariant. Conversely a function that makes an
**authorization decision** stays INVOKER unless it has a stated reason. The discriminator is *"does
it read caller identity?"*, not *"is it a trigger?"*.

**D3 — the fix is NOT a hospital tier on `organization_affiliations_select`.** Widening a
deliberately-narrow policy to make a backstop work trades a data-invariant bug for a privilege
grant — never fix a read by granting access (ADR 0158 D2).

**D4 — containment coverage must vary the ACTOR.**
`supabase/tests/381_containment_actor_dimension.sql` performs the identical D5 rehire as an
`org_admin` (control: passed before *and* after) and as a `hospital_admin` (keystone: `23514`
before, passes after). Same state, same door, different caller.

## Consequences

- **`381` §2.2 pins which fix is in place.** It asserts the `hospital_admin` *still* reads zero
  `organization_affiliations` rows after the change, so a later "fix" that widens the policy cannot
  masquerade as this one. §2.3 measures the same row without RLS as `1` — that 1-vs-0 gap **is** the
  blindness that broke the rehire. §3.1 pins `prosecdef = true` so the property cannot be reverted
  silently.
- **The door audit's predicate arm does not cover this function**, and that is correct rather than a
  gap: its domain is bounded by `t.typname='bool'`, and this returns `trigger`. `ARM=census` reports
  it outside the domain for the same reason. Recorded as a checkable claim, not a silence.
- ⚠ **`scripts/door-sweep-cases.sh` is blind to `alter function … security definer`.** Its function
  branch requires the literal `security definer` **and** `returns boolean` **and** an identity regex
  inside a `create function` block, so a migration that *flips* `prosecdef` on an existing gate
  derives **zero cases** — the exact analogue of Amendment 8 ruling 1 (`alter policy` is not
  `create policy`). Harmless here (out of domain anyway), but a `prosecdef` flip on a **boolean**
  gate would be a real miss. Filed for the lead to rule on; not fixed in this change.
