# FUP-ADMIN-ARM-IS-ACTIVE-CAN-CREATE-PROFESSIONAL-COMMENT-NAMES-A-REMOVED-ARM

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-10 · status open

**The defect.** `app.can_create_professional(uuid, uuid)`'s body carries

```
-- PRESERVED ARM — org authority (platform_admin via is_admin(), org_admin). Both `legacy`.
```

ADR 0201 D5 (Batch 10) removes the platform arm from `app.can_manage_professional`, which is
exactly the arm that parenthetical names. After migration `20261003007390` the comment asserts a
reach that no longer exists, in the body of a gate that is still live. **A comment is an
assertion that goes stale silently**, and this one now describes the *authority model* wrongly at
the one place a reader goes to check it.

⚠ **It is a COMMENT, not an arm — the behaviour is unaffected.** The `is_admin(` that a `prosrc`
regex finds in `can_create_professional` matches **inside that comment**; the executable body is
`can_manage_professional(p_org, p_uid) or authz.has_permission(p_uid, 'organization', p_org,
'org.professionals.create')` and carries no `app.is_admin` call of any kind. Recorded because the
regex hit briefly read as a live second platform arm during the build (text is not truth), and
the next reader will hit the same thing.

**Why it was not fixed in Batch 10.** The migration's scope was ruled at FIVE bodies. Rewriting a
sixth to correct a comment would widen a ruled scope silently — the opposite of the discipline
the rest of that migration follows. The migration header names the staleness instead
(`docs/progress/admin-arm-is-active.md`, "the BUILD" entry, "Not edited, deliberately, and
reported instead").

**Closes when:** the next migration that legitimately touches `app.can_create_professional`
re-emits the body with the parenthetical corrected (`org authority (org_admin)`), per the
`migrations-forward-only` rule's own guidance: *"Prefer correcting a wrong header in the next
migration that touches the same object."* ⛔ Not a standalone comment-only migration — that rule
also says a comment-only edit is not free.

**Origin.** Filed at the Record step of pre-AE5 remediation Batch 10, unit `ADMIN-ARM-IS-ACTIVE`,
out of migration `20261003007390_admin_arm_follows_account_state.sql`; full record:
[`docs/progress/admin-arm-is-active.md`](../progress/admin-arm-is-active.md).
