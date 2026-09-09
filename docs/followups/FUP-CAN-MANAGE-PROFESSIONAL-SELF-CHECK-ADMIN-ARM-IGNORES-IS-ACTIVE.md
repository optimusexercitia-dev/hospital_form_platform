# FUP-CAN-MANAGE-PROFESSIONAL-SELF-CHECK-ADMIN-ARM-IGNORES-IS-ACTIVE

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-09 · status open

**Mechanism.** Neither `app.is_admin()` nor `app.is_admin_for()` contains an `app.is_active` term
(verified from `pg_proc`, both bodies quoted in ADR 0200). So a `platform_admin` who is deactivated
or suspended passes every admin arm in the tree — including the ones BUG-PROF-INACTIVE-001
hardened on the org side, where `is_org_admin_of_for` *does* gate on `is_active(p_uid)`. ADR 0200
did **not** change this in either direction: the admin arm has never carried an `is_active` term to
bypass, before or after the re-key, so this is pre-existing and was kept out of that unit for
attributability. The asymmetry now sits inside one expression — arm 2
(`app.is_org_admin_of_for`) follows the subject's state, arm 1 (`app.is_admin_for`) ignores it.

**Closes when:** `app.is_admin_for`'s live `prosrc` contains an `app.is_active` term (verified from
`pg_proc`, comments stripped), with a pgTAP cell that deactivates a `platform_admin` and asserts
the admin arm denies, **reported RED before the change**; ⛔ or the PO rules explicitly that
platform-admin authority is deliberately independent of principal state, and that ruling is
recorded in an ADR. Not closed by "no one has deactivated an admin yet".

**Origin:** filed at the Record step of pre-AE5 remediation Batch 8, unit
`CAN-MANAGE-PROFESSIONAL-SELF-CHECK` — drafted while re-keying `app.can_manage_professional` and
`app.can_read_professional_profile` onto their `_for` twins (ADR
[0200](../decisions/0200-professional-identity-predicates-answer-about-their-subject.md)). Full
record: [`docs/progress/can-manage-professional-self-check.md`](../progress/can-manage-professional-self-check.md).
