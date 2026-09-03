# FUP-AE1-UNREACHABLE-PUBLIC-DOORS — 11 `public` DEFINER doors `authenticated` can call that nothing in `src/` calls, + 3 no instrument references, + 15 comment-only (owner: backend/PO)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-27 · status open

> Filed 2026-08-27 at the AE1 Record step (obligation 2), from **RV4** of
> [authz-definer-classification-ae1.md](../design/authz-definer-classification-ae1.md), which ruled
> it *"a finding to file, not to revoke here"* — reachability and privilege are different questions
> and AE1.2 answered only the second. Full set: that document's **§8, three named buckets**.
>
> - **Bucket B (16), of which 11 are `public` doors live to `authenticated`** — pgTAP / E2E /
>   `scripts` name them; no production path does: `affiliate_person_to_org` · `appoint_hospital_dpo` ·
>   `archive_ethics_sanction_type` · `assign_ethics_remediation` · `assign_org_admin` ·
>   `create_ethics_sanction_type` · `open_ethics_external_referral` · `revoke_hospital_dpo` ·
>   `set_case_narrative_assignment_role` · `set_interview_interviewer_participant` ·
>   `set_interview_subject_participant`. The other 5 are `app` predicates of the same shape.
> - **Bucket A (3)** — referenced by **no instrument at all** (`app.case_capabilities`,
>   `app.commission_of_session`, `app.hospital_of_referral`): the *correct-door-that-nothing-can-reach*
>   shape.
> - **Bucket C (15)** — every `src/` occurrence is inside a comment, including 10 superseded per-flag
>   `*_enabled()` readers, one of whose JSDoc still claims a call its body no longer makes.
>
> ⚠ **Unreachable is not over-granted.** Each door's own gate may be correct; what is measured is
> that the product does not call it. Several bucket-B doors are **tenancy/identity administration**
> (`assign_org_admin`, `revoke_hospital_dpo`, `affiliate_person_to_org`), so the open question is a
> **product** one, stated at the classification's §11: *is this an intended surface with no UI yet, or
> is it dead?* ⛔ Filing it as a revoke candidate would conflate the two questions — RV4's whole point.
>
> ⛔ **Do not re-derive the set by hand.** It comes from §4's catalog SQL plus §5's four-tier `src/**`
> sweep (`rpc` / `code-literal` / `code-word` / `comment-only`, with `src/lib/types/database.ts`
> excluded because it names every `public` function, which would make everything look called). The
> comment tier exists because the TypeScript twin of the `prosrc` comment trap **fired here**.
>
> **Discharged when** every bucket-B door carries a recorded product verdict — *intended surface
> (AE4/AE5 owns the caller)* or *dead (drop it, or revoke it and record the arm-domain delta under
> `FUP-AE1-REVOKE-SET-EXECUTION`'s RV0 rule)* — and buckets A and C are ruled the same way. ⚠ A
> re-derivation at the then-current head is a precondition: these lists are as-of-2026-08-27 and the
> file's own header forbids reusing its numbers.
