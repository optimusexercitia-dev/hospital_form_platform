# 0168 — orphan recovery is its own door: split the branch, do not lock the door

**Status:** Accepted · 2026-08-28
**Amends:** 0165 (its § M11 widening is recorded there as **"unaccepted"**; this ADR is the written
ruling that ADR 0164 makes a hard pre-condition on the column drop. The widening is **not**
accepted — it is **split**.)
**Amends:** 0133 (its SUBSET bound is restored for the one population where it silently dissolved.)

## Context — the widening, and why it is not merely "an admin who knows a uuid"

`app.affiliate_person_to_org_impl` and `app.affiliate_person_impl` gate the person side with
*"known here, or known nowhere"*. For an **anchorless** person there are **zero** non-voided
affiliation rows, so the `EXISTS` is false and **the whole check falls through** — any org or
hospital admin holding the uuid may claim them.

⛔ **The consequence is not a roster entry. It is the SUBSET bound dissolving.** Claiming an
anchorless person yields a **Class-2 professional-identity read**, and then `cpf_change` and
`lifecycle` — a **CPF rewrite** and the **platform-wide deactivation kill switch**. The mechanism,
verified in `personScopeAllows` (`src/lib/users/person-scope.ts:146-159`):

- **INTERSECTION** (`fields`, `credentials`) — true if the caller administers **any** hospital in the
  footprint.
- **SUBSET** (`cpf_change`, `lifecycle`) — true only if the caller administers the person's
  **entire** footprint.

A **freshly claimed** person's footprint is **exactly the claiming hospital**. So the SUBSET loop
finds nothing outside the administered set and falls through to true, and the INTERSECTION loop
returns true on its first iteration. ⭐ **The two bounds coincide** — for exactly this one
population, and only because the claimer created the footprint they are then measured against.
**SUBSET was chosen deliberately to make lifecycle harder than fields; this path dissolves that
choice.**

⚠ **Architecture Rule 13 is NOT violated.** Membership still grants, affiliation still locates, and
the two steps remain separate. The defect is a different property, and naming it precisely matters
because the Rule-13 test would pass:

> **The locating fact became self-servable by the same actor who then exercises the grant.**

## Decision

**Split the branch. Do not lock the door.**

1. `app.affiliate_person_to_org_impl` / `app.affiliate_person_impl` **keep the tenant-tier door for
   their normal case** — a person **already known in this organization**.
2. The **"known nowhere"** branch routes instead to a **`platform_admin`-only orphan-recovery door,
   with its own audit verb.**

⛔ Not chosen: locking the door outright. Orphan recovery is a real need — an orphan is in no roster
and reachable only by uuid, so removing the path entirely strands them. The point is that recovery is
a **different operation with a different actor**, not a side effect of the ordinary affiliation door.

**Flip-cells already exist** and become the differential: `393` **W5/W6/W7** and **H4**.

**The producer is fixed separately and that is what keeps this rare.** ADR
[0166](./0166-governance-role-provisioning-implies-organization-affiliation.md) removes the standing
source of the orphan state — invite-provisioned admins, which QA round 2 measured as a **routine**
population rather than the exceptional one ADR 0164 assumed. ⭐ Without 0166 this recovery door would
be a routine path wearing an exceptional door's name.

## Consequences

- ⚠ **A new `public` door.** Its arm-domain membership is derived **per function from the catalog**,
  never inferred from the batch, and the arms it falls **outside** are named — absence of a verdict
  is absence of coverage. Its own audit verb is required, not optional: recovery must be
  distinguishable in the trail from an ordinary affiliation.
- ⚠ **A narrowing for org and hospital admins**, enumerated: they lose the ability to claim an
  anchorless person. That is the point, and `393` W5/W6/W7/H4 flip to refusals.
- **Pre-pilot context does not change the direction, and is stated so it is not re-argued.** No
  customers and disposable data **voids the production orphan-census input** — ⛔ do not wait on it —
  and **removes any existing-data repair increment.** So (b) is **cheaper now than it will ever be**.
- ⛔ **If this is ever overruled and the widening accepted instead, it must be bounded by a pgTAP
  assertion that REDS while the orphan-claim path is still tenant-reachable.** ⚠ **A dated
  "revisit before pilot" note will rot** — this repo has the receipts, and a bound that cannot fail
  is not a bound.
