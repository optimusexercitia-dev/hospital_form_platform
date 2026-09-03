# FUP-AE2-PERSON-PREAMBLE-THREE-COPIES — the person-authorization preamble exists in three independent TS copies, and that duplication is the mechanism behind this phase's recurring sibling-axis misses (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-28 · status open

> Filed 2026-08-28 at AE2.4 increment 3, on the lead's ruling that assigned the third and
> second copies to that increment. **Not a live defect** — all three were moved together and
> agree today. It is filed because the STRUCTURE that made them able to disagree is still here.
>
> **The three copies** (`src/lib/users/`): `authorizePersonScopedAdmin` (`actions.ts`) ·
> `authorizeForUser` (`actions.ts`) · `getPersonAdminView` (`person-footprint.ts`). Each opened
> by resolving the target's organization and granting to an `org_admin` of it. ⛔ **Only the
> first was named by any increment's target list.** The second would have shipped still reading
> `profiles.home_organization_id` after the column drop; the third would have left the UI's
> authority booleans disagreeing with the server action that enforces them — buttons shown that
> refuse, buttons hidden that would have worked.
>
> **This phase has now paid for the same shape four times:** AFF4's two roster functions · the
> AE2.1 census catching the SQL instance and missing the TS one · the two `affiliate_person*`
> doors (AE2.4 inc 1) · this. The enumerating property is *"an authorization preamble that
> resolves person tenancy"*, and every miss came from enumerating by LIST instead.
>
> **What increment 3 already collapsed:** `personAuthorityOrgs(userId)` (the LOCATE step — all
> three now share it) and `administeredHospitalsIn(orgIds)` (the hospital arm — copies 1 and 3).
>
> **Could the WHOLE preamble be one function? Measured answer: partly, and the boundary is
> principled.** `authorizeForUser` diverges immediately after the org arm into ADR 0051's rule —
> ANY intersection with the caller's administered hospitals, no tier rule, no subset bound,
> deliberately NOT `personScopeAllows` (the reasoning is written out on `sendPasswordResetForUser`
> and on `callerHospitalAdminMayManageUser`). Unifying it would import ADR 0133 D2 and deny a
> hospital_admin the ability to resend an invite to a technical_director at their own hospital.
> **So it must stay separate.** Copies 1 and 3, however, are the same computation to the end —
> locate → org arm → administered hospitals → footprint → `personScopeAllows` — differing only in
> that one evaluates a single capability and the other two plus a payload. Those two ARE unifiable
> into a single `resolvePersonAuthority(userId)`.
>
> **Why increment 3 did not do it:** it is a refactor with its own blast radius, inside a
> re-predication increment whose differential depends on attributing every moved cell to the
> organization list alone. Two constraints any unification must preserve, both currently pinned:
> `getPersonAdminView` must NOT resolve a footprint on the `org_admin` path
> (`person-admin-view.test.ts § 5`), and `authorizePersonScopedAdmin` returns on the FIRST granting
> organization rather than evaluating all of them.
>
> ⛔ **The gap that outlives the fix: no gate can see a fourth copy appear.** `lint:memberships-door`
> polices direct `memberships` reads; the authz ARMs cover `pg_proc` / `pg_policies` — DATABASE
> doors. A TS authorization preamble is in no arm's domain, which is the same blind spot recorded
> on `person-footprint.ts`'s own header. Options, none taken yet: a `check-person-preamble.mjs`
> gate keyed on the property (a module resolving person tenancy and branching on `authorizeOrgOps`),
> or the unification above, which removes the subject instead of watching it.
