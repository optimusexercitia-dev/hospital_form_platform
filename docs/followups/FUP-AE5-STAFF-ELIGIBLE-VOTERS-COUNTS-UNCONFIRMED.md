# FUP-AE5-STAFF-ELIGIBLE-VOTERS-COUNTS-UNCONFIRMED

**Filed:** 2026-09-15 (unit `AE5-STAFF`, AC-10 `e2e:prod` batch 6, by the lead) · **Owner:** backend
**Severity:** medium — a quorum denominator can include a principal who cannot authenticate.
**Status:** open

## The finding

`app.eligible_voters(p_case_id uuid)` is the ethics procedure's voter set (ADR 0073 § D4). Its live
body, read with `pg_get_functiondef` on 2026-09-15:

```
select m.principal_id
from public.memberships m
where m.commission_id = app.commission_of_case(p_case_id)
  and (m.expires_at is null or m.expires_at > now())
  and app.is_active(m.principal_id)
  and not app.is_recused_from_case(p_case_id, m.principal_id)
  and not app.is_case_respondent(p_case_id, m.principal_id)
group by m.principal_id;
```

No term reads `email_confirmed_at`, and `app.is_active` does not read it either (ADR 0211
`:187–190`, pinned by `426 § 3.4`). So a principal whose email is unconfirmed is an eligible voter.
GoTrue refuses that principal a password grant (`400 email_not_confirmed`) whatever
`enable_confirmations` says, so the principal counts toward the set and cannot vote.

Found when AE5-STAFF's seed added `gap.pending@test.local` (unconfirmed, `staff` at CCIH) and
`e2e/ethics-e2-procedure.spec.ts` FLOW-7 could not mint a token for it: the spec mirrors the
definition and requires full turnout. The fixture side of that red is PO ruling R-6 in
`docs/progress/ae5-staff.md`; this follow-up is the definition side and stands whatever R-6 rules.

## Why it matters beyond the spec

Whether the voter set is used as a quorum denominator decides the impact. If it is, an invited
member who never confirmed raises the bar a real committee has to meet. Nothing today constructs
that principal against the definition in pgTAP. The one place it was constructed is an E2E fixture,
and it surfaced as a token error rather than as a quorum assertion.

## Closes when

The intended membership of the voter set for a principal with `email_confirmed_at IS NULL` is
decided and written in ADR 0073's successor or an amendment, and a pgTAP test constructs such a
principal against `app.eligible_voters` and against the quorum check `issue_decision` applies
(HC0J8), showing the written behaviour. It must be shown able to red by flipping the confirmation
state.
