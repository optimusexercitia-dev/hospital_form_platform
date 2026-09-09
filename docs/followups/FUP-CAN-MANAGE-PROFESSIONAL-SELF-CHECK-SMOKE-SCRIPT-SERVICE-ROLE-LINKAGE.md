# FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-SMOKE-SCRIPT-SERVICE-ROLE-LINKAGE

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-09 · status open

**Mechanism.** `scripts/smoke/pdf-mint.smoke.ts` (~lines 406-419) inserts
`professional_profiles.user_id` and `professional_participants` rows through
`createAdminClient()`, bypassing `public.set_professional_link_state` and therefore its
linkage-freeze trigger. The script constructs a linkage state the production door would refuse, so
any invariant that door enforces is unasserted for rows the smoke script created — and a
service-role write site that skips its door is exactly what the service-role DML registry exists to
make visible.

**Closes when:** the script creates linkage through `set_professional_link_state` (or through a
DEFINER helper that calls it), verified by the linkage-freeze trigger firing on a deliberate
double-link in the script's own run; or the two write sites are registered in the service-role DML
registry with a written justification for the bypass.

**Origin:** filed at the Record step of pre-AE5 remediation Batch 8, unit
`CAN-MANAGE-PROFESSIONAL-SELF-CHECK`, found while tracing service-role write sites touching
professional-identity tables. Full record:
[`docs/progress/can-manage-professional-self-check.md`](../progress/can-manage-professional-self-check.md).
