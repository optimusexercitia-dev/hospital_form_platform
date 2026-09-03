# FUP-DSR-ENCARREGADO-MUST-BE-A-COMMISSION-MEMBER — the LGPD data-protection officer cannot be a pure officer (owner: PO/product; **filed 2026-08-20 after a lead premise was measured false**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-20 · status open

`app.is_dpo_of_for(p_hospital_id, p_user_id)` carries this as a **hard conjunct**, measured in the
live catalog 2026-08-20:

```sql
and exists (
  select 1 from public.commissions c
  where c.hospital_id = p_hospital_id
    and app.has_role_any('commission', c.id, p_user_id)
)
```

So an *Encarregado* (LGPD Art. 41 data-protection officer) who holds **no commission role** in that
hospital resolves `false`, arm 1 of `list_my_dsr_hospitals()` returns nothing, and
`/o/[org]/titulares` 404s them. A second, independent lock says the same thing one layer out:
`organizations_select` is `is_admin OR is_org_admin_of OR is_org_member OR is_pqs_operator_in_org OR
is_nsp_org_admin_of OR is_org_level_admin_within OR is_quality_reviewer_in_org` — **no DPO arm** —
and `titulares/layout.tsx` reads the organization row *before* the DSR gate.

⛔ **This is BY DESIGN, not an oversight.** ADR [0130](../decisions/0130-dsr-subject-request-workflow.md)
D2, quoted in `src/lib/queries/dsr.ts`: *"The Encarregado is a plain member of ONE commission BY
DESIGN."* The seed's only DPO, `staff1.ccih@test.local`, is a plain CCIH `staff` member for exactly
this reason.

**The open product question, which the design does not answer:** in a real hospital the Encarregado
is frequently a compliance/legal officer with no committee seat. Today onboarding one means giving
them a commission membership they do not otherwise need — which is a *read grant over that
commission's content*, i.e. paying for a DSR office with unrelated access.

⭕ **Filed, not fixed.** Discovered 2026-08-20 when a lead spawn prompt asserted the opposite
(*"in production an Encarregado is a hospital/org officer who need not be a member of any
commission"*) and `frontend` measured it false before building against it. ⭐ The premise was wrong in
the direction that would have produced **dead navigation code**, and the catch came from a teammate
checking the catalog rather than the prompt.

**If the PO wants the pure-officer persona**, it costs: an `is_dpo_of_for` widening, an
`organizations_select` DPO arm, an ADR 0130 D2 amendment, and a re-think of where such a user lands
after login (`list_my_dsr_hospitals()` returns `orgId` but **no `orgSlug`**, and a caller who cannot
read `organizations` cannot resolve one). ⛔ Not a nav change — a boundary change, and it widens a
read path, so it does not qualify as wrong-and-safe.
