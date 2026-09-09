# FUP-ENFORCEMENT-MANIFEST-COMMENT-DESCRIBES-A-RED-THAT-IS-GREEN

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-09 · status open

**Mechanism.** Rows 31/32 of `supabase/tests/vectors/authz-enforcement-manifest.json` carry a
`_comment` stating that `401 § 19.2b` *"is RED on exactly this and must not be re-numbered to 2 …
AWAITING A LEAD RULING"*. Measured: **§ 19.2b is GREEN** — its expected value was moved 1 → 2 and
§ 19.2c added to pin *which* pair survives, precisely so the count could not green itself by any
pairing. The ruling the comment awaits was taken. No gate can contradict a `_comment`, and this one
sits on the document that is the manifest's own authority — LEARN-088 / "a register's failure mode
is prose rot". ⚠ Distinct from ADR 0200's collateral, which touched only the
`org.professionals.read` row's *data* fields.

**Closes when:** the `_comment` on rows 31/32 states the ruling that was taken and the current
value of `401 § 19.2b`, and a fresh run of `401` is quoted beside it showing § 19.2b and § 19.2c
green. ⛔ Not closed by deleting the comment — the ruling it half-records is worth keeping.

**Origin:** filed at the Record step of pre-AE5 remediation Batch 8, unit
`CAN-MANAGE-PROFESSIONAL-SELF-CHECK`, found while re-deriving the manifest projection after the
subject-keying migration. Full record:
[`docs/progress/can-manage-professional-self-check.md`](../progress/can-manage-professional-self-check.md).
