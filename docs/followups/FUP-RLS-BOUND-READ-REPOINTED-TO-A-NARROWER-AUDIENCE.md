# FUP-RLS-BOUND-READ-REPOINTED-TO-A-NARROWER-AUDIENCE — a shipped, unexercised instance in `listOrgUsers`, and the census class that cannot see it (owner: backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-02 · status open

- 🟠 **FUP-RLS-BOUND-READ-REPOINTED-TO-A-NARROWER-AUDIENCE** — filed 2026-08-27 at AE2.2, by the
  lead, from a finding backend measured rather than inferred.

**The property, stated so it can be swept for:**

> *An RLS-bound application read is re-pointed from source X to source Y, and Y's SELECT policy has
> a **narrower audience** than X's. The query still compiles, still runs, and silently returns a
> smaller set — for some callers, only their own row.*

**The shipped instance (AFF4 B6a, not AE2).** `listOrgUsers` derives its roster from
`listOrgAffiliationTenses` under the caller's RLS. Measured 2026-08-27 on a fresh reset:
`hospitaladmin.a1` sees **1** `organization_affiliations` row in org A against **23** visible
`profiles` rows. `organization_affiliations_select` is
`principal_id = auth.uid() OR app.is_org_admin_of(organization_id)` — **no hospital tier, by
design** (ADR 0151 D1) — so the collapse is in the predicate.

⛔ **It is NOT reachable today, and that is NOT an all-clear.**
`src/app/o/[org]/manage/usuarios/page.tsx:163` routes `isOrgAdmin ? listOrgUsers :
listHospitalUsers`, so the exposed path is never taken by the caller who would collapse. **The
guard is a call-site ternary, not a property of the query** — any new caller, or an inverted
condition, reaches it. *"Not reachable" is not "protected"* (the standing lesson: an incidental
guard closing a hole the definition predicts).

**Why it is filed as a class, not a bug.** The same defect was hit **live** in AE2.2 on a
different function (`listLinkableOrgUsers`), where the consequence is governance-critical: a
coordinator whose picker collapses to one person is pushed from *possui conta* to *não possui
conta*, which **ADR 0108 D6** makes an **audited human assertion** that renders the case exclusion
**vacuously satisfied** — the impedimento silently stops working and the record shows a deliberate
assertion where there was a UI dead end. That instance is **blocked and handed to AE2.4** with
option **C-a rejected** and **C-b′** recommended (`docs/progress/authz-ae2.md` § Handed to AE2.4).

⛔ **The instrument gap, which is the durable half.** AE2.1's census classified `src/` consumers as
**read / write / type-only / comment**. That partition **cannot express the property above**, so
the census caught the SQL instance (the INVOKER containment trigger) and **missed the TS one** —
same defect, same blindness, different language. **Any future column/table re-pointing owes an
audience-comparison pass over its RLS-bound reads**, not just a read/write classification.

**Bounded, so this is not read as wider than it is.** Of AE2.1's 7 production read sites, **2 are
RLS-bound**; 5 run on `createAdminClient()` / an injected service-role client and are structurally
immune. Of the two, only `listLinkableOrgUsers` uses the column as a **filter** —
`org-users.ts:55/761` is a **projection** inside `PROFILE_SELECT`, a different AE2.4 concern (the
column must leave the select list). ⚠ **That bound covers the `home_organization_id` census only.**
No sweep has been run for this property over other re-pointings, past or future.

**Owed:** (1) decide whether `listOrgUsers`' exposure is fixed now or when C-b′ lands for its
sibling — they are the same shape and one fix likely serves both; (2) a pin that is a property of
the query rather than of one call site (`org-roster-predicate.test.ts:186` pins the old predicate's
absence for `listOrgUsers` **only**, and its own comment concedes the over-claim); (3) state
whether the audience-comparison pass becomes a standing step for re-pointings, or stays advice.
