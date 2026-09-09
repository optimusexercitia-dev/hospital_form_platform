# FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-PLATFORM-ADMIN-CLASS-2-WRITE

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-09 · status open

**Mechanism.** `app.can_manage_professional`'s arm 1 grants on `is_admin_for(p_uid)` alone, and that
predicate gates `public.update_professional_profile` and `public.redact_professional_profile` —
CPF, licence number, specialty, i.e. **Class-2 professional identity content**. ADR 0078 A35's noun
rule says a `platform_admin` is a superuser over tenancy, identity, vocabulary and audit and may
**not** touch commission content. This is Option (ii) of ADR 0200, rejected there only because it
moves a *currently reachable* answer and would have made the keying fix unattributable — not on
the merits.

**Closes when:** the PO has ruled on whether arm 1 should exist at this gate, with the door list (3
`public` RPCs, derived from `pg_proc`, not quoted) in front of them; and either the arm is removed
with a pgTAP cell asserting a `platform_admin` is denied `redact_professional_profile` (RED before,
GREEN after) plus an E2E over the reachable UI path, or the exception is recorded in an ADR naming
why professional identity is a tenancy noun.

**Origin:** filed at the Record step of pre-AE5 remediation Batch 8, unit
`CAN-MANAGE-PROFESSIONAL-SELF-CHECK`, out of ADR
[0200](../decisions/0200-professional-identity-predicates-answer-about-their-subject.md) § Considered
options (ii). Full record:
[`docs/progress/can-manage-professional-self-check.md`](../progress/can-manage-professional-self-check.md).
