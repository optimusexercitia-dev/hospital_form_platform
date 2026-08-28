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

## Amendment 1 — the split is THREE doors, not two, and the two-door form closed person creation (2026-08-28)

⛔ **The Decision above, taken literally, closes the product's person-creation path for both tiers.**
Found by the implementer reading the impl bodies out of the catalog **before writing any SQL**, and
verified by the lead.

### The mechanism

*"Known nowhere"* is not one population. **Once `home_organization_id` is dropped, an anchorless
person and a just-created person are the SAME DB STATE** — a profile with zero affiliation rows of
any tense. Live probe on a virgin profile (rolled back): the current gate admits **TRUE**; *"known
here"* alone admits **FALSE**. The broken callers are `registerUser`
(`src/lib/users/actions.ts:796`, org_admin registrar) and `ensureActiveAffiliation` (`:405`, the
hospital_admin registrar path) — both affiliate an id they **just created**.

⛔ **pgTAP `393` already said so, and the ADR named a quarter of it.** Eight cells depend on the
anchorless branch — **W3, W5, W6, W7, H1, H4, H6, F1** — across five sections, not the four this ADR
listed. **W3 is labelled `(PERSON CREATION)` and differs from W5 only in the column under drop**;
`§ 3.8` is titled *"NON-VACUITY OF THE PERSON-CREATION CELL"*. **H6** is a fifth flip-cell (H4's state
through the org_admin arm). ⚠ **After the drop no predicate over DB state can separate a creation
from an orphan claim.**

⛔ **ADR 0165 predicted this and this ADR adopted the alternative 0165 had rejected, for the reason
0165 gave** (`0165:129-131` — out of scope *"because it would leave person **creation** with no
admissible path until that door exists"*). The lead amended 0165 without reading its own
rejected-alternative reasoning. Recorded as the lead's defect.

### The correct diagnosis, which this ADR should have contained

> **The split cannot be a predicate over state; it has to be a split over DOORS, because the door's
> ACL is the only durable discriminator left.**

That is a real architectural consequence of dropping the column, not a workaround: *who is calling,
and through what* is the only thing left that distinguishes the two populations.

### ⚖ Decision, amended (PO-ruled 2026-08-28): THREE doors

1. **Ordinary affiliation** — the tenant tier, *"known here"* only.
2. **Recovery** — `platform_admin`-only, own audit verb (unchanged from the original decision).
3. **Creation** — **`service_role`-only, own audit verb**, called by the two registrars, admitting the
   anchorless state.

**The third door is a real bound, measured, not assumed.** Catalog closure over `pg_proc` (comments
stripped first, because both impls cite themselves in their own headers) **terminates at depth 1**:
exactly four PostgREST-reachable wrappers over two owner-only bodies, no second predicate anywhere.
TypeScript closure: **3** production call sites — two `service_role` with `p_user` created in the same
request, and **one** client-supplied: `affiliate_person`
(`src/lib/affiliations/actions.ts:214`), on the `authenticated` client, **with zero TypeScript
authorization by explicit design** (*"NO AUTHORIZATION LIVES HERE"*), at the **hospital** tier. ⭐
**That single site is the entire exposure and it is the door the narrowing closes.**

⚠ **Residual, graded rather than collapsed to "safe":** the channel that could steer `userId` to a
pre-existing orphan is a `createUser`/`invite` call returning an existing id, closed by a
`profiles.email` collision guard that is **currently total** (0 NULL of 36 live rows, two sync
triggers) over a column that is **nullable by schema**. A live-closed hole with a schema-level
residual — **not** an impossibility.

**Why three rather than narrowing only the two `authenticated` doors:** both close the same hole,
since site 1 is the whole exposure. They differ in what they **leave**. The two-door form keeps the
anchorless branch alive inside the shared `_impl`, so **the next caller added to a `_for` twin
silently inherits the widening and no gate can notice** — the exact inheritance shape that has
produced five sibling-axis defects in this phase. Three doors removes the branch from the shared body
and re-introduces it behind an ACL and an audit verb that **are** the record.

### Three costs the implementation must price in, none obvious from the original text

- ⛔ **A TypeScript MIRROR that no call-site sweep would surface.** `resolveOrInviteUser`
  (`src/lib/members/invite.ts:105-121`) re-implements this gate — `listNonVoidedOrgAffiliationsFor`
  plus an `is_admin` arm — on a path where **no SQL door ever runs**, and its own comment names
  `app.affiliate_person_to_org_impl` as what it mirrors. Narrowing the SQL alone **drifts it, and no
  gate would red.** It is re-cut in the same increment.
- ⛔ **`393 § 5.7` is a catalog-derived sibling pin whose needle is the predicate's SHAPE**
  (`if exists (…) … HC0R0`, asserting `1|2`). The rewrite makes it stop matching → `0|0` → red. It is
  **re-cut as a real pin, never made to match** — a needle edited to fit is a pin that has stopped
  pinning.
- ⚠ **`public.affiliate_person_to_org` has ZERO TypeScript call sites** yet holds `authenticated`
  EXECUTE. Reachable and uncalled; rule on it in the increment rather than leaving it as found.
