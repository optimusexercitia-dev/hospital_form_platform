---
paths:
  - "supabase/migrations/**"
broad: >-
  The whole directory IS the subject: this rule fires when someone is writing the migration
  they are about to push, which is the only moment the order can still be chosen.
anchors:
  - docs/deployment/coolify.md
  - package.json#db:push
  - docs/progress/phase-ledger.md#schema first, then code
source: AFF4 Record step 2026-08-26 — the order was documented, read, and violated · rotated from PROGRESS.md's Now section (retired 2026-09-03, ADR 0185)
---

# Push SCHEMA before CODE — `db push` first, `git push` second

⛔ **Never `git push` application code before the migrations it needs are on the remote.**
Coolify **auto-deploys on the `git push`** (`docs/deployment/coolify.md`), so pushing code
first opens a live window in which deployed code queries objects the remote does not have.

✅ Order: `npm run db:push` → verify **in the remote catalog** → then `git push`.

## Non-obvious parts

- ⚠ **"Additive, so old-code/new-schema is safe" is NOT a general excuse to reverse it.**
  That clause was written into an earlier record and is **false** whenever a migration
  *drops* something the deployed build still selects. The order holds regardless, because
  the reverse breaks sooner and wider (ADR 0137 Amendment 2).
- **A `git push` is not a `db push`.** Neither implies the other, and Coolify's deploy
  outcome is not measured by either — check Coolify.
- Verify in the remote CATALOG, never from `db push`'s own report.
- ⛔ **Nothing to push is not a reason to skip the check** — confirm the remote head.

## Why it is load-bearing

No gate enforces this and none can: the order is an operator action leaving no artifact
in the tree. AFF4 shipped the violation — the warning existed, was read, and was violated
anyway, because it sat under a heading about an unmerged branch rather than beside the
push. That is the whole reason this rule is path-scoped to the migrations directory: a
warning is only as good as its position relative to the action it governs.
