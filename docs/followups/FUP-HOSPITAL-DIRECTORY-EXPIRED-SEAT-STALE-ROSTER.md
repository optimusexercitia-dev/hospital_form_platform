# FUP-HOSPITAL-DIRECTORY-EXPIRED-SEAT-STALE-ROSTER — an expired seat still counts a person onto the hospital directory (owner: backend/PO; filed 2026-08-26 at the AFF4 QA round, found by `backend` while ruling the hospital roster predicate)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-26 · status open

`hospitalPeopleIds()`'s commission leg selects seats by `commission_id` with **no `expires_at`
predicate**. ADR 0151 **D6** rules that an **expired** membership does **not** block
`end_org_affiliation`. Those two facts compose: a person holding an expired commission seat can be
org-offboarded and **still appear on the hospital directory**, which is exactly the case the
*"incluir desligados"* toggle is supposed to govern.

⛔ **Stale roster, NOT an authorization leak — and the distinction is load-bearing.** `app.has_role`
**does** filter `expires_at`, so no capability is granted by the stale row; the person's data was
already visible to that hospital admin. Conflating the two would justify precisely the
policy-widening that ADR
[0158](../decisions/0158-hospital-directory-keeps-its-predicate.md) refuses — and that ADR refuses
it because `organization_affiliations` has no hospital tier **by decision** (ADR 0151 D1, pinned by
pgTAP `375` §4.1), so filtering the hospital roster on that table would blank the page for the only
role it serves.

**Candidate fix, unscheduled and needing a PO go:** a narrow `SECURITY DEFINER` helper returning
**principal ids only**, gated on the caller being an active `hospital_admin` of that hospital or an
`org_admin` of its org, with **no audit emission** — so it does not repeat the per-call
`person.cpf_lookup` behaviour that made ADR 0154 reject routing the directory through
`list_org_people`. Being a new DEFINER read path it needs the full treatment: red-first keystone,
`ARM=census`, wrapper arm, door-sweep entry.

⚠ Why it is filed rather than fixed: the gap is reachable only when someone holds an **expired**
commission seat *and* is org-offboarded. That is a real production state, not a synthetic one — but
it is narrow enough that widening a hospital admin's reach into org-tier records to close it is a
poor trade made under gate pressure.
