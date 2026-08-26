# 0158 — the hospital directory keeps its predicate: no org-affiliation filter at the hospital tier

**Status:** Accepted · 2026-08-26
**Amends:** 0154 (D1 rules that the org-affiliation predicate replaces `home_organization_id` in
`listHospitalUsers` as well as `listOrgUsers`; for the hospital arm it does not, and the retraction
existed only as a plan bullet and a code comment.)

## Context

ADR 0154 D1 — *"both surfaces move"* — ruled that the ever-held org-affiliation predicate replaces
`home_organization_id` in **`listOrgUsers` and `listHospitalUsers`** alike, reasoning that wiring
only the org-wide arm would leave a `hospital_admin`'s roster permanently active-only, since that
role never calls the other.

Implementation found the premise false in two independent ways, and the PO ruled **option A** —
leave `listHospitalUsers` alone — on 2026-08-26. **Nothing recorded that ruling.** It lived in a
plan bullet and a code comment, and gate 9 structurally cannot detect a missing `**Amends:**`
label: an undeclared amendment leaves no trace. So 0154 D1 stood, unqualified, as authority over a
function it no longer governs — and stale text is always the *tighter* rule, so it reads as care.

### 1. `listHospitalUsers` never keyed on `home_organization_id`

It scopes through `hospitalPeopleIds()` (`src/lib/queries/org-users.ts`), the single AFF2 B8
definition of "the hospital's user set": active hospital affiliations, unioned with membership rows
on that hospital's commissions. **There is no `home_organization_id` filter in it to replace.**
0154 D1 named it beside `listOrgUsers` on the assumption that the two shared a predicate. They
never did.

### 2. The org-affiliation predicate is UNREADABLE to the role that surface serves

Measured 2026-08-26 against the live catalog on a seeded local stack (35 `organization_affiliations`
rows; 29 of them in org A):

| caller (with active hat) | rows visible | belonging to someone else |
| --- | --- | --- |
| `orgadmin.a@test.local` (`org_admin`) | 29 | 28 |
| `hospitaladmin.a1@test.local` (`hospital_admin`) | **1** — their own | **0** |

The same `hospital_admin` reads **4** `hospital_affiliations` rows, so this is one policy missing an
arm, not an inability to read the table.

The cause is the policy itself, which has **no hospital tier** by ADR 0151 D1 (*"RLS SELECT only
(self OR `app.is_org_admin_of`)"*). Live, from `pg_policies`:

```
organization_affiliations_select | SELECT | {authenticated}
  USING: ((principal_id = (SELECT auth.uid())) OR app.is_org_admin_of(organization_id))
```

That absence is deliberate and **already pinned**: pgTAP
`375_organization_affiliations_policy_audience.sql` §4.1 asserts a `hospital_admin` reads ZERO org
affiliations belonging to anyone else, with §4.2 as the control proving he still reads his own. Its
own comment states the intent — *an absent arm is a decision, and it needs an assertion or the next
author "completes the pattern"*. Executing 0154 D1 would have been precisely that completion.

> ⚠ **Instrument note, because it inverts the result.** `app.has_role` ends in
> `p_user_id is distinct from auth.uid() or p_role is not distinct from app.active_role()`, so a
> self-query needs the caller's **active hat** in the JWT. A first measurement that set only `sub`
> returned **1** for the `org_admin` too — the deny reproduces for the wrong reason when the hat is
> missing, and would have read as confirmation of this ADR's conclusion. The table above was taken
> with `active_role` set.

### 3. What executing 0154 D1 would actually have done

Filtering `listHospitalUsers` on a table the `hospital_admin` can read exactly one row of returns a
**one-person directory — themselves** — for the only role that surface exists to serve. The
predicate would not narrow the roster to active people; it would blank it.

## Decision

**D1 — `listHospitalUsers` keeps its existing predicate.** 0154 D1's "both surfaces move" is
retracted for the hospital arm. `listOrgUsers` and `list_org_people` move as ruled;
`hospitalPeopleIds()` remains the hospital tier's definition of its own roster. (PO-ruled option A,
2026-08-26.)

**D2 — the fix is NOT a hospital arm on `organization_affiliations_select`.** Granting one to make
the predicate readable would widen a deliberately-narrow PHI-adjacent policy in order to serve a
query filter — never fix a read by granting access. pgTAP 375 §4.1 is a pin, not an obstacle.

## Consequences

- **The *"incluir desligados"* toggle is STRUCTURALLY ABSENT from the hospital directory**, not
  merely unbuilt. It filters on org-affiliation tense, and that tense is unreadable there. An author
  who finds the toggle on one directory and not the other should read this before "completing the
  pattern" — the same reflex §4.1 exists to stop.
- **T2's parity gate is scoped to the ORG directory.** It cannot assert hospital/org roster parity,
  because after this ruling the two surfaces legitimately answer different questions.
- **Residual: the expired-seat gap — and it is explicitly NOT an authorization leak.**
  `hospitalPeopleIds()`'s commission leg selects membership rows by `commission_id` with **no
  `expires_at` predicate**, so a person whose commission seat has expired still appears in the
  hospital directory. That is a **stale roster** — a name listed too long — and it confers nothing:
  every capability check re-derives authority through `app.has_role`, which *does* filter on
  `expires_at`. Left unfixed in AFF4 deliberately; it is a display-freshness defect, and conflating
  it with a leak would justify exactly the policy-widening D2 refuses.
