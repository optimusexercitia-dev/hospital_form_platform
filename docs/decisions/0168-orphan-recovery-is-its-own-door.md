# 0168 — orphan recovery is its own door: split the branch, do not lock the door

**Status:** Accepted · 2026-08-28
**Amends:** 0165 (its § M11 widening is recorded there as **"unaccepted"**; this ADR is the written
ruling that ADR 0164 makes a hard pre-condition on the column drop. The widening is **not**
accepted — it is **split**.)
**Amends:** 0133 (its SUBSET bound is restored for the one population where it silently dissolved.)
**Amends:** 0166 (Amendment 3 — its clause 5/6 tenancy gate is narrowed for the anchorless
population, on the `authenticated` half of its reachability only.)

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

## Amendment 2 — the implementation shape, measured before it was written (2026-08-28)

**Amends:** this ADR's own Amendment 1, by fixing the four things its "three doors" left open.
Every claim here was derived from `pg_proc` / `pg_trigger` on a fresh reset, not from migration
text.

### 1. The creation doors keep TODAY's predicate. Their bound is the ACL, not the state.

⛔ **A creation door that REQUIRED anchorless would break org_admin registration.** `registerUser`
calls the ORG creation door first and the HOSPITAL creation door second, so by the second call the
person **is already known to that organisation** — the org door just made them so. A strict
`anchorless`-only creation door refuses its own sibling's output.

So each creation door carries `person_is_anchorless(p_user) OR person_known_to_org(p_user, <org>)`
— **exactly the predicate both doors carry today** — and what makes it a *creation* door is that it
is reachable **only by `service_role`** and emits its own audit verb. That is this ADR's own
diagnosis applied honestly: *the door's ACL is the only durable discriminator left.* The widening
is not deleted; it is moved behind an ACL and a verb that **are** the record.

⭐ Keeping BOTH creation doors on ONE shared predicate is also what keeps the sibling pin
expressible: **four doors, two predicate-sets, ordinary ⊂ creation.**

### 2. Recovery is ORG TIER ONLY, and that is a measured bound rather than a scope cut.

Recovering an orphan gives them an **org anchor**; from that moment `person_known_to_org` is true
for that organisation, so the **ordinary** hospital door admits them by its normal rule. A
hospital-tier recovery door would be a second way to do what the ordinary hospital door already
does one step later. `393`'s H4 — a hospital_admin claiming an orphan — therefore becomes a
refusal with a named remedy, not a capability that moved.

### 3. The audit verb is an ADDITIONAL `app.audit_write`, because the trigger cannot know the door.

Measured: `app.trg_audit_organization_affiliations` derives its verb from `tg_op`
(`INSERT → org_affiliation.created`) and has **no channel** telling it which door inserted. So each
new door emits its own `app.audit_write` **in addition to** the trigger's row. The trail carries the
**row fact** and the **act** separately, which is what "distinguishable in the trail" requires.
`audit_log.action` carries only a shape CHECK (`position('.' in action) > 1`), so new verbs need no
enum migration.

### 4. ⚖ RULED — `public.affiliate_person_to_org` KEEPS its `authenticated` grant.

Amendment 1's third cost said to rule on it rather than leave it as found. **Ruled: keep it**, and
the reason is the point:

- it is the org-tier **ordinary** door, symmetric with `public.affiliate_person`, which *is* called;
- after this increment it carries the **narrow** predicate, so the exposure Amendment 1 named is
  closed **by the narrowing**, not by the grant;
- pgTAP `379 § 2` / `§ 5.1` and `380` **do** exercise it as `authenticated`. Revoking would delete
  real, exercised coverage of the org-tier authority arm to buy a surface reduction on a door that
  is no longer wide.

⛔ The grant is now **pinned by an assertion**, so it is a decision and not an accident. "Zero
production callers" stays true and stays recorded; it is a reason to watch the door, not a reason to
revoke a tested one.

### 5. ⭐ The TypeScript mirror does NOT narrow — and its comment was ALREADY false.

Amendment 1 required `resolveOrInviteUser` (`src/lib/members/invite.ts`) to be re-cut in the same
increment or drift. Measured, the re-cut is a **comment** change, not a behavioural one:
`resolveOrInviteUser` is a **provisioning** path, so the door it mirrors is the **creation** door —
whose predicate is unchanged. Mirroring is preserved by leaving the predicate alone and **renaming
what it points at**.

⛔ Two of its stated facts were false **before this increment**, and neither had a gate:

- *"neither `assignStaffAdmin` nor `assignOrgAdmin` creates an org affiliation for the user it
  invites"* — true of the **TypeScript callers**, false of the **outcome** since ADR 0166 moved that
  write into `app.grant_role_impl` (catalog-verified: `grant_role_impl` calls
  `app.ensure_provisioned_org_affiliation` for `(organization, org_admin)` and
  `(commission, staff_admin)`). The comment names a call-site absence and reads as an outcome.
- *"re-affiliation is the recovery path"* (ADR 0165 D1) — **this ADR replaces it** with
  `public.recover_orphan_person_to_org`.

⚠ Measured while ruling this: narrowing the mirror would have introduced an **aborted-run wedge** —
invite succeeds, `grant_role_for` fails, and that e-mail becomes permanently unprovisionable because
`guard_profile_no_delete` forbids deleting the profile. Today's wider predicate self-heals from that
state. That is a second, independent reason the mirror stays wide, and it is why "narrow everything
for symmetry" would have been wrong.

## Amendment 3 — there is a FOURTH tenant-reachable door, and the split applies to it too (2026-08-28)

**Amends:** 0166 (its clause 5/6 tenancy gate is narrowed for the anchorless population, on the
`authenticated` half of its reachability only).

### The finding, measured live rather than read

This ADR's Decision and Amendment 1 both enumerate **two** doors. A live probe on a fresh reset
found a **third tenant-reachable** one carrying the same anchorless-admitting predicate:

```
public.grant_role  (authenticated)  →  app.grant_role_impl  →  app.ensure_provisioned_org_affiliation
```

| Probe (fresh reset, 2026-08-28, rolled back) | Result |
| --- | --- |
| `org_admin` of Rede A → `grant_role('organization', A, 'org_admin', <orphan uuid>)` | **ACCEPTED** — orphan gained **1 active org-A affiliation AND 1 `org_admin` membership** |
| commission `staff_admin` → `grant_role('commission', …, 'staff_admin', <orphan uuid>)` | REFUSED `42501` |

So the exposure is bounded to the **`(organization, org_admin)`** arm — `org_admin` or
`platform_admin` — and it delivers **strictly more** than the two doors this ADR closed: the anchor
*plus* a governance role on top of it.

⛔ **The predicate is a VERBATIM COPY, and that door's own header forbids exactly what nearly
happened here:** *"THE TENANT GATE IS LIFTED FROM `app.affiliate_person_to_org_impl` AND KEPT
IDENTICAL, DELIBERATELY … Splitting identical siblings across increments is how this phase produced
'one axis was swept, its sibling was not' three times."* Narrowing the two `affiliate_person*` impls
and leaving this one **is** that split — and `393 § 5.7`'s sibling pin ranges over only the two
`affiliate_person*` impls, so **no gate would have noticed**.

### ⭐ Why the obvious fix is wrong, and what the case teaches

`ensure_provisioned_org_affiliation` exists to anchor a **just-invited** person: `resolveOrInviteUser`
invites, then the role grant anchors. Narrowing it to *"known here"* would refuse **every first-time
provisioning** — ADR 0166's entire purpose.

> **This door is CREATION-BY-FUNCTION but ORDINARY-BY-ACL — the one case Amendment 1's
> "the door's ACL is the only durable discriminator left" does not resolve.**

The diagnosis holds only where a door's ACL already matches its job. Where it does not, **the ACL has
to be made to match** — which is the decision below, not an exception to it.

### ⚖ Decision (PO-ruled 2026-08-28): split `grant_role` the same way

1. `public.grant_role` (**`authenticated`**) routes to the **narrowed** ensure — *known here* only.
   An org_admin can no longer anchor an anchorless uuid by granting it a role.
2. `public.grant_role_for` (**`service_role`**) keeps the **wide** ensure — it is the provisioning
   path, and its ACL is now what says so.
3. `assignStaffAdmin` (`src/lib/admin/actions.ts`) moves from `grant_role` to `grant_role_for`.
   ⭐ **No security is traded:** the `_for` twin takes the actor explicitly and **re-derives the same
   authority in PostgreSQL**, which is the pattern every other service-role path in this repo already
   uses (`affiliate_person_for`, `finalize_invited_person_for`, …). `assignOrgAdmin` already uses
   `_for`.
4. Orphan recovery keeps its own door (`public.recover_orphan_person_to_org`) — unchanged.

### Consequences

- ⚠ **`public.grant_role` is now NARROWER than `public.grant_role_for` on the target-tenancy axis.**
  The two twins have been deliberately identical everywhere else; this is the first asymmetry and it
  must be **pinned by an assertion**, or the next reader "restores symmetry" and silently re-opens
  this. The asymmetry IS the control.
- ⚠ **This is a NARROWING.** Expect fixture reds in pgTAP `396` (ADR 0166's suite) and in any e2e
  provisioning spec that seats a role on a person with no org affiliation. ⛔ A red there is a
  **reachability finding, not a test to patch** — and per ADR 0167 clause 1's precedent, watch for
  the more dangerous shape: a cell that goes **vacuous rather than red**.
- ⭐ **The enumeration lesson, stated so it is not re-learned:** this ADR's door census was derived
  from the `affiliate_person%` name family, and the fourth door does not carry that name. **A door
  census bounded by a NAME cannot see a door that does the same thing under another name** — the
  bound has to be the *capability* (what writes `organization_affiliations`), which is a catalog
  question, not a grep. That is how the sweep should have been cut, and `4.3` in `393` already
  demonstrates the correct shape for the void half.
